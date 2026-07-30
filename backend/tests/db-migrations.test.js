const request = require("supertest");
const app = require("../server");
const { query, runSingleUserReassignOnce, SINGLE_USER_REASSIGN_FLAG } = require("../db");

const CREDS = { username: "reassigntest", password: "Password123!" };

beforeEach(async () => {
  await query("DELETE FROM system_flags WHERE flag_name = ?", [SINGLE_USER_REASSIGN_FLAG]);
});

describe("runSingleUserReassignOnce", () => {
  it("reassigns orphaned/mis-owned rows to the sole remaining user on first run", async () => {
    await request(app).post("/api/auth/register").send(CREDS);
    const [[{ id: userId }]] = await query("SELECT id FROM users WHERE username = ?", [CREDS.username]);

    await query(
      "INSERT INTO expenses (name, amount, date, category, user_id) VALUES (?, ?, ?, ?, ?)",
      ["Orphan", 10, "2025-01-01", "Others", 999999]
    );

    await runSingleUserReassignOnce();

    const [[row]] = await query("SELECT user_id FROM expenses WHERE name = ?", ["Orphan"]);
    expect(row.user_id).toBe(userId);
  });

  it("does not touch rows on later calls once the flag is set (run-once)", async () => {
    await request(app).post("/api/auth/register").send(CREDS);

    await runSingleUserReassignOnce(); // first run: no orphan rows yet, sets the flag

    // A row belonging to some other (now-deleted) user shows up after the flag was set
    await query(
      "INSERT INTO expenses (name, amount, date, category, user_id) VALUES (?, ?, ?, ?, ?)",
      ["StillOrphan", 10, "2025-01-01", "Others", 888888]
    );

    await runSingleUserReassignOnce(); // must be a no-op now

    const [[row]] = await query("SELECT user_id FROM expenses WHERE name = ?", ["StillOrphan"]);
    expect(row.user_id).toBe(888888);
  });
});
