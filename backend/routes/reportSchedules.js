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
    await query(
      "UPDATE report_schedules SET recipient_email=?, format=?, frequency=?, include_budget_overview=?, include_trends=?, include_recurring=?, next_send_date=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?",
      [recipient_email, format, frequency, include_budget_overview, include_trends,
       include_recurring, next_send_date, is_active, req.params.id, req.userId]
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
    await sendScheduledReport(scheduleId);
    res.json({ message: "Report sent" });
  } catch (err) {
    res.status(500).json({ error: "Failed to send report" });
  }
});

module.exports = router;
