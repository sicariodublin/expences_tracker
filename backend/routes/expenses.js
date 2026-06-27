const express = require("express");
const router = express.Router();
const { db, query } = require("../db");
const { authMiddleware } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validate");

router.get("/", authMiddleware, async (req, res) => {
  try {
    const { name, start, end } = req.query;
    let sql = "SELECT * FROM expenses";
    const conditions = ["user_id = ?"];
    const params = [req.userId];
    if (name) { conditions.push("LOWER(name) LIKE ?"); params.push(`%${name.toLowerCase()}%`); }
    if (start && end) { conditions.push("date BETWEEN ? AND ?"); params.push(start, end); }
    else if (start) { conditions.push("date >= ?"); params.push(start); }
    else if (end)   { conditions.push("date <= ?"); params.push(end); }
    sql += " WHERE " + conditions.join(" AND ") + " ORDER BY date DESC";
    const [rows] = await db.promise().query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching expenses:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/", authMiddleware, validate(schemas.transaction), (req, res) => {
  const { name, amount, date, category } = req.body;
  db.query(
    "INSERT INTO expenses (name, amount, date, category, user_id) VALUES (?, ?, ?, ?, ?)",
    [name, amount, date, category, req.userId],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json({ message: "Expense added", id: result.insertId });
    }
  );
});

router.put("/:id", authMiddleware, validate(schemas.transactionPatch), (req, res) => {
  const { name, amount, date, category } = req.body;
  const fields = [], params = [];
  if (name !== undefined)     { fields.push("name = ?");     params.push(name); }
  if (amount !== undefined)   { fields.push("amount = ?");   params.push(amount); }
  if (date !== undefined)     { fields.push("date = ?");     params.push(date); }
  if (category !== undefined) { fields.push("category = ?"); params.push(category); }
  params.push(req.params.id, req.userId);
  db.query(`UPDATE expenses SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`, params, (err) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json({ message: "Expense updated" });
  });
});

router.delete("/:id", authMiddleware, (req, res) => {
  db.query(
    "DELETE FROM expenses WHERE id = ? AND user_id = ?",
    [req.params.id, req.userId],
    (err) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json({ message: "Expense deleted" });
    }
  );
});

module.exports = router;
