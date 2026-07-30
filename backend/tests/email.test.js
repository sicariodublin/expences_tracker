const request = require("supertest");
const app = require("../server");

const CREDS = { username: "emailtest", password: "Password123!" };

let token;

beforeEach(async () => {
  const res = await request(app).post("/api/auth/register").send(CREDS);
  token = res.body.token;
});

const auth = (method, path) =>
  request(app)[method](path).set("Authorization", `Bearer ${token}`);

describe("GET /api/email/status", () => {
  it("returns configuration status without auth", async () => {
    const res = await request(app).get("/api/email/status");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("configured");
    expect(res.body).toHaveProperty("verified");
  });
});

describe("GET /api/email/settings", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/email/settings");
    expect(res.status).toBe(401);
  });

  it("returns empty settings for a user who hasn't configured email", async () => {
    const res = await auth("get", "/api/email/settings");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });
});

describe("PUT /api/email/settings", () => {
  it("saves settings and they're reflected on GET", async () => {
    const res = await auth("put", "/api/email/settings").send({
      provider: "smtp", smtp_host: "smtp.example.com", smtp_port: 587,
      smtp_user: "user@example.com", smtp_pass: "secret", from_email: "user@example.com",
    });
    expect(res.status).toBe(200);

    const get = await auth("get", "/api/email/settings");
    expect(get.body.provider).toBe("smtp");
    expect(get.body.smtp_host).toBe("smtp.example.com");
    // smtp_pass is never returned by GET /settings
    expect(get.body.smtp_pass).toBeUndefined();
  });

  it("returns 400 for an invalid from_email", async () => {
    const res = await auth("put", "/api/email/settings").send({ from_email: "not-an-email" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/email/test", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).post("/api/email/test").send({ to: "someone@example.com" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when 'to' is missing", async () => {
    const res = await auth("post", "/api/email/test").send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when the user has no email configured", async () => {
    const res = await auth("post", "/api/email/test").send({ to: "someone@example.com" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not configured/i);
  });
});
