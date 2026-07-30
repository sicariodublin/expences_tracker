const request = require("supertest");
const app = require("../server");

const CREDS = { username: "credittest", password: "Password123!" };
const CREDIT = { name: "Paycheck", amount: 1500, date: "2025-01-15", category: "Income" };

let token;

beforeEach(async () => {
  const res = await request(app).post("/api/auth/register").send(CREDS);
  token = res.body.token;
});

const auth = (method, path) =>
  request(app)[method](path).set("Authorization", `Bearer ${token}`);

describe("GET /api/credits", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/credits");
    expect(res.status).toBe(401);
  });

  it("returns an empty array for a new user", async () => {
    const res = await auth("get", "/api/credits");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("POST /api/credits", () => {
  it("creates a credit", async () => {
    const res = await auth("post", "/api/credits").send(CREDIT);
    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Credit added successfully!");
  });

  it("returns 400 when name is missing", async () => {
    const res = await auth("post", "/api/credits").send({
      amount: 5, date: "2025-01-15", category: "Income",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid category", async () => {
    const res = await auth("post", "/api/credits").send({
      name: "Paycheck", amount: 1500, date: "2025-01-15", category: "Not A Category",
    });
    expect(res.status).toBe(400);
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).post("/api/credits").send(CREDIT);
    expect(res.status).toBe(401);
  });

  it("new credit appears in the list", async () => {
    await auth("post", "/api/credits").send(CREDIT);
    const res = await auth("get", "/api/credits");
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Paycheck");
  });
});

describe("PUT /api/credits/:id", () => {
  it("updates a credit field", async () => {
    const create = await auth("post", "/api/credits").send(CREDIT);
    const list = await auth("get", "/api/credits");
    const id = list.body[0].id;
    const res = await auth("put", `/api/credits/${id}`).send({ amount: 1600 });
    expect(res.status).toBe(200);
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).put("/api/credits/1").send({ amount: 5 });
    expect(res.status).toBe(401);
  });

  it("returns 404 for a nonexistent credit id", async () => {
    const res = await auth("put", "/api/credits/999999").send({ amount: 5 });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/credits/:id", () => {
  it("removes the credit from the list", async () => {
    await auth("post", "/api/credits").send(CREDIT);
    const list = await auth("get", "/api/credits");
    const id = list.body[0].id;

    const del = await auth("delete", `/api/credits/${id}`);
    expect(del.status).toBe(200);

    const after = await auth("get", "/api/credits");
    expect(after.body.find((c) => c.id === id)).toBeUndefined();
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).delete("/api/credits/1");
    expect(res.status).toBe(401);
  });

  it("returns 404 for a nonexistent credit id", async () => {
    const res = await auth("delete", "/api/credits/999999");
    expect(res.status).toBe(404);
  });
});
