const dayjs = require("dayjs");
const cron = require("node-cron");
const nodemailer = require("nodemailer");
const { query } = require("../db");
const { resolveUserTransporter, REPORT_FROM_EMAIL } = require("../utils/email");
const { fetchReportData, generatePdfReport, generateExcelReport } = require("../utils/reportGenerator");

const SEND_TIME = (process.env.REPORT_SEND_TIME || "06:15").split(":");
const SEND_HOUR = Number(SEND_TIME[0]);
const SEND_MINUTE = Number(SEND_TIME[1]);

const scheduleTasks = new Map();

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
    const opts = {
      includeBudget: schedule.include_budget_overview,
      includeTrends: schedule.include_trends,
      includeRecurring: schedule.include_recurring,
    };

    const isExcel = schedule.format === "excel";
    const buffer = isExcel
      ? await generateExcelReport(reportData, opts)
      : await generatePdfReport(reportData, opts);

    const ext = isExcel ? "xlsx" : "pdf";
    const base = isWeekly ? `week-${rangeStart.format("YYYY-MM-DD")}` : rangeStart.format("YYYY-MM");

    await transporter.sendMail({
      from: REPORT_FROM_EMAIL,
      to: schedule.recipient_email,
      subject: isWeekly
        ? `Expense Tracker Summary - Week of ${rangeStart.format("MMM D, YYYY")}`
        : `Expense Tracker Summary - ${rangeStart.format("MMMM YYYY")}`,
      text: `Attached is your scheduled ${schedule.format.toUpperCase()} report.`,
      attachments: [{ filename: `expense-report-${base}.${ext}`, content: buffer }],
    });

    const nextSend = isWeekly
      ? dayjs(schedule.next_send_date).add(1, "week")
      : dayjs(schedule.next_send_date).add(1, "month");

    await query(
      "UPDATE report_schedules SET last_sent_at = ?, next_send_date = ? WHERE id = ?",
      [dayjs().format("YYYY-MM-DD HH:mm:ss"), nextSend.format("YYYY-MM-DD"), schedule.id]
    );

    scheduleReportJob({ ...schedule, next_send_date: nextSend.format("YYYY-MM-DD") });
  } catch (err) {
    console.error("Error sending scheduled report:", err);
  }
};

const scheduleReportJob = (schedule) => {
  const existing = scheduleTasks.get(schedule.id);
  if (existing) existing.stop();
  const base = dayjs(schedule.next_send_date);
  const expr = schedule.frequency === "weekly"
    ? `${SEND_MINUTE} ${SEND_HOUR} * * ${base.day()}`
    : `${SEND_MINUTE} ${SEND_HOUR} ${base.date()} * *`;
  scheduleTasks.set(schedule.id, cron.schedule(expr, () => sendScheduledReport(schedule.id)));
};

const initScheduleJobs = async () => {
  const [rows] = await query("SELECT * FROM report_schedules WHERE is_active = TRUE");
  rows.forEach(scheduleReportJob);
};

module.exports = { sendScheduledReport, scheduleReportJob, initScheduleJobs };
