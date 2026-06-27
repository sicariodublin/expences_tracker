const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const dayjs = require("dayjs");
const { query } = require("../db");

const roundToTwo = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const euro = (n) => `€${(parseFloat(n) || 0).toFixed(2)}`;

const resolveRange = (startDate, endDate) => {
  let start = startDate ? dayjs(startDate) : dayjs().startOf("month");
  let end = endDate ? dayjs(endDate) : dayjs().endOf("month");
  if (!start.isValid() || !end.isValid()) throw new Error("Invalid date range supplied.");
  if (end.isBefore(start)) [start, end] = [end, start];
  return { start: start.startOf("day"), end: end.endOf("day") };
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
  const totalExpenses = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const totalCredits = credits.reduce((s, c) => s + parseFloat(c.amount || 0), 0);
  return {
    startDate: startStr, endDate: endStr,
    generatedAt: dayjs().format("YYYY-MM-DD HH:mm"),
    totals: {
      totalExpenses: roundToTwo(totalExpenses),
      totalCredits: roundToTwo(totalCredits),
      balance: roundToTwo(totalCredits - totalExpenses),
    },
    expenses, credits, budgetGoals, recurring,
  };
};

// ── PDF ───────────────────────────────────────────────────────────────────

const heading = (doc, text) => {
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.fontSize(14).text(text, doc.page.margins.left, doc.y, { underline: true, align: "center", width: w });
  doc.y += 6;
};

const drawTable = (doc, headers, rows, widths) => {
  const left = doc.page.margins.left;
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
    doc.on("data", (b) => buffers.push(b));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    doc.fontSize(20).text("Expense Tracker Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Period: ${reportData.startDate} - ${reportData.endDate}`);
    doc.text(`Generated: ${reportData.generatedAt}`);
    doc.moveDown();

    if (options.includeTrends !== false) {
      heading(doc, "Summary");
      drawTable(doc, ["Metric", "Value"],
        [["Total Income", euro(reportData.totals.totalCredits)],
         ["Total Expenses", euro(reportData.totals.totalExpenses)],
         ["Balance", euro(reportData.totals.balance)]],
        [300, 215]);
    }

    heading(doc, "Expenses");
    if (reportData.expenses.length) {
      drawTable(doc, ["Date", "Name", "Category", "Amount"],
        reportData.expenses.map((e) => [e.date, e.name, e.category, euro(e.amount)]),
        [90, 235, 110, 80]);
    } else {
      doc.fontSize(11).text("No expenses recorded in this period.");
    }

    heading(doc, "Income");
    if (reportData.credits.length) {
      drawTable(doc, ["Date", "Source", "Category", "Amount"],
        reportData.credits.map((c) => [c.date, c.name, c.category, euro(c.amount)]),
        [90, 235, 110, 80]);
    } else {
      doc.fontSize(11).text("No income recorded in this period.");
    }

    if (options.includeBudget !== false) {
      heading(doc, "Active Budget Goals");
      if (reportData.budgetGoals.length) {
        drawTable(doc, ["Category", "Monthly Limit"],
          reportData.budgetGoals.map((g) => [g.category, euro(g.monthly_limit)]),
          [350, 165]);
      } else {
        doc.fontSize(11).text("No active budget goals.");
      }
    }

    if (options.includeRecurring !== false) {
      heading(doc, "Active Recurring Transactions");
      if (reportData.recurring.length) {
        drawTable(doc, ["Type", "Name", "Amount", "Frequency", "Next"],
          reportData.recurring.map((t) => [
            String(t.type).toUpperCase(), t.name, euro(t.amount), t.frequency, t.next_run_date,
          ]),
          [60, 225, 80, 90, 60]);
      } else {
        doc.fontSize(11).text("No active recurring transactions.");
      }
    }

    doc.end();
  });

// ── Excel ─────────────────────────────────────────────────────────────────

const generateExcelReport = async (reportData, options = {}) => {
  const wb = new ExcelJS.Workbook();
  const addSheet = (sheet, rows) => {
    if (!rows.length) { sheet.addRow(["No data available"]); return; }
    sheet.columns = Object.keys(rows[0]).map((k) => ({ header: k, key: k, width: 20 }));
    rows.forEach((r) => sheet.addRow(r));
  };

  if (options.includeTrends !== false) {
    const s = wb.addWorksheet("Summary");
    s.columns = [{ header: "Metric", key: "metric", width: 30 }, { header: "Value", key: "value", width: 20 }];
    s.addRows([
      { metric: "Period Start", value: reportData.startDate },
      { metric: "Period End", value: reportData.endDate },
      { metric: "Generated At", value: reportData.generatedAt },
      { metric: "Total Income", value: reportData.totals.totalCredits },
      { metric: "Total Expenses", value: reportData.totals.totalExpenses },
      { metric: "Balance", value: reportData.totals.balance },
    ]);
  }

  addSheet(wb.addWorksheet("Expenses"), reportData.expenses);
  addSheet(wb.addWorksheet("Income"), reportData.credits);

  if (options.includeRecurring !== false) addSheet(wb.addWorksheet("Recurring"), reportData.recurring);

  if (options.includeBudget !== false) {
    const s = wb.addWorksheet("Budget");
    s.columns = [{ header: "Category", key: "category", width: 30 }, { header: "Monthly Limit", key: "monthly_limit", width: 20 }];
    if (reportData.budgetGoals.length) {
      reportData.budgetGoals.forEach((g) => s.addRow({ category: g.category, monthly_limit: parseFloat(g.monthly_limit) }));
    } else {
      s.addRow(["No active budget goals"]);
    }
  }

  return wb.xlsx.writeBuffer();
};

module.exports = { resolveRange, fetchReportData, generatePdfReport, generateExcelReport };
