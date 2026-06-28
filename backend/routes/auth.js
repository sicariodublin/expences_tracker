const crypto = require("crypto");
const express = require("express");
const router = express.Router();
const { query, claimOrphanedData, maybeClaimOrphanedData, USER_SCOPED_TABLES } = require("../db");
const {
  signJwt, hashPassword, verifyPassword, authMiddleware,
  generateRefreshToken, hashToken, REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTS,
} = require("../middleware/auth");
const { authLimiter, forgotLimiter } = require("../middleware/rateLimiter");
const { validate, schemas } = require("../middleware/validate");

// ── Helpers ──────────────────────────────────────────────────────────────────

async function issueTokens(res, userId, username) {
  const accessToken = signJwt({ userId, username });
  const refreshRaw = generateRefreshToken();
  await query(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))",
    [userId, hashToken(refreshRaw)]
  );
  res.cookie(REFRESH_COOKIE_NAME, refreshRaw, REFRESH_COOKIE_OPTS);
  return accessToken;
}

// ── Register ─────────────────────────────────────────────────────────────────

router.post("/register", authLimiter, validate(schemas.auth), async (req, res) => {
  try {
    const { username, password } = req.body;
    const [existing] = await query("SELECT id FROM users WHERE username = ?", [username]);
    if (existing.length) return res.status(409).json({ error: "Username already exists" });
    const password_hash = hashPassword(password);
    const [result] = await query(
      "INSERT INTO users (username, password_hash) VALUES (?, ?)", [username, password_hash]
    );
    const userId = result.insertId;
    await query("INSERT INTO user_profiles (user_id) VALUES (?)", [userId]);
    const [[{ cnt }]] = await query("SELECT COUNT(*) as cnt FROM users");
    if (cnt === 1) await claimOrphanedData(userId);
    const token = await issueTokens(res, userId, username);
    res.status(201).json({ token });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Failed to register" });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────

router.post("/login", authLimiter, validate(schemas.auth), async (req, res) => {
  try {
    const { username, password } = req.body;
    const [[user]] = await query("SELECT * FROM users WHERE username = ?", [username]);
    if (!user || !verifyPassword(password, user.password_hash))
      return res.status(401).json({ error: "Invalid credentials" });
    await maybeClaimOrphanedData(user.id);
    const token = await issueTokens(res, user.id, username);
    res.json({ token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Failed to login" });
  }
});

// ── Refresh ───────────────────────────────────────────────────────────────────

router.post("/refresh", async (req, res) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawToken) return res.status(401).json({ error: "No refresh token" });

    const tokenHash = hashToken(rawToken);
    const [[row]] = await query(
      "SELECT rt.*, u.username FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = ? AND rt.expires_at > NOW()",
      [tokenHash]
    );
    if (!row) {
      res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    // Rotate: delete old token, issue new one
    await query("DELETE FROM refresh_tokens WHERE token_hash = ?", [tokenHash]);
    const token = await issueTokens(res, row.user_id, row.username);
    res.json({ token });
  } catch (err) {
    console.error("Refresh error:", err);
    res.status(500).json({ error: "Failed to refresh token" });
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────

router.post("/logout", async (req, res) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (rawToken) {
      await query("DELETE FROM refresh_tokens WHERE token_hash = ?", [hashToken(rawToken)]);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
    res.json({ message: "Logged out" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: "Failed to logout" });
  }
});

// ── Forgot Password ───────────────────────────────────────────────────────────

router.post("/forgot-password", forgotLimiter, validate(schemas.forgotPassword), async (req, res) => {
  // Respond immediately — prevents email enumeration via timing
  res.json({ message: "If that email exists, a reset link has been sent." });

  try {
    const { email } = req.body;
    const [[user]] = await query("SELECT id, username FROM users WHERE username = ?", [email]);
    if (!user) return;

    // Invalidate any prior reset tokens for this user
    await query("DELETE FROM password_reset_tokens WHERE user_id = ?", [user.id]);

    const resetRaw = crypto.randomBytes(32).toString("hex");
    await query(
      "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))",
      [user.id, hashToken(resetRaw)]
    );

    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetRaw}`;

    const { resolveUserTransporter, REPORT_FROM_EMAIL } = require("../utils/email");
    const transporter = await resolveUserTransporter(user.id);
    if (!transporter) return;
    await transporter.sendMail({
      from: REPORT_FROM_EMAIL || "noreply@expense-tracker.local",
      to: email,
      subject: "Reset your Expense Tracker password",
      html: `<p>You requested a password reset.</p><p><a href="${resetUrl}">Click here to reset your password</a></p><p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
    });
  } catch (err) {
    console.error("Forgot-password error:", err);
  }
});

// ── Reset Password ────────────────────────────────────────────────────────────

router.post("/reset-password", validate(schemas.resetPassword), async (req, res) => {
  try {
    const { token, password } = req.body;
    const tokenHash = hashToken(token);
    const [[row]] = await query(
      "SELECT * FROM password_reset_tokens WHERE token_hash = ? AND expires_at > NOW() AND used_at IS NULL",
      [tokenHash]
    );
    if (!row) return res.status(400).json({ error: "Invalid or expired reset link." });

    await query("UPDATE users SET password_hash = ? WHERE id = ?", [hashPassword(password), row.user_id]);
    await query("UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = ?", [tokenHash]);
    // Revoke all refresh tokens so old sessions are invalidated
    await query("DELETE FROM refresh_tokens WHERE user_id = ?", [row.user_id]);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });

    res.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("Reset-password error:", err);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// ── Delete Account ────────────────────────────────────────────────────────────

router.delete("/account", authMiddleware, async (req, res) => {
  try {
    for (const table of USER_SCOPED_TABLES) {
      await query(`DELETE FROM ${table} WHERE user_id = ?`, [req.userId]);
    }
    // CASCADE handles user_profiles, email_settings, refresh_tokens, password_reset_tokens
    await query("DELETE FROM users WHERE id = ?", [req.userId]);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
    res.json({ message: "Account deleted" });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

// ── Profile ───────────────────────────────────────────────────────────────────

router.post("/claim-data", authMiddleware, async (req, res) => {
  try {
    await claimOrphanedData(req.userId);
    res.json({ message: "Orphaned data claimed", userId: req.userId });
  } catch (err) {
    console.error("Claim data error:", err);
    res.status(500).json({ error: "Failed to claim data" });
  }
});

router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const [[profile]] = await query("SELECT * FROM user_profiles WHERE user_id = ?", [req.userId]);
    res.json(profile || {});
  } catch (err) {
    res.status(500).json({ error: "Failed to load profile" });
  }
});

router.put("/profile", authMiddleware, validate(schemas.profile), async (req, res) => {
  try {
    const { first_name, last_name, date_of_birth, currency, bank, avatar_url } = req.body;
    await query(
      "UPDATE user_profiles SET first_name=?, last_name=?, date_of_birth=?, currency=?, bank=?, avatar_url=? WHERE user_id=?",
      [first_name, last_name, date_of_birth, currency, bank, avatar_url, req.userId]
    );
    res.json({ message: "Profile updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

module.exports = router;
