const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const { db, dbReady, waitForDbReady } = require("./db");
const { processRecurringTransactions, startRecurringJob } = require("./jobs/recurringTransactions");
const { initScheduleJobs } = require("./jobs/scheduledReports");

const app = express();

const defaultOrigins = [
  "http://localhost:3000", "http://127.0.0.1:3000",
  "http://localhost:5173", "http://127.0.0.1:5173",
];
const extraOrigins = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || defaultOrigins.includes(origin)) return cb(null, true);
    if (!extraOrigins.length || extraOrigins.includes(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 204,
}));
app.options("*", cors({ credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Block API requests until DB is ready
app.use(async (req, res, next) => {
  if (req.method === "OPTIONS" || !req.path.startsWith("/api/") || req.path === "/api/health") return next();
  if (!(await waitForDbReady())) return res.status(503).json({ error: "Database unavailable" });
  next();
});

// ── Routes ──────────────────────────────────────────────────────────────────
const budgetsRouter = require("./routes/budgets");

app.use("/api/auth",             require("./routes/auth"));
app.use("/api/expenses",         require("./routes/expenses"));
app.use("/api/credits",          require("./routes/credits"));
app.use("/api/budget-goals",     budgetsRouter);
app.use("/api",                  require("./routes/automation"));   // /api/expected-incomes, /api/recurring-transactions, /api/income-reconciliation
app.use("/api/reports",          require("./routes/reports"));      // /api/reports/export
app.use("/api/report-schedules", require("./routes/reportSchedules"));
app.use("/api/email",            require("./routes/email"));
app.use("/api/upload",           require("./routes/upload"));

// /api/budget-progress kept at original URL — forward into budgets router
app.get("/api/budget-progress", (req, res, next) => {
  req.url = "/progress";
  budgetsRouter(req, res, next);
});

// ── Health ───────────────────────────────────────────────────────────────────
app.get("/api/health", async (req, res) => {
  let dbOk = false;
  try { await db.promise().query("SELECT 1"); dbOk = true; } catch (_) {}
  const { getEmailStatus } = require("./utils/email");
  const { configured, verified } = getEmailStatus();
  res.json({ status: "ok", database: dbOk, emailConfigured: configured, emailVerified: verified });
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ────────────────────────────────────────────────────────────────────
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

  dbReady
    .then(async () => {
      await processRecurringTransactions();
      startRecurringJob();
      await initScheduleJobs();
    })
    .catch(() => {});
}
