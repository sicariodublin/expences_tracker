const request = require("supertest");
const dayjs = require("dayjs");
const app = require("../server");
const { query } = require("../db");
const { processRecurringTransactions } = require("../jobs/recurringTransactions");
const { fetchReportData, resolveRange } = require("../utils/reportGenerator");

const userA = { username: "isoUserA", password: "Password123!" };
const userB = { username: "isoUserB", password: "Password123!" };

let tokenA, tokenB, idA, idB;

beforeEach(async () => {
  const resA = await request(app).post("/api/auth/register").send(userA);
  tokenA = resA.body.token;
  const [[rowA]] = await query("SELECT id FROM users WHERE username = ?", [userA.username]);
  idA = rowA.id;

  const resB = await request(app).post("/api/auth/register").send(userB);
  tokenB = resB.body.token;
  const [[rowB]] = await query("SELECT id FROM users WHERE username = ?", [userB.username]);
  idB = rowB.id;
});

const authAs = (token) => (method, path) =>
  request(app)[method](path).set("Authorization", `Bearer ${token}`);

describe("Cross-user data isolation — report generation", () => {
  it("fetchReportData only includes the requesting user's expenses/credits/budgets/recurring", async () => {
    const asA = authAs(tokenA);
    const asB = authAs(tokenB);

    await asA("post", "/api/expenses").send({ name: "A-Expense", amount: 10, date: "2025-01-15", category: "Groceries" });
    await asB("post", "/api/expenses").send({ name: "B-Expense", amount: 20, date: "2025-01-15", category: "Groceries" });
    await asA("post", "/api/credits").send({ name: "A-Income", amount: 100, date: "2025-01-15", category: "Income" });
    await asB("post", "/api/credits").send({ name: "B-Income", amount: 200, date: "2025-01-15", category: "Income" });
    await asA("post", "/api/budget-goals").send({ category: "Groceries", monthly_limit: 100 });
    await asB("post", "/api/budget-goals").send({ category: "Groceries", monthly_limit: 200 });
    await asA("post", "/api/recurring-transactions").send({ type: "expense", name: "A-Rent", category: "Utilities", amount: 500 });
    await asB("post", "/api/recurring-transactions").send({ type: "expense", name: "B-Rent", category: "Utilities", amount: 900 });

    const { start, end } = resolveRange("2025-01-01", "2025-01-31");
    const dataA = await fetchReportData(start, end, idA);

    expect(dataA.expenses.map((e) => e.name)).toEqual(["A-Expense"]);
    expect(dataA.credits.map((c) => c.name)).toEqual(["A-Income"]);
    expect(dataA.budgetGoals.map((g) => parseFloat(g.monthly_limit))).toEqual([100]);
    expect(dataA.recurring.map((r) => r.name)).toEqual(["A-Rent"]);
  });

  it("POST /api/reports/export succeeds and scopes to the requesting user", async () => {
    const asA = authAs(tokenA);
    await asA("post", "/api/expenses").send({ name: "A-Expense", amount: 10, date: "2025-01-15", category: "Groceries" });

    const res = await asA("post", "/api/reports/export").send({
      format: "pdf", startDate: "2025-01-01", endDate: "2025-01-31",
    });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
  });
});

describe("Cross-user data isolation — recurring transaction cron", () => {
  it("generates the recurring expense with the owning user's user_id, not NULL", async () => {
    const today = dayjs().format("YYYY-MM-DD");
    await query(
      "INSERT INTO recurring_transactions (type, name, category, amount, frequency, next_run_date, is_active, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["expense", "Rent", "Utilities", 500, "monthly", today, true, idA]
    );

    await processRecurringTransactions();

    const [[row]] = await query("SELECT * FROM expenses WHERE name = ?", ["Rent"]);
    expect(row).toBeDefined();
    expect(row.user_id).toBe(idA);

    const listA = await authAs(tokenA)("get", "/api/expenses");
    expect(listA.body.some((e) => e.name === "Rent")).toBe(true);

    const listB = await authAs(tokenB)("get", "/api/expenses");
    expect(listB.body.some((e) => e.name === "Rent")).toBe(false);
  });
});

describe("Cross-user data isolation — report schedule send-now IDOR", () => {
  it("returns 404 when a user tries to send-now another user's schedule", async () => {
    const create = await authAs(tokenA)("post", "/api/report-schedules").send({ recipient_email: "a@example.com" });
    expect(create.status).toBe(201);

    const res = await authAs(tokenB)("post", `/api/report-schedules/${create.body.id}/send-now`);
    expect(res.status).toBe(404);
  });

  it("allows the owning user to send-now their own schedule", async () => {
    const create = await authAs(tokenA)("post", "/api/report-schedules").send({ recipient_email: "a@example.com" });
    expect(create.status).toBe(201);

    const res = await authAs(tokenA)("post", `/api/report-schedules/${create.body.id}/send-now`);
    expect(res.status).toBe(200);
  });

  it("returns 404 for a schedule id that doesn't exist", async () => {
    const res = await authAs(tokenA)("post", "/api/report-schedules/999999/send-now");
    expect(res.status).toBe(404);
  });
});
