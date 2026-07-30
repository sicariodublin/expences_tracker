const request = require("supertest");
const app = require("../server");

const CREDS = { username: "uploadtest", password: "Password123!" };
const CSV = "Date,Description,Amount\n2025-01-15,Test Store,-25.50\n";

let token;

beforeEach(async () => {
  const res = await request(app).post("/api/auth/register").send(CREDS);
  token = res.body.token;
});

const auth = (method, path) =>
  request(app)[method](path).set("Authorization", `Bearer ${token}`);

describe("POST /api/upload", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app)
      .post("/api/upload")
      .attach("file", Buffer.from(CSV), "statement.csv");
    expect(res.status).toBe(401);
  });

  it("returns 400 when no file is attached", async () => {
    const res = await auth("post", "/api/upload");
    expect(res.status).toBe(400);
  });

  it("rejects a non-CSV file", async () => {
    const res = await auth("post", "/api/upload")
      .attach("file", Buffer.from("just some text"), "notes.txt");
    expect(res.status).toBe(400);
  });

  it("rejects a file larger than the 10MB limit", async () => {
    const big = Buffer.alloc(11 * 1024 * 1024, "a");
    const res = await auth("post", "/api/upload")
      .attach("file", big, "big.csv");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/too large/i);
  }, 20000);

  it("dry-run previews the import without writing rows", async () => {
    const res = await auth("post", "/api/upload?dryRun=true")
      .attach("file", Buffer.from(CSV), "statement.csv");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Dry run completed");
    expect(res.body.imported).toBe(1);

    const list = await auth("get", "/api/expenses");
    expect(list.body).toEqual([]);
  });

  it("commits the import and the row appears in the user's expenses", async () => {
    const res = await auth("post", "/api/upload")
      .attach("file", Buffer.from(CSV), "statement.csv");
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(1);

    const list = await auth("get", "/api/expenses");
    expect(list.body).toHaveLength(1);
    expect(list.body[0].name).toBe("Test Store");
  });
});
