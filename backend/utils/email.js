const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { query } = require("../db");

const EMAIL_SECRET_KEY = process.env.EMAIL_SECRET_KEY || null;
const EMAIL_DEV_MODE = process.env.EMAIL_DEV_MODE || "";
const REPORT_FROM_EMAIL =
  process.env.REPORT_FROM_EMAIL || process.env.SMTP_USER || "reports@tracker";

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
    const key = crypto.createHash("sha256").update(EMAIL_SECRET_KEY).digest();
    const dec = crypto.createDecipheriv("aes-256-gcm", key, buf.slice(0, 12));
    dec.setAuthTag(buf.slice(12, 28));
    return Buffer.concat([dec.update(buf.slice(28)), dec.final()]).toString("utf8");
  } catch (_) {
    return null;
  }
};

const hasEmailConfig =
  process.env.SMTP_HOST && process.env.SMTP_PORT &&
  process.env.SMTP_USER && process.env.SMTP_PASS;

let mailTransporter = null;
let lastEmailVerifyError = null;
let emailVerified = true;

if (hasEmailConfig) {
  mailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
} else {
  console.warn(
    "Email transporter not configured globally. Per-user settings or Ethereal dev mode will be used."
  );
}

if (mailTransporter && process.env.SMTP_VERIFY === "true") {
  mailTransporter.verify()
    .then(() => { emailVerified = true; })
    .catch((err) => {
      emailVerified = false;
      lastEmailVerifyError = err?.response || err?.message || String(err);
      console.error("SMTP transport verification failed:", err);
    });
}

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
    const [[settings]] = await query(
      "SELECT * FROM email_settings WHERE user_id = ?", [userId]
    );
    if (!settings) return mailTransporter;
    const { provider, smtp_host, smtp_port, smtp_user, smtp_pass, api_key } = settings;
    if (provider === "sendgrid" && api_key) {
      return nodemailer.createTransport({
        host: "smtp.sendgrid.net", port: 587, secure: false,
        auth: { user: "apikey", pass: decryptSecret(api_key) || api_key },
      });
    }
    if (provider === "smtp" && smtp_host && smtp_user && smtp_port && smtp_pass) {
      return nodemailer.createTransport({
        host: smtp_host, port: Number(smtp_port),
        secure: Number(smtp_port) === 465,
        auth: { user: smtp_user, pass: decryptSecret(smtp_pass) || smtp_pass },
      });
    }
    if (provider === "outlook") {
      return nodemailer.createTransport({
        host: "smtp.office365.com", port: 587, secure: false,
        auth: { user: smtp_user, pass: decryptSecret(smtp_pass) || smtp_pass },
      });
    }
    return mailTransporter;
  } catch (_) {
    return mailTransporter;
  }
};

const getEmailStatus = () => ({
  configured: !!mailTransporter,
  verified: emailVerified,
  transport: mailTransporter?.options
    ? { host: mailTransporter.options.host, port: mailTransporter.options.port, secure: !!mailTransporter.options.secure }
    : null,
  devMode: EMAIL_DEV_MODE || null,
  error: lastEmailVerifyError,
});

module.exports = {
  encryptSecret, decryptSecret,
  resolveUserTransporter, getEmailStatus,
  REPORT_FROM_EMAIL,
};
