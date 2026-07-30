const request = require("supertest");
const app = require("../server");

const CREDS = { username: "automationtest", password: "Password123!" };

let token;

beforeEach(async () => {
  const res = await request(app).post("/api/auth/register").send(CREDS);
  token = res.body.token;
});

const auth = (method, path) =>
  request(app)[method](path).set("Authorization", `Bearer ${token}`);

describe("Expected Incomes", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/expected-incomes");
    expect(res.status).toBe(401);
  });

  it("creates, lists, updates, and deletes an expected income", async () => {
    const create = await auth("post", "/api/expected-incomes").send({
      name: "Salary", category: "Income", expected_amount: 3000, frequency: "monthly", due_day: 25,
    });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const list = await auth("get", "/api/expected-incomes");
    expect(list.body).toHaveLength(1);
    expect(list.body[0].name).toBe("Salary");

    const update = await auth("put", `/api/expected-incomes/${id}`).send({
      name: "Salary", category: "Income", expected_amount: 3200,
      frequency: "monthly", due_day: 25, notes: null, last_received_date: null,
    });
    expect(update.status).toBe(200);

    const del = await auth("delete", `/api/expected-incomes/${id}`);
    expect(del.status).toBe(200);

    const after = await auth("get", "/api/expected-incomes");
    expect(after.body).toEqual([]);
  });

  it("returns 400 for an invalid category", async () => {
    const res = await auth("post", "/api/expected-incomes").send({
      name: "Salary", category: "Not A Category", expected_amount: 3000,
    });
    expect(res.status).toBe(400);
  });

  it("updates a single field without requiring the rest of the object", async () => {
    const create = await auth("post", "/api/expected-incomes").send({
      name: "Salary", category: "Income", expected_amount: 3000,
    });
    const res = await auth("put", `/api/expected-incomes/${create.body.id}`).send({
      expected_amount: 3200,
    });
    expect(res.status).toBe(200);

    const list = await auth("get", "/api/expected-incomes");
    expect(parseFloat(list.body[0].expected_amount)).toBe(3200);
    expect(list.body[0].name).toBe("Salary");
  });
});

describe("Income Reconciliation", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/income-reconciliation");
    expect(res.status).toBe(401);
  });

  it("reports 'missing' status for an expected income with no matching credits", async () => {
    await auth("post", "/api/expected-incomes").send({
      name: "Salary", category: "Income", expected_amount: 3000,
    });
    const thisMonth = new Date().toISOString().slice(0, 7);
    const res = await auth("get", `/api/income-reconciliation?month=${thisMonth}`);
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].status).toBe("missing");
  });

  it("reports 'on_time' once a matching credit covers the expected amount", async () => {
    await auth("post", "/api/expected-incomes").send({
      name: "Salary", category: "Income", expected_amount: 100,
    });
    const thisMonth = new Date().toISOString().slice(0, 7);
    await auth("post", "/api/credits").send({
      name: "Paycheck", amount: 100, date: `${thisMonth}-05`, category: "Income",
    });
    const res = await auth("get", `/api/income-reconciliation?month=${thisMonth}`);
    expect(res.body.results[0].status).toBe("on_time");
  });
});

describe("Recurring Transactions", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/recurring-transactions");
    expect(res.status).toBe(401);
  });

  it("creates, lists, updates, and deletes a recurring transaction", async () => {
    const create = await auth("post", "/api/recurring-transactions").send({
      type: "expense", name: "Rent", category: "Utilities", amount: 500, frequency: "monthly",
    });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const list = await auth("get", "/api/recurring-transactions");
    expect(list.body).toHaveLength(1);
    expect(list.body[0].name).toBe("Rent");

    const update = await auth("put", `/api/recurring-transactions/${id}`).send({
      name: "Rent", category: "Utilities", amount: 550, frequency: "monthly",
      day_of_month: null, weekday: null, next_run_date: "2025-02-01", is_active: true,
    });
    expect(update.status).toBe(200);

    const del = await auth("delete", `/api/recurring-transactions/${id}`);
    expect(del.status).toBe(200);

    const after = await auth("get", "/api/recurring-transactions");
    expect(after.body).toEqual([]);
  });

  it("returns 400 for an invalid type", async () => {
    const res = await auth("post", "/api/recurring-transactions").send({
      type: "not-a-type", name: "Rent", category: "Utilities", amount: 500,
    });
    expect(res.status).toBe(400);
  });

  it("updates a single field without requiring the rest of the object", async () => {
    const create = await auth("post", "/api/recurring-transactions").send({
      type: "expense", name: "Rent", category: "Utilities", amount: 500, frequency: "monthly",
    });
    const res = await auth("put", `/api/recurring-transactions/${create.body.id}`).send({
      amount: 550,
    });
    expect(res.status).toBe(200);

    const list = await auth("get", "/api/recurring-transactions");
    expect(parseFloat(list.body[0].amount)).toBe(550);
    expect(list.body[0].name).toBe("Rent");
  });
});
