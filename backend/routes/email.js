const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const { query } = require("../db");
const { authMiddleware } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validate");
const { encryptSecret, resolveUserTransporter, getEmailStatus, REPORT_FROM_EMAIL } = require("../utils/email");

router.get("/status", (req, res) => {
  res.json(getEmailStatus());
});

router.get("/settings", authMiddleware, async (req, res) => {
  try {
    const [[settings]] = await query(
      "SELECT provider, smtp_host, smtp_port, smtp_user, from_email FROM email_settings WHERE user_id = ?",
      [req.userId]
    );
    res.json(settings || {});
  } catch (err) {
    res.status(500).json({ error: "Failed to load email settings" });
  }
});

router.put("/settings", authMiddleware, validate(schemas.emailSettings), async (req, res) => {
  try {
    const { provider, smtp_host, smtp_port, smtp_user, smtp_pass, api_key, from_email } = req.body;
    const encPass = smtp_pass ? encryptSecret(smtp_pass) : null;
    const encKey  = api_key  ? encryptSecret(api_key)  : null;
    await query(
      `INSERT INTO email_settings (user_id, provider, smtp_host, smtp_port, smtp_user, smtp_pass, api_key, from_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE provider=VALUES(provider), smtp_host=VALUES(smtp_host), smtp_port=VALUES(smtp_port),
       smtp_user=VALUES(smtp_user), smtp_pass=VALUES(smtp_pass), api_key=VALUES(api_key), from_email=VALUES(from_email)`,
      [req.userId, provider, smtp_host, smtp_port, smtp_user, encPass, encKey, from_email]
    );
    res.json({ message: "Email settings saved" });
  } catch (err) {
    res.status(500).json({ error: "Failed to save email settings" });
  }
});

router.post("/test", authMiddleware, async (req, res) => {
  try {
    const to = req.body?.to;
    if (!to) return res.status(400).json({ error: "Recipient 'to' is required" });
    const transporter = await resolveUserTransporter(req.userId);
    if (!transporter) return res.status(400).json({ error: "Email not configured for user" });
    const [[settings]] = await query("SELECT from_email FROM email_settings WHERE user_id = ?", [req.userId]);
    const info = await transporter.sendMail({
      from: settings?.from_email || REPORT_FROM_EMAIL,
      to,
      subject: "Expense Tracker Email Test",
      text: "This is a test email from Expense Tracker backend.",
    });
    res.json({ message: "Test email sent", id: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) || null });
  } catch (err) {
    console.error("Error sending test email:", err);
    res.status(500).json({ error: "Failed to send test email" });
  }
});

module.exports = router;
