const request = require("supertest");
const app = require("../server");

const BASE = "/api/auth";
const CREDS = { username: "authtest", password: "Password123!" };

describe("POST /api/auth/register", () => {
  it("creates a user and returns an access token + refresh cookie", async () => {
    const res = await request(app).post(`${BASE}/register`).send(CREDS);
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe("string");
    const cookies = res.headers["set-cookie"] ?? [];
    expect(cookies.some((c) => c.startsWith("refresh_token="))).toBe(true);
  });

  it("returns 409 when username already exists", async () => {
    await request(app).post(`${BASE}/register`).send(CREDS);
    const res = await request(app).post(`${BASE}/register`).send(CREDS);
    expect(res.status).toBe(409);
  });

  it("returns 400 when password is missing", async () => {
    const res = await request(app)
      .post(`${BASE}/register`)
      .send({ username: "nopass" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when username is too short", async () => {
    const res = await request(app)
      .post(`${BASE}/register`)
      .send({ username: "ab", password: "Password123!" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post(`${BASE}/register`).send(CREDS);
  });

  it("returns 200 with access token on correct credentials", async () => {
    const res = await request(app).post(`${BASE}/login`).send(CREDS);
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
  });

  it("returns 401 on wrong password", async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ username: CREDS.username, password: "WrongPassword!" });
    expect(res.status).toBe(401);
  });

  it("returns 401 for unknown username", async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ username: "nobody", password: "Password123!" });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/refresh", () => {
  it("returns a new access token and rotates the refresh cookie", async () => {
    const reg = await request(app).post(`${BASE}/register`).send(CREDS);
    const cookie = reg.headers["set-cookie"][0].split(";")[0];

    const res = await request(app)
      .post(`${BASE}/refresh`)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
  });

  it("old refresh token is invalid after rotation", async () => {
    const reg = await request(app).post(`${BASE}/register`).send(CREDS);
    const cookie = reg.headers["set-cookie"][0].split(";")[0];

    await request(app).post(`${BASE}/refresh`).set("Cookie", cookie);

    const reuse = await request(app)
      .post(`${BASE}/refresh`)
      .set("Cookie", cookie);
    expect(reuse.status).toBe(401);
  });

  it("returns 401 with no cookie", async () => {
    const res = await request(app).post(`${BASE}/refresh`);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("invalidates refresh token so subsequent refresh returns 401", async () => {
    const reg = await request(app).post(`${BASE}/register`).send(CREDS);
    const cookie = reg.headers["set-cookie"][0].split(";")[0];
    const token = reg.body.token;

    const out = await request(app)
      .post(`${BASE}/logout`)
      .set("Authorization", `Bearer ${token}`)
      .set("Cookie", cookie);
    expect(out.status).toBe(200);

    const res = await request(app)
      .post(`${BASE}/refresh`)
      .set("Cookie", cookie);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/forgot-password", () => {
  it("always returns 200 regardless of whether the email exists", async () => {
    const res = await request(app)
      .post(`${BASE}/forgot-password`)
      .send({ email: "nobody@example.com" });
    expect(res.status).toBe(200);
  });

  it("returns 400 for an invalid email format", async () => {
    const res = await request(app)
      .post(`${BASE}/forgot-password`)
      .send({ email: "not-an-email" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/reset-password", () => {
  it("returns 400 for a non-existent token", async () => {
    const res = await request(app)
      .post(`${BASE}/reset-password`)
      .send({ token: "deadbeefdeadbeef", password: "NewPassword123!" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is too short", async () => {
    const res = await request(app)
      .post(`${BASE}/reset-password`)
      .send({ token: "sometoken", password: "short" });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/auth/account", () => {
  it("deletes the account so subsequent login returns 401", async () => {
    const reg = await request(app).post(`${BASE}/register`).send(CREDS);
    const token = reg.body.token;

    const del = await request(app)
      .delete(`${BASE}/account`)
      .set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(200);

    const login = await request(app).post(`${BASE}/login`).send(CREDS);
    expect(login.status).toBe(401);
  });

  it("returns 401 without a bearer token", async () => {
    const res = await request(app).delete(`${BASE}/account`);
    expect(res.status).toBe(401);
  });
});
