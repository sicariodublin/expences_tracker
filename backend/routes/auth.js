const express = require("express");
const router = express.Router();
const { query, claimOrphanedData, maybeClaimOrphanedData } = require("../db");
const { signJwt, hashPassword, verifyPassword, authMiddleware } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const { validate, schemas } = require("../middleware/validate");

router.post("/register", authLimiter, validate(schemas.auth), async (req, res) => {
  try {
    const { username, password } = req.body;
    const [existing] = await query("SELECT id FROM users WHERE username = ?", [username]);
    if (existing.length) return res.status(409).json({ error: "Username already exists" });
    const password_hash = hashPassword(password);
    const [result] = await query(
      "INSERT INTO users (username, password_hash) VALUES (?, ?)", [username, password_hash]
    );
    await query("INSERT INTO user_profiles (user_id) VALUES (?)", [result.insertId]);
    const [[{ cnt }]] = await query("SELECT COUNT(*) as cnt FROM users");
    if (cnt === 1) await claimOrphanedData(result.insertId);
    res.status(201).json({ token: signJwt({ userId: result.insertId, username }) });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Failed to register" });
  }
});

router.post("/login", authLimiter, validate(schemas.auth), async (req, res) => {
  try {
    const { username, password } = req.body;
    const [[user]] = await query("SELECT * FROM users WHERE username = ?", [username]);
    if (!user || !verifyPassword(password, user.password_hash))
      return res.status(401).json({ error: "Invalid credentials" });
    await maybeClaimOrphanedData(user.id);
    res.json({ token: signJwt({ userId: user.id, username }) });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Failed to login" });
  }
});

router.post("/logout", authMiddleware, (req, res) => {
  res.json({ message: "Logged out" });
});

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
