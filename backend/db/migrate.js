const path = require("path");
const fs = require("fs");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../../backend/.env") });
dotenv.config({ path: path.join(__dirname, "../../.env") });

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

// Errors that are safe to ignore when re-running migrations against an existing DB
const IGNORABLE = new Set([
  "ER_TABLE_EXISTS_ERROR", // 1050 — CREATE TABLE IF NOT EXISTS guard not universally supported
  "ER_DUP_FIELDNAME",      // 1060 — column already added by a previous run
  "ER_DUP_KEYNAME",        // 1061 — index already exists (MySQL has no CREATE INDEX IF NOT EXISTS)
]);

async function runStatements(conn, sql) {
  // Strip -- comments before splitting so a comment before a CREATE TABLE
  // doesn't cause the entire statement to be dropped by the filter
  const stripped = sql.replace(/--[^\n]*/g, "");
  const statements = stripped
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      await conn.query(stmt);
    } catch (err) {
      if (IGNORABLE.has(err.code)) continue;
      throw err;
    }
  }
}

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  try {
    await conn.execute(`CREATE TABLE IF NOT EXISTS migrations (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      name       VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const [rows] = await conn.execute(
        "SELECT id FROM migrations WHERE name = ?", [file]
      );
      if (rows.length > 0) {
        console.log(`  skip  ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      await runStatements(conn, sql);
      await conn.execute("INSERT INTO migrations (name) VALUES (?)", [file]);
      console.log(`  apply ${file}`);
    }

    console.log("Migrations complete.");
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
