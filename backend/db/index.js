const mysql = require("mysql2");

const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  connectTimeout: 5000,
  dateStrings: true,
};

let dbConnected = false;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createDbConnection = () => {
  const conn = mysql.createConnection(dbConfig);
  conn.on("error", () => { dbConnected = false; });
  return conn;
};

let db = createDbConnection();

const connectDbOnce = () =>
  new Promise((resolve, reject) => {
    db.connect((err) => {
      if (err) { reject(err); return; }
      dbConnected = true;
      console.log("Connected to MySQL");
      initAuthTables().catch((e) => console.error("Auth table init error:", e));
      resolve();
    });
  });

const dbReady = (async () => {
  while (!dbConnected) {
    try {
      await connectDbOnce();
      return true;
    } catch (err) {
      console.error("Database connection failed:", err.message);
      try { db.destroy(); } catch (_) {}
      db = createDbConnection();
      await sleep(1000);
    }
  }
  return true;
})();

const query = (sql, params = []) => db.promise().query(sql, params);

const USER_SCOPED_TABLES = [
  "expenses", "credits", "budget_goals",
  "expected_incomes", "recurring_transactions", "report_schedules",
];

const claimOrphanedData = async (userId) => {
  for (const table of USER_SCOPED_TABLES) {
    await query(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL`, [userId]);
  }
};

const maybeClaimOrphanedData = async (userId) => {
  const [[counts]] = await query(
    `SELECT
      (SELECT COUNT(*) FROM expenses WHERE user_id = ?) AS user_expenses,
      (SELECT COUNT(*) FROM credits WHERE user_id = ?) AS user_credits,
      (SELECT COUNT(*) FROM expenses WHERE user_id IS NULL) AS orphan_expenses,
      (SELECT COUNT(*) FROM credits WHERE user_id IS NULL) AS orphan_credits`,
    [userId, userId]
  );
  const userTotal = (Number(counts?.user_expenses) || 0) + (Number(counts?.user_credits) || 0);
  const orphanTotal = (Number(counts?.orphan_expenses) || 0) + (Number(counts?.orphan_credits) || 0);
  if (userTotal === 0 && orphanTotal > 0) await claimOrphanedData(userId);
};

const initAuthTables = async () => {
  try {
    await query(`CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS user_profiles (
      user_id INT PRIMARY KEY,
      first_name VARCHAR(100), last_name VARCHAR(100),
      date_of_birth DATE, currency VARCHAR(10),
      bank VARCHAR(100), avatar_url VARCHAR(255),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    await query(`CREATE TABLE IF NOT EXISTS email_settings (
      user_id INT PRIMARY KEY, provider VARCHAR(50) NOT NULL,
      smtp_host VARCHAR(150), smtp_port INT,
      smtp_user VARCHAR(150), smtp_pass TEXT,
      api_key TEXT, from_email VARCHAR(150),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    await query(`CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash VARCHAR(64) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_refresh_hash (token_hash),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    await query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash VARCHAR(64) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP NULL,
      UNIQUE KEY uq_reset_hash (token_hash),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    for (const table of USER_SCOPED_TABLES) {
      try {
        await query(`ALTER TABLE ${table} ADD COLUMN user_id INT NULL`);
      } catch (e) {
        if (e.code !== "ER_DUP_FIELDNAME") throw e;
      }
    }
    const [[{ cnt }]] = await query("SELECT COUNT(*) as cnt FROM users");
    if (cnt === 1) {
      const [[{ id }]] = await query("SELECT id FROM users LIMIT 1");
      for (const table of USER_SCOPED_TABLES) {
        await query(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL OR user_id != ?`, [id, id]);
      }
    }
  } catch (err) {
    console.error("Failed to init auth tables:", err);
  }
};

const waitForDbReady = async (timeoutMs = 8000) => {
  try {
    await Promise.race([
      dbReady,
      new Promise((_, reject) => setTimeout(() => reject(new Error("DB_NOT_READY")), timeoutMs)),
    ]);
    return true;
  } catch (_) {
    return false;
  }
};

module.exports = { db, query, dbReady, waitForDbReady, claimOrphanedData, maybeClaimOrphanedData, USER_SCOPED_TABLES };
