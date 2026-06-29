const request = require("supertest");
const app = require("../server");

const CREDS = { username: "budgettest", password: "Password123!" };

let token;

beforeEach(async () => {
  const res = await request(app).post("/api/auth/register").send(CREDS);
  token = res.body.token;
});

const auth = (method, path) =>
  request(app)[method](path).set("Authorization", `Bearer ${token}`);

describe("POST /api/budget-goals", () => {
  it("creates a budget goal and returns its id", async () => {
    const res = await auth("post", "/api/budget-goals").send({
      category: "Transport",
      monthly_limit: 150,
    });
    expect(res.status).toBe(200);
    expect(typeof res.body.id).toBe("number");
    expect(res.body.message).toBe("Budget goal added");
  });

  it("returns 400 when monthly_limit is missing", async () => {
    const res = await auth("post", "/api/budget-goals").send({
      category: "Transport",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid category", async () => {
    const res = await auth("post", "/api/budget-goals").send({
      category: "Food & Drink",
      monthly_limit: 300,
    });
    expect(res.status).toBe(400);
  });

  it("returns 401 without auth", async () => {
    const res = await request(app)
      .post("/api/budget-goals")
      .send({ category: "Transport", monthly_limit: 150 });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/budget-goals", () => {
  it("returns an empty array for a new user", async () => {
    const res = await auth("get", "/api/budget-goals");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns created active budget goals", async () => {
    await auth("post", "/api/budget-goals").send({
      category: "Transport",
      monthly_limit: 150,
    });
    const res = await auth("get", "/api/budget-goals");
    expect(res.body).toHaveLength(1);
    expect(res.body[0].category).toBe("Transport");
    expect(parseFloat(res.body[0].monthly_limit)).toBe(150);
  });
});

describe("DELETE /api/budget-goals/:id (soft delete)", () => {
  it("soft-deletes a goal so it no longer appears in the list", async () => {
    const create = await auth("post", "/api/budget-goals").send({
      category: "Groceries",
      monthly_limit: 400,
    });
    const id = create.body.id;

    const del = await auth("delete", `/api/budget-goals/${id}`);
    expect(del.status).toBe(200);

    const list = await auth("get", "/api/budget-goals");
    expect(list.body.find((g) => g.id === id)).toBeUndefined();
  });
});

describe("GET /api/budget-progress", () => {
  it("returns progress for active budget goals", async () => {
    await auth("post", "/api/budget-goals").send({
      category: "Groceries",
      monthly_limit: 500,
    });
    const res = await auth("get", "/api/budget-progress");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      category: "Groceries",
      monthly_limit: 500,
      spent_amount: expect.any(Number),
      remaining_amount: expect.any(Number),
      percentage_used: expect.any(Number),
    });
  });

  it("spent_amount reflects actual expenses in the current month", async () => {
    await auth("post", "/api/budget-goals").send({
      category: "Groceries",
      monthly_limit: 500,
    });
    const thisMonth = new Date().toISOString().slice(0, 7);
    await auth("post", "/api/expenses").send({
      name: "Supermarket",
      amount: 60,
      date: `${thisMonth}-01`,
      category: "Groceries",
    });

    const res = await auth("get", "/api/budget-progress");
    const groceries = res.body.find((g) => g.category === "Groceries");
    expect(groceries.spent_amount).toBe(60);
    expect(groceries.remaining_amount).toBe(440);
  });

  it("returns empty array for a user with no budget goals", async () => {
    const res = await auth("get", "/api/budget-progress");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
