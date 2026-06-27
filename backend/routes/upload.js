const express = require("express");
const router = express.Router();
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const { db } = require("../db");
const { authMiddleware } = require("../middleware/auth");
const { normalizeBankRows } = require("../utils/csvNormalizer");

const upload = multer({ dest: "uploads/" });

router.post("/", authMiddleware, upload.single("file"), (req, res, next) => {
  const filePath = req.file.path;
  const rows = [];

  fs.createReadStream(filePath)
    .pipe(csv({
      mapHeaders: ({ header }) => (header ? header.trim() : header),
      mapValues: ({ value }) => (typeof value === "string" ? value.trim() : value),
    }))
    .on("data", (data) => rows.push(data))
    .on("end", async () => {
      const normalized = normalizeBankRows(rows);
      const dryRun = String(req.query.dryRun || "").toLowerCase() === "true";

      if (dryRun) {
        fs.unlink(filePath, () => {});
        return res.json({
          message: "Dry run completed",
          imported: normalized.length,
          expenses: normalized.filter((i) => i.type !== "income").length,
          incomes: normalized.filter((i) => i.type === "income").length,
          duplicates: 0,
        });
      }

      let expensesCount = 0, incomeCount = 0, duplicates = 0;
      try {
        await db.promise().beginTransaction();
        for (const item of normalized) {
          const name = item.name || "Unnamed";
          const amount = item.amount || 0;
          const date = item.date;
          const category = item.category || (item.type === "income" ? "Income" : "Uncategorized");
          const table = item.type === "income" ? "credits" : "expenses";

          const [existing] = await db.promise().query(
            `SELECT id FROM ${table} WHERE user_id = ? AND name = ? AND amount = ? AND date = ? LIMIT 1`,
            [req.userId, name, amount, date]
          );
          if (existing.length) { duplicates++; continue; }

          await db.promise().query(
            `INSERT INTO ${table} (name, amount, date, category, user_id) VALUES (?, ?, ?, ?, ?)`,
            [name, amount, date, category, req.userId]
          );
          item.type === "income" ? incomeCount++ : expensesCount++;
        }
        await db.promise().commit();
      } catch (err) {
        try { await db.promise().rollback(); } catch (_) {}
        console.error("Error importing CSV:", err);
        fs.unlink(filePath, () => {});
        return next(err);
      }

      fs.unlink(filePath, () => {});
      res.json({
        message: "Import completed",
        imported: normalized.length - duplicates,
        expenses: expensesCount,
        incomes: incomeCount,
        duplicates,
      });
    });
});

module.exports = router;
