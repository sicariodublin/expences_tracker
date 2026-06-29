const { waitForDbReady, query, USER_SCOPED_TABLES } = require("../db");

beforeAll(async () => {
  const ready = await waitForDbReady(15000);
  if (!ready) throw new Error("Test database unavailable — check DB_* env vars in vitest.config.mjs");

  // Ensure tables that initAuthTables doesn't create
  await query(`CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    date DATE NOT NULL,
    category VARCHAR(100),
    user_id INT NULL
  )`);
  await query(`CREATE TABLE IF NOT EXISTS credits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    date DATE NOT NULL,
    category VARCHAR(100),
    user_id INT NULL
  )`);
  await query(`CREATE TABLE IF NOT EXISTS budget_goals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    monthly_limit DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    user_id INT NULL
  )`);
  await query(`CREATE TABLE IF NOT EXISTS expected_incomes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL
  )`);
  await query(`CREATE TABLE IF NOT EXISTS recurring_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL
  )`);
  await query(`CREATE TABLE IF NOT EXISTS report_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL
  )`);
});

afterEach(async () => {
  for (const table of USER_SCOPED_TABLES) {
    await query(`DELETE FROM ${table}`);
  }
  await query("DELETE FROM users");
  // user_profiles, email_settings, refresh_tokens, password_reset_tokens
  // are CASCADE deleted when users are deleted
});
