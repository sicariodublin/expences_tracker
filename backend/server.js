const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const dotenv = require("dotenv");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const nodemailer = require("nodemailer");
const cron = require("node-cron");
const dayjs = require("dayjs");
const crypto = require("crypto");
const { normalizeBankRows } = require("./utils/csvNormalizer");

dotenv.config();

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (!allowedOrigins.length || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      cb(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "change-me-secret";
const EMAIL_SECRET_KEY = process.env.EMAIL_SECRET_KEY || null;

const toB64Url = (buf) => Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const fromB64Url = (str) => Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64");

const signJwt = (payload) => {
  const header = toB64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = toB64Url(JSON.stringify(payload));
  const sig = toB64Url(
    crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${sig}`;
};

const verifyJwt = (token) => {
  try {
    const [h, b, s] = token.split(".");
    const expected = toB64Url(
      crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${b}`).digest()
    );
    if (expected !== s) return null;
    return JSON.parse(fromB64Url(b).toString("utf8"));
  } catch (_) {
    return null;
  }
};

const hashPassword = (password, salt = crypto.randomBytes(16).toString("hex")) => {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password, stored) => {
  const [salt, hash] = String(stored).split(":");
  const candidate = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
};

const encryptSecret = (plain) => {
  if (!EMAIL_SECRET_KEY) return plain;
  const key = crypto.createHash("sha256").update(EMAIL_SECRET_KEY).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
};

const decryptSecret = (blob) => {
  if (!EMAIL_SECRET_KEY) return blob;
  try {
    const buf = Buffer.from(blob, "base64");
    const iv = buf.slice(0, 12);
    const tag = buf.slice(12, 28);
    const enc = buf.slice(28);
    const key = crypto.createHash("sha256").update(EMAIL_SECRET_KEY).digest();
    const dec = crypto.createDecipheriv("aes-256-gcm", key, iv);
    dec.setAuthTag(tag);
    const out = Buffer.concat([dec.update(enc), dec.final()]).toString("utf8");
    return out;
  } catch (_) {
    return null;
  }
};

const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const payload = verifyJwt(token);
  if (!payload || !payload.userId) return res.status(401).json({ error: "Invalid token" });
  req.userId = payload.userId;
  next();
};



// MySQL Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  dateStrings: true, // Ensure date strings are returned as strings
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }
  console.log("Connected to MySQL");
});

const query = (sql, params = []) => db.promise().query(sql, params);

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
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      date_of_birth DATE,
      currency VARCHAR(10),
      bank VARCHAR(100),
      avatar_url VARCHAR(255),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    await query(`CREATE TABLE IF NOT EXISTS email_settings (
      user_id INT PRIMARY KEY,
      provider VARCHAR(50) NOT NULL,
      smtp_host VARCHAR(150),
      smtp_port INT,
      smtp_user VARCHAR(150),
      smtp_pass TEXT,
      api_key TEXT,
      from_email VARCHAR(150),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    const [cols] = await query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'report_schedules' AND COLUMN_NAME = 'user_id'`,
      [process.env.DB_NAME]
    );
    if (!cols || cols.length === 0) {
      await query(`ALTER TABLE report_schedules ADD COLUMN user_id INT NULL`);
    }
  } catch (err) {
    console.error("Failed to init auth tables:", err);
  }
};

const hasEmailConfig =
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS;
const EMAIL_DEV_MODE = process.env.EMAIL_DEV_MODE || ""; // set to "ethereal" to use test SMTP

let mailTransporter = null;
let lastEmailVerifyError = null;

if (hasEmailConfig) {
  mailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
} else {
  console.warn(
    "Email transporter not configured globally. Per-user settings or Ethereal dev mode will be used."
  );
}

const REPORT_FROM_EMAIL =
  process.env.REPORT_FROM_EMAIL || process.env.SMTP_USER || "reports@tracker";

let emailVerified = true;
if (mailTransporter && process.env.SMTP_VERIFY === "true") {
  mailTransporter
    .verify()
    .then(() => {
      emailVerified = true;
      console.log("SMTP transport verified successfully");
    })
    .catch((err) => {
      emailVerified = false;
      lastEmailVerifyError = (err && err.response) || err?.message || String(err);
      console.error("SMTP transport verification failed:", err);
    });
}

const roundToTwo = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const formatDate = (date) => dayjs(date).format("YYYY-MM-DD");

const calculateNextRunDate = (transaction, baseDate) => {
  const reference = baseDate ? dayjs(baseDate) : dayjs();
  const dayOfMonth = transaction.day_of_month;
  const weekday = transaction.weekday;

  const alignToWeekday = (date, targetWeekday) => {
    if (typeof targetWeekday !== "number") {
      return date;
    }
    let aligned = date;
    while (aligned.day() !== targetWeekday) {
      aligned = aligned.add(1, "day");
    }
    return aligned;
  };

  const addMonthsClamped = (date, monthsToAdd) => {
    let next = date.add(monthsToAdd, "month");
    if (dayOfMonth) {
      const cappedDay = Math.min(dayOfMonth, next.daysInMonth());
      next = next.date(cappedDay);
    }
    return next;
  };

  switch (transaction.frequency) {
    case "weekly": {
      const next = reference.add(7, "day");
      return alignToWeekday(next, weekday);
    }
    case "biweekly": {
      const next = reference.add(14, "day");
      return alignToWeekday(next, weekday);
    }
    case "quarterly":
      return addMonthsClamped(reference, 3);
    case "yearly":
      return addMonthsClamped(reference, 12);
    case "monthly":
    default:
      return addMonthsClamped(reference, 1);
  }
};

const resolveRange = (startDate, endDate) => {
  let start = startDate ? dayjs(startDate) : dayjs().startOf("month");
  let end = endDate ? dayjs(endDate) : dayjs().endOf("month");

  if (!start.isValid() || !end.isValid()) {
    throw new Error("Invalid date range supplied.");
  }

  if (end.isBefore(start)) {
    [start, end] = [end, start];
  }

  return {
    start: start.startOf("day"),
    end: end.endOf("day"),
  };
};

const fetchReportData = async (start, end) => {
  const startStr = start.format("YYYY-MM-DD");
  const endStr = end.format("YYYY-MM-DD");

  const [expenses] = await query(
    "SELECT id, name, amount, date, category FROM expenses WHERE date BETWEEN ? AND ? ORDER BY date ASC",
    [startStr, endStr]
  );

  const [credits] = await query(
    "SELECT id, name, amount, date, category FROM credits WHERE date BETWEEN ? AND ? ORDER BY date ASC",
    [startStr, endStr]
  );

  const [budgetGoals] = await query(
    "SELECT category, monthly_limit FROM budget_goals WHERE is_active = TRUE"
  );

  const [recurring] = await query(
    "SELECT * FROM recurring_transactions WHERE is_active = TRUE ORDER BY next_run_date ASC"
  );

  const totals = {
    totalExpenses: expenses.reduce(
      (sum, item) => sum + parseFloat(item.amount || 0),
      0
    ),
    totalCredits: credits.reduce(
      (sum, item) => sum + parseFloat(item.amount || 0),
      0
    ),
  };

  totals.balance = totals.totalCredits - totals.totalExpenses;

  return {
    startDate: startStr,
    endDate: endStr,
    generatedAt: dayjs().format("YYYY-MM-DD HH:mm"),
    totals: {
      totalExpenses: roundToTwo(totals.totalExpenses),
      totalCredits: roundToTwo(totals.totalCredits),
      balance: roundToTwo(totals.balance),
    },
    expenses,
    credits,
    budgetGoals,
    recurring,
  };
};

const euro = (n) => `€${(parseFloat(n) || 0).toFixed(2)}`;
const heading = (doc, text) => {
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.fontSize(14).text(text, doc.page.margins.left, doc.y, { underline: true, align: "center", width: contentWidth });
  doc.y += 6;
};
const drawTable = (doc, headers, rows, widths) => {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  let y = doc.y;
  const rowH = 18;
  doc.fontSize(11).font("Helvetica-Bold");
  let x = left;
  headers.forEach((h, i) => {
    doc.text(h, x, y, { width: widths[i], align: i === headers.length - 1 ? "right" : "left" });
    x += widths[i];
  });
  y += rowH;
  doc.font("Helvetica");
  for (const row of rows) {
    if (y + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      x = left;
      doc.font("Helvetica-Bold");
      headers.forEach((h, i) => {
        doc.text(h, x, y, { width: widths[i], align: i === headers.length - 1 ? "right" : "left" });
        x += widths[i];
      });
      y += rowH;
      doc.font("Helvetica");
    }
    x = left;
    row.forEach((cell, i) => {
      doc.text(String(cell), x, y, { width: widths[i], align: i === row.length - 1 ? "right" : "left", ellipsis: true });
      x += widths[i];
    });
    y += rowH;
  }
  doc.y = y + 8;
};

const generatePdfReport = (reportData, options = {}) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const buffers = [];
    doc.on("data", (buffer) => buffers.push(buffer));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    doc.fontSize(20).text("Expense Tracker Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Period: ${reportData.startDate} - ${reportData.endDate}`);
    doc.text(`Generated: ${reportData.generatedAt}`);
    doc.moveDown();

    if (options.includeTrends !== false) {
      heading(doc, "Summary");
      const summaryRows = [
        ["Total Income", euro(reportData.totals.totalCredits)],
        ["Total Expenses", euro(reportData.totals.totalExpenses)],
        ["Balance", euro(reportData.totals.balance)],
      ];
      drawTable(doc, ["Metric", "Value"], summaryRows, [300, 215]);
    }

    heading(doc, "Expenses");
    if (reportData.expenses.length) {
      const expRows = reportData.expenses.map((e) => [e.date, e.name, e.category, euro(e.amount)]);
      drawTable(doc, ["Date", "Name", "Category", "Amount"], expRows, [90, 235, 110, 80]);
    } else {
      doc.fontSize(11).text("No expenses recorded in this period.");
    }

    heading(doc, "Income");
    if (reportData.credits.length) {
      const incRows = reportData.credits.map((c) => [c.date, c.name, c.category, euro(c.amount)]);
      drawTable(doc, ["Date", "Source", "Category", "Amount"], incRows, [90, 235, 110, 80]);
    } else {
      doc.fontSize(11).text("No income recorded in this period.");
    }

    if (options.includeBudget !== false) {
      heading(doc, "Active Budget Goals");
      if (reportData.budgetGoals.length) {
        const bgRows = reportData.budgetGoals.map((g) => [g.category, parseFloat(g.monthly_limit)]);
        const bgFmt = bgRows.map((r) => [r[0], euro(r[1])]);
        drawTable(doc, ["Category", "Monthly Limit"], bgFmt, [350, 165]);
      } else {
        doc.fontSize(11).text("No active budget goals.");
      }
    }

    if (options.includeRecurring !== false) {
      heading(doc, "Active Recurring Transactions");
      if (reportData.recurring.length) {
        const recRows = reportData.recurring.map((t) => [
          String(t.type).toUpperCase(),
          t.name,
          euro(t.amount),
          t.frequency,
          t.next_run_date,
        ]);
        drawTable(doc, ["Type", "Name", "Amount", "Frequency", "Next"], recRows, [60, 225, 80, 90, 60]);
      } else {
        doc.fontSize(11).text("No active recurring transactions.");
      }
    }

    doc.end();
  });

const generateExcelReport = async (reportData, options = {}) => {
  const workbook = new ExcelJS.Workbook();
  const summarySheet = options.includeTrends !== false ? workbook.addWorksheet("Summary") : null;
  const expensesSheet = workbook.addWorksheet("Expenses");
  const incomeSheet = workbook.addWorksheet("Income");
  const recurringSheet = options.includeRecurring !== false ? workbook.addWorksheet("Recurring") : null;
  const budgetSheet = options.includeBudget !== false ? workbook.addWorksheet("Budget") : null;

  if (summarySheet) {
    summarySheet.columns = [
      { header: "Metric", key: "metric", width: 30 },
      { header: "Value", key: "value", width: 20 },
    ];
    summarySheet.addRows([
      { metric: "Period Start", value: reportData.startDate },
      { metric: "Period End", value: reportData.endDate },
      { metric: "Generated At", value: reportData.generatedAt },
      { metric: "Total Income", value: reportData.totals.totalCredits },
      { metric: "Total Expenses", value: reportData.totals.totalExpenses },
      { metric: "Balance", value: reportData.totals.balance },
    ]);
  }

  const addSheetData = (sheet, rows) => {
    if (!rows.length) {
      sheet.addRow(["No data available"]);
      return;
    }
    sheet.columns = Object.keys(rows[0]).map((key) => ({
      header: key,
      key,
      width: 20,
    }));
    rows.forEach((row) => sheet.addRow(row));
  };

  addSheetData(expensesSheet, reportData.expenses);
  addSheetData(incomeSheet, reportData.credits);
  if (recurringSheet) addSheetData(recurringSheet, reportData.recurring);
  if (budgetSheet) {
    budgetSheet.columns = [
      { header: "Category", key: "category", width: 30 },
      { header: "Monthly Limit", key: "monthly_limit", width: 20 },
    ];
    reportData.budgetGoals.forEach((goal) =>
      budgetSheet.addRow({
        category: goal.category,
        monthly_limit: parseFloat(goal.monthly_limit),
      })
    );
    if (!reportData.budgetGoals.length) {
      budgetSheet.addRow(["No active budget goals"]);
    }
  }

  return workbook.xlsx.writeBuffer();
};

const processRecurringTransactions = async () => {
  try {
    const today = dayjs().startOf("day");
    const [transactions] = await query(
      "SELECT * FROM recurring_transactions WHERE is_active = TRUE AND next_run_date <= ?",
      [today.format("YYYY-MM-DD")]
    );

    if (!transactions.length) {
      return;
    }

    for (const tx of transactions) {
      const table = tx.type === "expense" ? "expenses" : "credits";
      await query(
        `INSERT INTO ${table} (name, amount, date, category) VALUES (?, ?, ?, ?)`,
        [tx.name, tx.amount, today.format("YYYY-MM-DD"), tx.category]
      );

      const nextRun = calculateNextRunDate(tx, today);

      await query(
        "UPDATE recurring_transactions SET last_run_date = ?, next_run_date = ? WHERE id = ?",
        [
          today.format("YYYY-MM-DD"),
          nextRun.format("YYYY-MM-DD"),
          tx.id,
        ]
      );
    }

    console.log(`Processed ${transactions.length} recurring transactions.`);
  } catch (error) {
    console.error("Error processing recurring transactions:", error);
  }
};

const scheduleTasks = new Map();
const SEND_TIME = (process.env.REPORT_SEND_TIME || "06:15").split(":");
const SEND_HOUR = Number(SEND_TIME[0]);
const SEND_MINUTE = Number(SEND_TIME[1]);

const resolveUserTransporter = async (userId) => {
  if (EMAIL_DEV_MODE === "ethereal") {
    if (!mailTransporter) {
      const account = await nodemailer.createTestAccount();
      mailTransporter = nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      });
    }
    return mailTransporter;
  }
  if (!userId) return mailTransporter;
  try {
    const [[settings]] = await query("SELECT * FROM email_settings WHERE user_id = ?", [userId]);
    if (!settings) return mailTransporter;
    const provider = settings.provider;
    if (provider === "sendgrid" && settings.api_key) {
      const pass = decryptSecret(settings.api_key) || settings.api_key;
      return nodemailer.createTransport({ host: "smtp.sendgrid.net", port: 587, secure: false, auth: { user: "apikey", pass } });
    }
    if (provider === "smtp" && settings.smtp_host && settings.smtp_user && settings.smtp_port && settings.smtp_pass) {
      const pass = decryptSecret(settings.smtp_pass) || settings.smtp_pass;
      return nodemailer.createTransport({ host: settings.smtp_host, port: Number(settings.smtp_port), secure: Number(settings.smtp_port) === 465, auth: { user: settings.smtp_user, pass } });
    }
    if (provider === "outlook") {
      const pass = decryptSecret(settings.smtp_pass) || settings.smtp_pass;
      return nodemailer.createTransport({ host: "smtp.office365.com", port: 587, secure: false, auth: { user: settings.smtp_user, pass } });
    }
    return mailTransporter;
  } catch (_) {
    return mailTransporter;
  }
};

const sendScheduledReport = async (scheduleId) => {
  const [[schedule]] = await query(
    "SELECT * FROM report_schedules WHERE id = ? AND is_active = TRUE",
    [scheduleId]
  );
  if (!schedule) return;
  const transporter = await resolveUserTransporter(schedule.user_id);
  if (!transporter) return;
  try {
    const isWeekly = schedule.frequency === "weekly";
    const rangeStart = isWeekly
      ? dayjs().subtract(1, "week").startOf("week")
      : dayjs().subtract(1, "month").startOf("month");
    const rangeEnd = isWeekly
      ? dayjs().subtract(1, "week").endOf("week")
      : dayjs().subtract(1, "month").endOf("month");
    const reportData = await fetchReportData(rangeStart, rangeEnd);

    const isExcel = schedule.format === "excel";
    const buffer = isExcel
      ? await generateExcelReport(reportData, {
          includeBudget: schedule.include_budget_overview,
          includeTrends: schedule.include_trends,
          includeRecurring: schedule.include_recurring,
        })
      : await generatePdfReport(reportData, {
          includeBudget: schedule.include_budget_overview,
          includeTrends: schedule.include_trends,
          includeRecurring: schedule.include_recurring,
        });

    const extension = isExcel ? "xlsx" : "pdf";
    const filenameBase = isWeekly
      ? `week-${rangeStart.format("YYYY-MM-DD")}`
      : rangeStart.format("YYYY-MM");
    const filename = `expense-report-${filenameBase}.${extension}`;

    await transporter.sendMail({
      from: REPORT_FROM_EMAIL,
      to: schedule.recipient_email,
      subject: isWeekly
        ? `Expense Tracker Summary - Week of ${rangeStart.format("MMM D, YYYY")}`
        : `Expense Tracker Summary - ${rangeStart.format("MMMM YYYY")}`,
      text: `Attached is your scheduled ${schedule.format.toUpperCase()} report.`,
      attachments: [{ filename, content: buffer }],
    });

    const nextSend = isWeekly
      ? dayjs(schedule.next_send_date).add(1, "week")
      : dayjs(schedule.next_send_date).add(1, "month");

    await query(
      "UPDATE report_schedules SET last_sent_at = ?, next_send_date = ? WHERE id = ?",
      [dayjs().format("YYYY-MM-DD HH:mm:ss"), nextSend.format("YYYY-MM-DD"), schedule.id]
    );

    const updated = { ...schedule, next_send_date: nextSend.format("YYYY-MM-DD") };
    scheduleReportJob(updated);
  } catch (error) {
    console.error("Error sending scheduled report:", error);
  }
};

const scheduleReportJob = (schedule) => {
  const existing = scheduleTasks.get(schedule.id);
  if (existing) existing.stop();
  const baseDate = dayjs(schedule.next_send_date);
  const expr = schedule.frequency === "weekly"
    ? `${SEND_MINUTE} ${SEND_HOUR} * * ${baseDate.day()}`
    : `${SEND_MINUTE} ${SEND_HOUR} ${baseDate.date()} * *`;
  const job = cron.schedule(expr, () => sendScheduledReport(schedule.id));
  scheduleTasks.set(schedule.id, job);
};

const initScheduleJobs = async () => {
  const [rows] = await query(
    "SELECT * FROM report_schedules WHERE is_active = TRUE"
  );
  rows.forEach(scheduleReportJob);
};

processRecurringTransactions();
cron.schedule("5 3 * * *", processRecurringTransactions);
initScheduleJobs();
initAuthTables();

app.get("/api/health", async (req, res, next) => {
  try {
    let dbOk = false;
    try {
      await db.promise().query("SELECT 1");
      dbOk = true;
    } catch (_) {
      dbOk = false;
    }
    res.json({ status: "ok", database: dbOk, emailConfigured: !!mailTransporter, emailVerified });
  } catch (err) {
    next(err);
  }
});

app.get("/api/email/status", (req, res) => {
  const transportInfo = mailTransporter && mailTransporter.options
    ? {
        host: mailTransporter.options.host,
        port: mailTransporter.options.port,
        secure: !!mailTransporter.options.secure,
      }
    : null;
  res.json({
    configured: !!mailTransporter,
    verified: emailVerified,
    transport: transportInfo,
    devMode: EMAIL_DEV_MODE || null,
    error: lastEmailVerifyError,
  });
});

app.post("/api/email/test", authMiddleware, async (req, res) => {
  try {
    const to = req.body?.to;
    if (!to) {
      return res.status(400).json({ error: "Recipient 'to' is required" });
    }
    const transporter = await resolveUserTransporter(req.userId);
    if (!transporter) {
      return res.status(400).json({ error: "Email not configured for user" });
    }
    const [[settings]] = await query("SELECT from_email FROM email_settings WHERE user_id = ?", [req.userId]);
    const fromAddr = settings?.from_email || REPORT_FROM_EMAIL;
    const info = await transporter.sendMail({
      from: fromAddr,
      to,
      subject: "Expense Tracker Email Test",
      text: "This is a test email from Expense Tracker backend.",
    });
    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    res.json({ message: "Test email sent", id: info.messageId, previewUrl });
  } catch (err) {
    console.error("Error sending test email:", err);
    res.status(500).json({ error: "Failed to send test email" });
  }
});

// Auth: register/login
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    const [existing] = await query("SELECT id FROM users WHERE username = ?", [username]);
    if (existing.length) return res.status(409).json({ error: "Username already exists" });
    const password_hash = hashPassword(password);
    const [result] = await query("INSERT INTO users (username, password_hash) VALUES (?, ?)", [username, password_hash]);
    await query("INSERT INTO user_profiles (user_id) VALUES (?)", [result.insertId]);
    const token = signJwt({ userId: result.insertId, username });
    res.status(201).json({ token });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Failed to register" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    const [[user]] = await query("SELECT * FROM users WHERE username = ?", [username]);
    if (!user) {
      const password_hash = hashPassword(password);
      const [result] = await query("INSERT INTO users (username, password_hash) VALUES (?, ?)", [username, password_hash]);
      await query("INSERT INTO user_profiles (user_id) VALUES (?)", [result.insertId]);
      const token = signJwt({ userId: result.insertId, username });
      return res.status(201).json({ token, created: true });
    }
    if (!verifyPassword(password, user.password_hash)) return res.status(401).json({ error: "Invalid credentials" });
    const token = signJwt({ userId: user.id, username });
    res.json({ token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Failed to login" });
  }
});

// Profile
app.get("/api/profile", authMiddleware, async (req, res) => {
  try {
    const [[profile]] = await query("SELECT * FROM user_profiles WHERE user_id = ?", [req.userId]);
    res.json(profile || {});
  } catch (err) {
    console.error("Profile load error:", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});


app.put("/api/profile", authMiddleware, async (req, res) => {
  try {
    const { first_name, last_name, date_of_birth, currency, bank, avatar_url } = req.body;
    await query(
      `UPDATE user_profiles SET first_name = ?, last_name = ?, date_of_birth = ?, currency = ?, bank = ?, avatar_url = ? WHERE user_id = ?`,
      [first_name, last_name, date_of_birth, currency, bank, avatar_url, req.userId]
    );
    res.json({ message: "Profile updated" });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// Email settings per user
app.get("/api/email/settings", authMiddleware, async (req, res) => {
  try {
    const [[settings]] = await query("SELECT provider, smtp_host, smtp_port, smtp_user, from_email FROM email_settings WHERE user_id = ?", [req.userId]);
    res.json(settings || {});
  } catch (err) {
    console.error("Load email settings error:", err);
    res.status(500).json({ error: "Failed to load email settings" });
  }
});

app.put("/api/email/settings", authMiddleware, async (req, res) => {
  try {
    const { provider, smtp_host, smtp_port, smtp_user, smtp_pass, api_key, from_email } = req.body;
    const encPass = smtp_pass ? encryptSecret(smtp_pass) : null;
    const encKey = api_key ? encryptSecret(api_key) : null;
    await query(
      `INSERT INTO email_settings (user_id, provider, smtp_host, smtp_port, smtp_user, smtp_pass, api_key, from_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE provider = VALUES(provider), smtp_host = VALUES(smtp_host), smtp_port = VALUES(smtp_port), smtp_user = VALUES(smtp_user), smtp_pass = VALUES(smtp_pass), api_key = VALUES(api_key), from_email = VALUES(from_email)`,
      [req.userId, provider, smtp_host, smtp_port, smtp_user, encPass, encKey, from_email]
    );
    res.json({ message: "Email settings saved" });
  } catch (err) {
    console.error("Save email settings error:", err);
    res.status(500).json({ error: "Failed to save email settings" });
  }
});

app.post("/api/report-schedules/:id/send-now", async (req, res) => {
  try {
    const scheduleId = Number(req.params.id);
    if (!Number.isFinite(scheduleId)) {
      return res.status(400).json({ error: "Invalid schedule id" });
    }
    await sendScheduledReport(scheduleId);
    res.json({ message: "Report sent" });
  } catch (err) {
    console.error("Error in send-now:", err);
    res.status(500).json({ error: "Failed to send report now" });
  }
});

// Add Expense
app.post("/api/expenses", (req, res) => {
  const { name, amount, date, category } = req.body;
  if (!name || !amount || !date || !category) {
    return res
      .status(400)
      .json({ error: "All fields are required, including category" });
  }
  const query =
    "INSERT INTO expenses (name, amount, date, category) VALUES (?, ?, ?, ?)";
  db.query(query, [name, amount, date, category], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Expense added", id: result.insertId });
  });
});

// Get Expenses (with Filters)
app.get("/api/expenses", async (req, res) => {
  try {
    const { name, start, end } = req.query;
    let query = "SELECT * FROM expenses";
    const conditions = [];
    const params = [];

    if (name) {
      conditions.push("LOWER(name) LIKE ?");
      params.push(`%${name.toLowerCase()}%`);
    }
    if (start && end) {
      conditions.push("date BETWEEN ? AND ?");
      params.push(start, end);
    } else if (start) {
      conditions.push("date >= ?");
      params.push(start);
    } else if (end) {
      conditions.push("date <= ?");
      params.push(end);
    }

    if (conditions.length) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY date DESC";

    const [rows] = await db.promise().query(query, params);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching expenses:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Delete Expense
app.delete("/api/expenses/:id", (req, res) => {
  const query = "DELETE FROM expenses WHERE id = ?";
  db.query(query, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Expense deleted" });
  });
});

// Update Expense
app.put("/api/expenses/:id", (req, res) => {
  const { name, amount, date, category } = req.body;
  const fields = [];
  const params = [];

  if (name !== undefined) {
    fields.push("name = ?");
    params.push(name);
  }
  if (amount !== undefined) {
    fields.push("amount = ?");
    params.push(amount);
  }
  if (date !== undefined) {
    fields.push("date = ?");
    params.push(date);
  }
  if (category !== undefined) {
    fields.push("category = ?");
    params.push(category);
  }

  if (!fields.length) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  const query = `UPDATE expenses SET ${fields.join(", ")} WHERE id = ?`;
  params.push(req.params.id);

  db.query(query, params, (err) => {
    if (err) {
      console.error("Error updating expense:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json({ message: "Expense updated" });
  });
});

// Get all credits
/* app.get("/api/expenses", async (req, res) => {
  const { startDate, endDate, name } = req.query;

  let query = "SELECT * FROM expenses WHERE 1=1";
  let params = [];

  if (startDate && endDate) {
    query += " AND date BETWEEN ? AND ?";
    params.push(startDate, endDate);
  }

  if (name) {
    query += " AND LOWER(name) LIKE ?";
    params.push(`%${name.toLowerCase()}%`);
  }

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("Error fetching expenses:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
}); */

// Add a new credit
app.post("/api/credits", async (req, res) => {
  const { name, amount, date, category } = req.body;

  if (!name || !amount || !date || !category) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const query =
      "INSERT INTO credits (name, amount, date, category) VALUES (?, ?, ?, ?)";
    db.query(query, [name, amount, date, category], (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Database error" });
      }
      res.status(201).json({ message: "Credit added successfully!" });
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/credits", async (req, res) => {
  try {
    const { name, start, end } = req.query;
    let query = "SELECT * FROM credits";
    const conditions = [];
    const params = [];

    if (name) {
      conditions.push("LOWER(name) LIKE ?");
      params.push(`%${name.toLowerCase()}%`);
    }
    if (start && end) {
      conditions.push("date BETWEEN ? AND ?");
      params.push(start, end);
    } else if (start) {
      conditions.push("date >= ?");
      params.push(start);
    } else if (end) {
      conditions.push("date <= ?");
      params.push(end);
    }

    if (conditions.length) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY date DESC";

    const [rows] = await db.promise().query(query, params);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching credits:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete a credit
app.delete("/api/credits/:id", (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM credits WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Credit deleted successfully!" });
  });
});

// Update Credit
app.put("/api/credits/:id", (req, res) => {
  const { name, amount, date, category } = req.body;
  const fields = [];
  const params = [];

  if (name !== undefined) {
    fields.push("name = ?");
    params.push(name);
  }
  if (amount !== undefined) {
    fields.push("amount = ?");
    params.push(amount);
  }
  if (date !== undefined) {
    fields.push("date = ?");
    params.push(date);
  }
  if (category !== undefined) {
    fields.push("category = ?");
    params.push(category);
  }

  if (!fields.length) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  const query = `UPDATE credits SET ${fields.join(", ")} WHERE id = ?`;
  params.push(req.params.id);

  db.query(query, params, (err) => {
    if (err) {
      console.error("Error updating credit:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json({ message: "Credit updated" });
  });
});

// Get all budget goals
app.get("/api/budget-goals", (req, res) => {
  const query =
    "SELECT * FROM budget_goals WHERE is_active = TRUE ORDER BY category";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching budget goals:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// Add new budget goal
app.post("/api/budget-goals", (req, res) => {
  const { category, monthly_limit } = req.body;
  if (!category || !monthly_limit) {
    return res
      .status(400)
      .json({ error: "Category and monthly limit are required" });
  }

  const query =
    "INSERT INTO budget_goals (category, monthly_limit) VALUES (?, ?)";
  db.query(query, [category, monthly_limit], (err, result) => {
    if (err) {
      console.error("Error adding budget goal:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json({ message: "Budget goal added", id: result.insertId });
  });
});

// Update budget goal
app.put("/api/budget-goals/:id", (req, res) => {
  const { category, monthly_limit } = req.body;
  const { id } = req.params;

  const query =
    "UPDATE budget_goals SET category = ?, monthly_limit = ? WHERE id = ?";
  db.query(query, [category, monthly_limit, id], (err, result) => {
    if (err) {
      console.error("Error updating budget goal:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json({ message: "Budget goal updated" });
  });
});

// Delete budget goal
app.delete("/api/budget-goals/:id", (req, res) => {
  const query = "UPDATE budget_goals SET is_active = FALSE WHERE id = ?";
  db.query(query, [req.params.id], (err, result) => {
    if (err) {
      console.error("Error deleting budget goal:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json({ message: "Budget goal deleted" });
  });
});

// Get budget progress for current month
app.get("/api/budget-progress", (req, res) => {
  const selectedMonth =
    req.query.month || new Date().toISOString().split("T")[0];

  const query = `
     SELECT 
      bg.id,
      bg.category,
      CAST(bg.monthly_limit AS DECIMAL(10,2)) as monthly_limit,
      CAST(COALESCE(SUM(e.amount), 0) AS DECIMAL(10,2)) as spent_amount,
      CAST((bg.monthly_limit - COALESCE(SUM(e.amount), 0)) AS DECIMAL(10,2)) as remaining_amount,
      CAST(ROUND((COALESCE(SUM(e.amount), 0) / bg.monthly_limit) * 100, 2) AS DECIMAL(5,2)) as percentage_used
    FROM budget_goals bg
    LEFT JOIN expenses e ON bg.category = e.category 
      AND DATE_FORMAT(e.date, '%Y-%m') = ?
    WHERE bg.is_active = TRUE
    GROUP BY bg.id, bg.category, bg.monthly_limit
    ORDER BY percentage_used DESC
  `;

  db.query(query, [selectedMonth], (err, results) => {
    if (err) {
      console.error("Error fetching budget progress:", err);
      return res.status(500).json({ error: "Database error" });
    }
    // Ensure all numeric fields are properly converted
    const processedResults = results.map((row) => ({
      ...row,
      monthly_limit: parseFloat(row.monthly_limit),
      spent_amount: parseFloat(row.spent_amount),
      remaining_amount: parseFloat(row.remaining_amount),
      percentage_used: parseFloat(row.percentage_used),
    }));
    res.json(processedResults);
  });
});

// Expected Income Endpoints
app.get("/api/expected-incomes", async (req, res) => {
  try {
    const [rows] = await query(
      "SELECT * FROM expected_incomes ORDER BY name ASC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching expected incomes:", error);
    res.status(500).json({ error: "Failed to load expected incomes" });
  }
});

app.post("/api/expected-incomes", async (req, res) => {
  try {
    const {
      name,
      category,
      expected_amount,
      frequency = "monthly",
      due_day = null,
      notes = null,
    } = req.body;

    if (!name || !category || !expected_amount) {
      return res
        .status(400)
        .json({ error: "Name, category and expected amount are required." });
    }

    const [result] = await query(
      `INSERT INTO expected_incomes (name, category, expected_amount, frequency, due_day, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, category, expected_amount, frequency, due_day, notes]
    );

    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error("Error creating expected income:", error);
    res.status(500).json({ error: "Failed to create expected income" });
  }
});

app.put("/api/expected-incomes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      category,
      expected_amount,
      frequency,
      due_day,
      notes,
      last_received_date,
    } = req.body;

    await query(
      `UPDATE expected_incomes
       SET name = ?, category = ?, expected_amount = ?, frequency = ?, due_day = ?, notes = ?, last_received_date = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name,
        category,
        expected_amount,
        frequency,
        due_day,
        notes,
        last_received_date,
        id,
      ]
    );

    res.json({ message: "Expected income updated" });
  } catch (error) {
    console.error("Error updating expected income:", error);
    res.status(500).json({ error: "Failed to update expected income" });
  }
});

app.delete("/api/expected-incomes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM expected_incomes WHERE id = ?", [id]);
    res.json({ message: "Expected income removed" });
  } catch (error) {
    console.error("Error deleting expected income:", error);
    res.status(500).json({ error: "Failed to delete expected income" });
  }
});

// Income Reconciliation
app.get("/api/income-reconciliation", async (req, res) => {
  try {
    const monthParam = req.query.month
      ? dayjs(req.query.month + "-01")
      : dayjs().startOf("month");

    if (!monthParam.isValid()) {
      return res.status(400).json({ error: "Invalid month supplied." });
    }

    const start = monthParam.startOf("month");
    const end = monthParam.endOf("month");
    const [expected] = await query("SELECT * FROM expected_incomes");

    const results = [];

    for (const income of expected) {
      const [credits] = await query(
        `SELECT id, name, amount, date, category
         FROM credits
         WHERE category = ? AND date BETWEEN ? AND ?
         ORDER BY date ASC`,
        [income.category, start.format("YYYY-MM-DD"), end.format("YYYY-MM-DD")]
      );

      const receivedAmount = credits.reduce(
        (sum, row) => sum + parseFloat(row.amount || 0),
        0
      );

      const dueDate =
        income.due_day != null
          ? start.date(Math.min(income.due_day, start.daysInMonth()))
          : end;

      const lastReceived =
        credits.length > 0 ? dayjs(credits[credits.length - 1].date) : null;

      let status = "missing";
      if (receivedAmount >= parseFloat(income.expected_amount)) {
        status = "on_time";
      } else if (receivedAmount > 0) {
        status = "partial";
      }

      const late =
        status !== "on_time" &&
        dayjs().isAfter(dueDate) &&
        receivedAmount < parseFloat(income.expected_amount);

      results.push({
        income,
        receivedAmount: roundToTwo(receivedAmount),
        receivedRecords: credits,
        dueDate: dueDate.format("YYYY-MM-DD"),
        lastReceived: lastReceived ? lastReceived.format("YYYY-MM-DD") : null,
        status: late ? "late" : status,
      });
    }

    res.json({
      month: start.format("YYYY-MM"),
      results,
    });
  } catch (error) {
    console.error("Error running income reconciliation:", error);
    res.status(500).json({ error: "Failed to reconcile income" });
  }
});

// Recurring transactions
app.get("/api/recurring-transactions", async (req, res) => {
  try {
    const [rows] = await query(
      "SELECT * FROM recurring_transactions ORDER BY is_active DESC, next_run_date ASC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching recurring transactions:", error);
    res.status(500).json({ error: "Failed to load recurring transactions" });
  }
});

app.post("/api/recurring-transactions", async (req, res) => {
  try {
    const {
      type,
      name,
      category,
      amount,
      frequency = "monthly",
      dayOfMonth = null,
      weekday = null,
      startDate = null,
      is_active = true,
    } = req.body;

    if (!type || !name || !category || !amount) {
      return res.status(400).json({
        error: "Type, name, category, and amount are required for recurring transactions.",
      });
    }

    const initialDate = startDate ? dayjs(startDate) : dayjs();
    const nextRunDate = initialDate.isValid()
      ? initialDate
      : dayjs().startOf("day");

    const tx = {
      frequency,
      day_of_month: dayOfMonth,
      weekday,
    };

    const normalizedNextRun =
      nextRunDate.isAfter(dayjs().startOf("day"))
        ? nextRunDate
        : calculateNextRunDate(tx, dayjs().startOf("day"));

    const [result] = await query(
      `INSERT INTO recurring_transactions
        (type, name, category, amount, frequency, day_of_month, weekday, next_run_date, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        type,
        name,
        category,
        amount,
        frequency,
        dayOfMonth,
        weekday,
        normalizedNextRun.format("YYYY-MM-DD"),
        is_active,
      ]
    );

    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error("Error creating recurring transaction:", error);
    res.status(500).json({ error: "Failed to create recurring transaction" });
  }
});

app.put("/api/recurring-transactions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      category,
      amount,
      frequency,
      day_of_month,
      weekday,
      next_run_date,
      is_active,
    } = req.body;

    await query(
      `UPDATE recurring_transactions
       SET name = ?, category = ?, amount = ?, frequency = ?, day_of_month = ?, weekday = ?, next_run_date = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name,
        category,
        amount,
        frequency,
        day_of_month,
        weekday,
        next_run_date,
        is_active,
        id,
      ]
    );

    res.json({ message: "Recurring transaction updated" });
  } catch (error) {
    console.error("Error updating recurring transaction:", error);
    res.status(500).json({ error: "Failed to update recurring transaction" });
  }
});

app.delete("/api/recurring-transactions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM recurring_transactions WHERE id = ?", [id]);
    res.json({ message: "Recurring transaction removed" });
  } catch (error) {
    console.error("Error deleting recurring transaction:", error);
    res.status(500).json({ error: "Failed to delete recurring transaction" });
  }
});

// Report export & scheduling
app.post("/api/reports/export", async (req, res) => {
  try {
    const { format = "pdf", startDate, endDate } = req.body;
    const { start, end } = resolveRange(startDate, endDate);
    const reportData = await fetchReportData(start, end);

    if (format === "excel") {
      const buffer = await generateExcelReport(reportData);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=expense-report-${start.format("YYYYMMDD")}-${end.format("YYYYMMDD")}.xlsx`
      );
      return res.send(buffer);
    }

    const buffer = await generatePdfReport(reportData);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=expense-report-${start.format("YYYYMMDD")}-${end.format("YYYYMMDD")}.pdf`
    );
    res.send(buffer);
  } catch (error) {
    console.error("Error exporting report:", error);
    res.status(500).json({ error: "Failed to export report" });
  }
});

app.get("/api/report-schedules", async (req, res) => {
  try {
    const userId = (() => {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : null;
      const payload = token ? verifyJwt(token) : null;
      return payload?.userId || null;
    })();
    const [rows] = userId
      ? await query(
          "SELECT * FROM report_schedules WHERE user_id = ? ORDER BY is_active DESC, next_send_date ASC",
          [userId]
        )
      : await query(
          "SELECT * FROM report_schedules ORDER BY is_active DESC, next_send_date ASC"
        );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching report schedules:", error);
    res.status(500).json({ error: "Failed to load report schedules" });
  }
});

app.post("/api/report-schedules", authMiddleware, async (req, res) => {
  try {
    const {
      recipient_email,
      format = "pdf",
      frequency = "monthly",
      include_budget_overview = true,
      include_trends = true,
      include_recurring = true,
      next_send_date,
    } = req.body;

    if (!recipient_email) {
      return res.status(400).json({ error: "Recipient email is required." });
    }

    const initialSendDate = next_send_date
      ? dayjs(next_send_date)
      : dayjs().add(1, frequency === "weekly" ? "week" : "month");

    if (!initialSendDate.isValid()) {
      return res.status(400).json({ error: "Invalid next send date supplied." });
    }

    const [result] = await query(
      `INSERT INTO report_schedules
        (recipient_email, format, frequency, include_budget_overview, include_trends, include_recurring, next_send_date, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recipient_email,
        format,
        frequency,
        include_budget_overview,
        include_trends,
        include_recurring,
        initialSendDate.format("YYYY-MM-DD"),
        req.userId,
      ]
    );
    const [[row]] = await query(
      "SELECT * FROM report_schedules WHERE id = ?",
      [result.insertId]
    );
    scheduleReportJob(row);
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error("Error creating report schedule:", error);
    res.status(500).json({ error: "Failed to create report schedule" });
  }
});

app.put("/api/report-schedules/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      recipient_email,
      format,
      frequency,
      include_budget_overview,
      include_trends,
      include_recurring,
      next_send_date,
      is_active,
    } = req.body;

    await query(
      `UPDATE report_schedules
       SET recipient_email = ?, format = ?, frequency = ?, include_budget_overview = ?, include_trends = ?, include_recurring = ?, next_send_date = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [
        recipient_email,
        format,
        frequency,
        include_budget_overview,
        include_trends,
        include_recurring,
        next_send_date,
        is_active,
        id,
        req.userId,
      ]
    );
    const [[row]] = await query(
      "SELECT * FROM report_schedules WHERE id = ?",
      [id]
    );
    if (row) scheduleReportJob(row);
    res.json({ message: "Report schedule updated" });
  } catch (error) {
    console.error("Error updating report schedule:", error);
    res.status(500).json({ error: "Failed to update report schedule" });
  }
});

app.delete("/api/report-schedules/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM report_schedules WHERE id = ? AND user_id = ?", [id, req.userId]);
    res.json({ message: "Report schedule deleted" });
  } catch (error) {
    console.error("Error deleting report schedule:", error);
    res.status(500).json({ error: "Failed to delete report schedule" });
  }
});

// CSV Upload (Import)
const upload = multer({ dest: "uploads/" });

app.post("/api/upload", upload.single("file"), (req, res, next) => {
  const filePath = req.file.path;
  const rows = [];

  fs.createReadStream(filePath)
    .pipe(
      csv({
        mapHeaders: ({ header }) => (header ? header.trim() : header),
        mapValues: ({ value }) => (typeof value === "string" ? value.trim() : value),
      })
    )
    .on("data", (data) => {
      rows.push(data);
    })
    .on("end", async () => {
      const normalized = normalizeBankRows(rows);
      const dryRun = String(req.query.dryRun || "").toLowerCase() === "true";

      let expensesCount = 0;
      let incomeCount = 0;
      let duplicates = 0;

      if (dryRun) {
        fs.unlinkSync(filePath);
        const exp = normalized.filter((i) => i.type !== "income").length;
        const inc = normalized.filter((i) => i.type === "income").length;
        return res.status(200).json({
          message: "Dry run completed",
          imported: normalized.length,
          expenses: exp,
          incomes: inc,
          duplicates: 0,
        });
      }

      try {
        await db.promise().beginTransaction();
        for (const item of normalized) {
          const name = item.name || "Unnamed";
          const amount = item.amount || 0;
          const date = item.date;
          const category = item.category || (item.type === "income" ? "Income" : "Uncategorized");
          const table = item.type === "income" ? "credits" : "expenses";

          const [existing] = await db
            .promise()
            .query(
              `SELECT id FROM ${table} WHERE name = ? AND amount = ? AND date = ? LIMIT 1`,
              [name, amount, date]
            );
          if (existing.length) {
            duplicates += 1;
            continue;
          }

          await db
            .promise()
            .query(
              `INSERT INTO ${table} (name, amount, date, category) VALUES (?, ?, ?, ?)`,
              [name, amount, date, category]
            );

          if (item.type === "income") {
            incomeCount += 1;
          } else {
            expensesCount += 1;
          }
        }
        await db.promise().commit();
      } catch (err) {
        try {
          await db.promise().rollback();
        } catch (_) {}
        console.error("Error importing CSV:", err);
        fs.unlinkSync(filePath);
        return next(err);
      }

      fs.unlinkSync(filePath);
      res.status(200).json({
        message: "Import completed",
        imported: normalized.length - duplicates,
        expenses: expensesCount,
        incomes: incomeCount,
        duplicates,
      });
    });
});

// Start Server
app.listen(5000, () => {
  console.log("Server running on port 5000");
});
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});
