const express = require("express");
const router = express.Router();
const dayjs = require("dayjs");
const { query } = require("../db");
const { authMiddleware } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validate");
const { sendScheduledReport, scheduleReportJob } = require("../jobs/scheduledReports");

router.get("/", authMiddleware, async (req, res) => {
  try {
    const [rows] = await query(
      "SELECT * FROM report_schedules WHERE user_id = ? ORDER BY is_active DESC, next_send_date ASC",
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load report schedules" });
  }
});

router.post("/", authMiddleware, validate(schemas.reportSchedule), async (req, res) => {
  try {
    const { recipient_email, format = "pdf", frequency = "monthly",
      include_budget_overview = true, include_trends = true,
      include_recurring = true, next_send_date } = req.body;

    const sendDate = next_send_date
      ? dayjs(next_send_date)
      : dayjs().add(1, frequency === "weekly" ? "week" : "month");

    if (!sendDate.isValid()) return res.status(400).json({ error: "Invalid next send date." });

    const [result] = await query(
      "INSERT INTO report_schedules (recipient_email, format, frequency, include_budget_overview, include_trends, include_recurring, next_send_date, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [recipient_email, format, frequency, include_budget_overview, include_trends, include_recurring, sendDate.format("YYYY-MM-DD"), req.userId]
    );
    const [[row]] = await query("SELECT * FROM report_schedules WHERE id = ?", [result.insertId]);
    scheduleReportJob(row);
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: "Failed to create report schedule" });
  }
});

router.put("/:id", authMiddleware, validate(schemas.reportSchedulePatch), async (req, res) => {
  try {
    const { recipient_email, format, frequency, include_budget_overview, include_trends,
      include_recurring, next_send_date, is_active } = req.body;
    const fields = [], params = [];
    if (recipient_email !== undefined)         { fields.push("recipient_email = ?");         params.push(recipient_email); }
    if (format !== undefined)                  { fields.push("format = ?");                  params.push(format); }
    if (frequency !== undefined)               { fields.push("frequency = ?");               params.push(frequency); }
    if (include_budget_overview !== undefined) { fields.push("include_budget_overview = ?"); params.push(include_budget_overview); }
    if (include_trends !== undefined)          { fields.push("include_trends = ?");          params.push(include_trends); }
    if (include_recurring !== undefined)       { fields.push("include_recurring = ?");       params.push(include_recurring); }
    if (next_send_date !== undefined)          { fields.push("next_send_date = ?");          params.push(next_send_date); }
    if (is_active !== undefined)               { fields.push("is_active = ?");               params.push(is_active); }
    fields.push("updated_at = CURRENT_TIMESTAMP");
    params.push(req.params.id, req.userId);
    await query(
      `UPDATE report_schedules SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`, params
    );
    const [[row]] = await query("SELECT * FROM report_schedules WHERE id = ?", [req.params.id]);
    if (row) scheduleReportJob(row);
    res.json({ message: "Report schedule updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update report schedule" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    await query("DELETE FROM report_schedules WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
    res.json({ message: "Report schedule deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete report schedule" });
  }
});

router.post("/:id/send-now", authMiddleware, async (req, res) => {
  try {
    const scheduleId = Number(req.params.id);
    if (!Number.isFinite(scheduleId)) return res.status(400).json({ error: "Invalid schedule id" });
    const [[schedule]] = await query(
      "SELECT id FROM report_schedules WHERE id = ? AND user_id = ?",
      [scheduleId, req.userId]
    );
    if (!schedule) return res.status(404).json({ error: "Report schedule not found" });
    await sendScheduledReport(scheduleId);
    res.json({ message: "Report sent" });
  } catch (err) {
    res.status(500).json({ error: "Failed to send report" });
  }
});

module.exports = router;
