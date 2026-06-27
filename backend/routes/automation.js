const express = require("express");
const router = express.Router();
const dayjs = require("dayjs");
const { query } = require("../db");
const { authMiddleware } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validate");
const { calculateNextRunDate } = require("../jobs/recurringTransactions");

const roundToTwo = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

// ── Expected Incomes ───────────────────────────────────────────────────────

router.get("/expected-incomes", authMiddleware, async (req, res) => {
  try {
    const [rows] = await query(
      "SELECT * FROM expected_incomes WHERE user_id = ? ORDER BY name ASC", [req.userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load expected incomes" });
  }
});

router.post("/expected-incomes", authMiddleware, validate(schemas.expectedIncome), async (req, res) => {
  try {
    const { name, category, expected_amount, frequency = "monthly", due_day = null, notes = null } = req.body;
    const [result] = await query(
      "INSERT INTO expected_incomes (name, category, expected_amount, frequency, due_day, notes, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [name, category, expected_amount, frequency, due_day, notes, req.userId]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: "Failed to create expected income" });
  }
});

router.put("/expected-incomes/:id", authMiddleware, validate(schemas.expectedIncomePatch), async (req, res) => {
  try {
    const { name, category, expected_amount, frequency, due_day, notes, last_received_date } = req.body;
    await query(
      "UPDATE expected_incomes SET name=?, category=?, expected_amount=?, frequency=?, due_day=?, notes=?, last_received_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?",
      [name, category, expected_amount, frequency, due_day, notes, last_received_date, req.params.id, req.userId]
    );
    res.json({ message: "Expected income updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update expected income" });
  }
});

router.delete("/expected-incomes/:id", authMiddleware, async (req, res) => {
  try {
    await query("DELETE FROM expected_incomes WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
    res.json({ message: "Expected income removed" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete expected income" });
  }
});

// ── Income Reconciliation ──────────────────────────────────────────────────

router.get("/income-reconciliation", authMiddleware, async (req, res) => {
  try {
    const monthParam = req.query.month ? dayjs(req.query.month + "-01") : dayjs().startOf("month");
    if (!monthParam.isValid()) return res.status(400).json({ error: "Invalid month supplied." });

    const start = monthParam.startOf("month");
    const end = monthParam.endOf("month");
    const [expected] = await query("SELECT * FROM expected_incomes WHERE user_id = ?", [req.userId]);
    const results = [];

    for (const income of expected) {
      const [credits] = await query(
        "SELECT id, name, amount, date, category FROM credits WHERE category = ? AND date BETWEEN ? AND ? AND user_id = ? ORDER BY date ASC",
        [income.category, start.format("YYYY-MM-DD"), end.format("YYYY-MM-DD"), req.userId]
      );
      const receivedAmount = credits.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
      const dueDate = income.due_day != null
        ? start.date(Math.min(income.due_day, start.daysInMonth())) : end;
      const lastReceived = credits.length ? dayjs(credits[credits.length - 1].date) : null;

      let status = "missing";
      if (receivedAmount >= parseFloat(income.expected_amount)) status = "on_time";
      else if (receivedAmount > 0) status = "partial";

      const late = status !== "on_time" && dayjs().isAfter(dueDate) && receivedAmount < parseFloat(income.expected_amount);
      results.push({
        income,
        receivedAmount: roundToTwo(receivedAmount),
        receivedRecords: credits,
        dueDate: dueDate.format("YYYY-MM-DD"),
        lastReceived: lastReceived ? lastReceived.format("YYYY-MM-DD") : null,
        status: late ? "late" : status,
      });
    }
    res.json({ month: start.format("YYYY-MM"), results });
  } catch (err) {
    res.status(500).json({ error: "Failed to reconcile income" });
  }
});

// ── Recurring Transactions ─────────────────────────────────────────────────

router.get("/recurring-transactions", authMiddleware, async (req, res) => {
  try {
    const [rows] = await query(
      "SELECT * FROM recurring_transactions WHERE user_id = ? ORDER BY is_active DESC, next_run_date ASC",
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load recurring transactions" });
  }
});

router.post("/recurring-transactions", authMiddleware, validate(schemas.recurringTransaction), async (req, res) => {
  try {
    const { type, name, category, amount, frequency = "monthly", dayOfMonth = null, weekday = null, startDate = null, is_active = true } = req.body;
    const initialDate = startDate ? dayjs(startDate) : dayjs();
    const nextRunDate = initialDate.isValid() ? initialDate : dayjs().startOf("day");
    const tx = { frequency, day_of_month: dayOfMonth, weekday };
    const normalizedNextRun = nextRunDate.isAfter(dayjs().startOf("day"))
      ? nextRunDate : calculateNextRunDate(tx, dayjs().startOf("day"));
    const [result] = await query(
      "INSERT INTO recurring_transactions (type, name, category, amount, frequency, day_of_month, weekday, next_run_date, is_active, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [type, name, category, amount, frequency, dayOfMonth, weekday, normalizedNextRun.format("YYYY-MM-DD"), is_active, req.userId]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: "Failed to create recurring transaction" });
  }
});

router.put("/recurring-transactions/:id", authMiddleware, validate(schemas.recurringTransactionPatch), async (req, res) => {
  try {
    const { name, category, amount, frequency, day_of_month, weekday, next_run_date, is_active } = req.body;
    await query(
      "UPDATE recurring_transactions SET name=?, category=?, amount=?, frequency=?, day_of_month=?, weekday=?, next_run_date=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?",
      [name, category, amount, frequency, day_of_month, weekday, next_run_date, is_active, req.params.id, req.userId]
    );
    res.json({ message: "Recurring transaction updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update recurring transaction" });
  }
});

router.delete("/recurring-transactions/:id", authMiddleware, async (req, res) => {
  try {
    await query("DELETE FROM recurring_transactions WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
    res.json({ message: "Recurring transaction removed" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete recurring transaction" });
  }
});

module.exports = router;
