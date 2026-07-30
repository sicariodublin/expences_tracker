const request = require("supertest");
const app = require("../server");

const CREDS = { username: "schedtest", password: "Password123!" };
const SCHEDULE = { recipient_email: "reports@example.com", format: "pdf", frequency: "monthly" };

let token;

beforeEach(async () => {
  const res = await request(app).post("/api/auth/register").send(CREDS);
  token = res.body.token;
});

const auth = (method, path) =>
  request(app)[method](path).set("Authorization", `Bearer ${token}`);

describe("GET /api/report-schedules", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/report-schedules");
    expect(res.status).toBe(401);
  });

  it("returns an empty array for a new user", async () => {
    const res = await auth("get", "/api/report-schedules");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("POST /api/report-schedules", () => {
  it("creates a schedule and returns its id", async () => {
    const res = await auth("post", "/api/report-schedules").send(SCHEDULE);
    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe("number");
  });

  it("returns 400 for an invalid recipient email", async () => {
    const res = await auth("post", "/api/report-schedules").send({ recipient_email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("new schedule appears in the list", async () => {
    await auth("post", "/api/report-schedules").send(SCHEDULE);
    const res = await auth("get", "/api/report-schedules");
    expect(res.body).toHaveLength(1);
    expect(res.body[0].recipient_email).toBe(SCHEDULE.recipient_email);
  });
});

describe("PUT /api/report-schedules/:id", () => {
  it("updates a schedule", async () => {
    const create = await auth("post", "/api/report-schedules").send(SCHEDULE);
    const res = await auth("put", `/api/report-schedules/${create.body.id}`).send({
      recipient_email: "changed@example.com", format: "pdf", frequency: "monthly",
      include_budget_overview: true, include_trends: true, include_recurring: true,
      next_send_date: "2025-03-01", is_active: false,
    });
    expect(res.status).toBe(200);

    const list = await auth("get", "/api/report-schedules");
    expect(list.body[0].recipient_email).toBe("changed@example.com");
  });

  it("updates without requiring every optional field (only recipient_email is mandatory)", async () => {
    const create = await auth("post", "/api/report-schedules").send(SCHEDULE);
    const res = await auth("put", `/api/report-schedules/${create.body.id}`).send({
      recipient_email: SCHEDULE.recipient_email, is_active: false,
    });
    expect(res.status).toBe(200);

    const list = await auth("get", "/api/report-schedules");
    expect(list.body[0].is_active).toBe(0);
    expect(list.body[0].format).toBe("pdf");
  });
});

describe("DELETE /api/report-schedules/:id", () => {
  it("removes the schedule from the list", async () => {
    const create = await auth("post", "/api/report-schedules").send(SCHEDULE);
    const del = await auth("delete", `/api/report-schedules/${create.body.id}`);
    expect(del.status).toBe(200);

    const list = await auth("get", "/api/report-schedules");
    expect(list.body).toEqual([]);
  });
});
