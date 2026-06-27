const dayjs = require("dayjs");
const cron = require("node-cron");
const { query } = require("../db");

const calculateNextRunDate = (tx, baseDate) => {
  const ref = baseDate ? dayjs(baseDate) : dayjs();
  const { day_of_month: dom, weekday, frequency } = tx;

  const alignToWeekday = (date, target) => {
    if (typeof target !== "number") return date;
    let d = date;
    while (d.day() !== target) d = d.add(1, "day");
    return d;
  };

  const addMonths = (n) => {
    let next = ref.add(n, "month");
    if (dom) next = next.date(Math.min(dom, next.daysInMonth()));
    return next;
  };

  switch (frequency) {
    case "weekly":    return alignToWeekday(ref.add(7, "day"), weekday);
    case "biweekly":  return alignToWeekday(ref.add(14, "day"), weekday);
    case "quarterly": return addMonths(3);
    case "yearly":    return addMonths(12);
    default:          return addMonths(1);
  }
};

const processRecurringTransactions = async () => {
  try {
    const today = dayjs().startOf("day");
    const [transactions] = await query(
      "SELECT * FROM recurring_transactions WHERE is_active = TRUE AND next_run_date <= ?",
      [today.format("YYYY-MM-DD")]
    );
    if (!transactions.length) return;

    for (const tx of transactions) {
      const table = tx.type === "expense" ? "expenses" : "credits";
      await query(
        `INSERT INTO ${table} (name, amount, date, category) VALUES (?, ?, ?, ?)`,
        [tx.name, tx.amount, today.format("YYYY-MM-DD"), tx.category]
      );
      const nextRun = calculateNextRunDate(tx, today);
      await query(
        "UPDATE recurring_transactions SET last_run_date = ?, next_run_date = ? WHERE id = ?",
        [today.format("YYYY-MM-DD"), nextRun.format("YYYY-MM-DD"), tx.id]
      );
    }
    console.log(`Processed ${transactions.length} recurring transactions.`);
  } catch (err) {
    console.error("Error processing recurring transactions:", err);
  }
};

const startRecurringJob = () => {
  cron.schedule("5 3 * * *", processRecurringTransactions);
};

module.exports = { processRecurringTransactions, startRecurringJob, calculateNextRunDate };
