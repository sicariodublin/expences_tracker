const request = require("supertest");
const app = require("../server");

const CREDS = { username: "reporttest", password: "Password123!" };

let token;

beforeEach(async () => {
  const res = await request(app).post("/api/auth/register").send(CREDS);
  token = res.body.token;
});

const auth = (method, path) =>
  request(app)[method](path).set("Authorization", `Bearer ${token}`);

describe("POST /api/reports/export", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).post("/api/reports/export").send({});
    expect(res.status).toBe(401);
  });

  it("returns a PDF by default", async () => {
    const res = await auth("post", "/api/reports/export").send({});
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
  });

  it("returns an Excel workbook when format=excel", async () => {
    const res = await auth("post", "/api/reports/export").send({
      format: "excel", startDate: "2025-01-01", endDate: "2025-01-31",
    });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  it("returns 400 for a malformed date", async () => {
    const res = await auth("post", "/api/reports/export").send({
      startDate: "not-a-date",
    });
    expect(res.status).toBe(400);
  });
});
