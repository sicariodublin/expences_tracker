const request = require("supertest");
const app = require("../server");

const CREDS = { username: "exptest", password: "Password123!" };
const EXPENSE = { name: "Coffee", amount: 3.5, date: "2025-01-15", category: "Groceries" };

let token;

beforeEach(async () => {
  const res = await request(app).post("/api/auth/register").send(CREDS);
  token = res.body.token;
});

// Shorthand: create an authed request for a given method + path
const auth = (method, path) =>
  request(app)[method](path).set("Authorization", `Bearer ${token}`);

describe("GET /api/expenses", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/expenses");
    expect(res.status).toBe(401);
  });

  it("returns an empty array for a new user", async () => {
    const res = await auth("get", "/api/expenses");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("POST /api/expenses", () => {
  it("creates an expense and returns its id", async () => {
    const res = await auth("post", "/api/expenses").send(EXPENSE);
    expect(res.status).toBe(200);
    expect(typeof res.body.id).toBe("number");
    expect(res.body.message).toBe("Expense added");
  });

  it("returns 400 when name is missing", async () => {
    const res = await auth("post", "/api/expenses").send({
      amount: 5,
      date: "2025-01-15",
      category: "Transport",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid category", async () => {
    const res = await auth("post", "/api/expenses").send({
      name: "Coffee",
      amount: 3.5,
      date: "2025-01-15",
      category: "Food & Drink",
    });
    expect(res.status).toBe(400);
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).post("/api/expenses").send(EXPENSE);
    expect(res.status).toBe(401);
  });

  it("new expense appears in the list", async () => {
    await auth("post", "/api/expenses").send(EXPENSE);
    const res = await auth("get", "/api/expenses");
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Coffee");
  });
});

describe("PUT /api/expenses/:id", () => {
  it("updates an expense field", async () => {
    const create = await auth("post", "/api/expenses").send({
      name: "Tea",
      amount: 2,
      date: "2025-01-10",
      category: "Others",
    });
    const id = create.body.id;
    const res = await auth("put", `/api/expenses/${id}`).send({ amount: 2.5 });
    expect(res.status).toBe(200);
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).put("/api/expenses/1").send({ amount: 5 });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/expenses/:id", () => {
  it("removes the expense from the list", async () => {
    const create = await auth("post", "/api/expenses").send({
      name: "Lunch",
      amount: 10,
      date: "2025-01-12",
      category: "Groceries",
    });
    const id = create.body.id;

    const del = await auth("delete", `/api/expenses/${id}`);
    expect(del.status).toBe(200);

    const list = await auth("get", "/api/expenses");
    expect(list.body.find((e) => e.id === id)).toBeUndefined();
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).delete("/api/expenses/1");
    expect(res.status).toBe(401);
  });
});
