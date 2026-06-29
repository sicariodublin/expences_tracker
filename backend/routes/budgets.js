const express = require("express");
const router = express.Router();
const { db } = require("../db");
const { authMiddleware } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validate");

router.get("/", authMiddleware, (req, res) => {
  db.query(
    "SELECT * FROM budget_goals WHERE is_active = TRUE AND user_id = ? ORDER BY category",
    [req.userId],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json(results);
    }
  );
});

router.post("/", authMiddleware, validate(schemas.budgetGoal), (req, res) => {
  const { category, monthly_limit } = req.body;
  db.query(
    "INSERT INTO budget_goals (category, monthly_limit, user_id) VALUES (?, ?, ?)",
    [category, monthly_limit, req.userId],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json({ message: "Budget goal added", id: result.insertId });
    }
  );
});

router.put("/:id", authMiddleware, validate(schemas.budgetGoalPatch), (req, res) => {
  const { category, monthly_limit } = req.body;
  db.query(
    "UPDATE budget_goals SET category = ?, monthly_limit = ? WHERE id = ? AND user_id = ?",
    [category, monthly_limit, req.params.id, req.userId],
    (err) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json({ message: "Budget goal updated" });
    }
  );
});

router.delete("/:id", authMiddleware, (req, res) => {
  db.query(
    "UPDATE budget_goals SET is_active = FALSE WHERE id = ? AND user_id = ?",
    [req.params.id, req.userId],
    (err) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json({ message: "Budget goal deleted" });
    }
  );
});

router.get("/progress", authMiddleware, (req, res) => {
  const selectedMonth = (req.query.month || new Date().toISOString()).slice(0, 7);
  const sql = `
    SELECT
      bg.id, bg.category,
      CAST(bg.monthly_limit AS DECIMAL(10,2)) as monthly_limit,
      CAST(COALESCE(SUM(e.amount), 0) AS DECIMAL(10,2)) as spent_amount,
      CAST((bg.monthly_limit - COALESCE(SUM(e.amount), 0)) AS DECIMAL(10,2)) as remaining_amount,
      CAST(ROUND((COALESCE(SUM(e.amount), 0) / bg.monthly_limit) * 100, 2) AS DECIMAL(5,2)) as percentage_used
    FROM budget_goals bg
    LEFT JOIN expenses e ON bg.category = e.category
      AND DATE_FORMAT(e.date, '%Y-%m') = ?
      AND e.user_id = ?
    WHERE bg.is_active = TRUE AND bg.user_id = ?
    GROUP BY bg.id, bg.category, bg.monthly_limit
    ORDER BY percentage_used DESC
  `;
  db.query(sql, [selectedMonth, req.userId, req.userId], (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json(results.map((row) => ({
      ...row,
      monthly_limit: parseFloat(row.monthly_limit),
      spent_amount: parseFloat(row.spent_amount),
      remaining_amount: parseFloat(row.remaining_amount),
      percentage_used: parseFloat(row.percentage_used),
    })));
  });
});

module.exports = router;
