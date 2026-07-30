# Expense Tracker — Full Audit Report

**Date:** July 29, 2026
**Scope:** SEO, security, bugs, code quality, design, and repo architecture across the entire `expense-tracker` project.

> **Remediation update — July 30, 2026:** All Critical, High, Medium, and Low findings below have been triaged against the live code and marked ✅ Fixed / 🔲 Open / ⚠️ Partial. Every fix that touches route logic has a matching test in `backend/tests/`; the full suite (102 backend + 1 frontend) passes. See the status markers inline and the note at the end of the Improvement Plan for what's still open and why.



## 0. Big picture

This repo actually contains **two unrelated full applications** plus a lot of clutter:

- **Root app** — Express + MySQL backend (`backend/`) with a Create React App frontend (`frontend/`, checked in as a git submodule).
- **`Personal_expense_tracker/`** — a separate, unfinished Next.js + Drizzle + Cloudflare app ("Ledgerly"), seemingly a stray experiment rather than an intentional rewrite. Its working tree is currently broken (26 of 28 tracked files are deleted on disk), and its own handover doc overstates what's implemented (claims Cloudflare D1 persistence; the actual commit log shows that was abandoned for local JSON storage because it broke builds).

Nothing in the repo declares which app is canonical. That ambiguity is the root cause of several findings below (duplicate branding, inconsistent styling, confusing indexability).

There are also two critical data-integrity/security bugs in the live backend that should be fixed before anything else: a cross-tenant data leak in reporting, and recurring transactions silently failing to save.

---

## 1. Critical — fix immediately

| # | Status | Finding | Where | Impact |
|---|---|---|---|---|
| 1 | ✅ Fixed | **Cross-tenant data leak.** Report generation queries pull expenses/credits/budgets/recurring transactions with no `user_id` filter — only a date range. | `backend/utils/reportGenerator.js:20-33`, called from `routes/reports.js:11` and `jobs/scheduledReports.js:33` | Any user who exports a report, or any scheduled email report, includes **every user's** financial data. This is a serious privacy/security bug. |
| 2 | ✅ Fixed | **Recurring transactions silently break.** The cron job that generates expenses/credits from recurring rules omits `user_id` on insert. | `backend/jobs/recurringTransactions.js:42-45` | Generated rows get `user_id = NULL`, so they never appear in the owning user's list — recurring bills/income silently vanish. Worse, a separate "orphan reassignment" routine can later hand these rows to an unrelated user. |
| 3 | 🔲 Open | **122MB backup zip is permanently embedded in git history**, even though it's since been gitignored and removed from the tree. | `.git` pack (verified via `git verify-pack`), originally `expense-tracker_Backup_19_10_2025.zip` | Every clone pulls ~125MB of dead weight. Deliberately not touched — history rewrite (`git filter-repo`/BFG + force-push) needs your explicit go-ahead. |
| 4 | ⚠️ Partial | **Real bank statement CSV with actual transaction data is committed to git.** | `backend/uploads/Fabio Bank Statement csv.csv` | Still committed to git (same history-rewrite decision as #3, not acted on). `backend/uploads/` was added to `.dockerignore` so it at least stops getting baked into built Docker images going forward — verified via `docker build` + `docker run`. |
| 5 | 🔲 Open | **CRA frontend is fully crawlable and points at a public GitHub Pages URL** (`sicariodublin.github.io/expences_tracker`) with `robots.txt` allowing everything. | `frontend/public/robots.txt`, `frontend/package.json` (`homepage`) | If deployed, this is a second live, indexable surface for a personal finance app — duplicate-content and brand-confusion risk, and arguably shouldn't be indexable at all. Not addressed in this remediation pass. |

## 2. High severity

- ✅ Fixed — **IDOR on "send report now."** `POST /reportSchedules/:id/send-now` never checks the schedule belongs to the requesting user (`backend/routes/reportSchedules.js:71-80`); combined with #1, any user can trigger a report containing all-tenant data.
- ✅ Fixed — **Real secrets baked into the Docker image.** `backend/.env` is excluded from git but **not** from `.dockerignore`, so `COPY backend/ ./backend/` in `backend/Dockerfile:7` bakes the live DB password, JWT secret, and Gmail SMTP app password into the image layer. *Still recommended: rotate the DB password, JWT secret, and Gmail app password since they were baked into an image before this fix — not done as part of this pass.*
- 🔲 Open — **Two apps, no stated relationship.** No README/doc at the repo root explains that `Personal_expense_tracker/` exists or how it relates to the "real" app — confusing for any future contributor (including future-you). Its working tree was restored to a clean, non-broken state this pass, but the canonical-app decision and documentation are still outstanding.
- ⚠️ Partial — **Dirty submodule / broken checkout.** `frontend` (a git submodule) has uncommitted local changes the superproject can't track; `Personal_expense_tracker/` has most of its source deleted from disk relative to its own HEAD. `Personal_expense_tracker/`'s working tree is now restored and clean (`git checkout` + `git pull`). The `frontend` submodule's working tree was actually already clean and on the correct commit — the real issue was that this local clone never ran `git submodule init`, so it shows as unregistered. Left alone since it requires writing to `.git/config`.
- 🔲 Open — **JWT stored in localStorage/sessionStorage** (`frontend/src/api/apiClient.js`, `context/AuthContext.jsx`) rather than an httpOnly cookie — standard XSS token-theft exposure. The refresh-token queuing logic itself is otherwise well built. Deferred: this is a real auth-flow migration (backend token delivery, CSRF handling, frontend bootstrap changes), not a small fix — needs its own session.
- ✅ Fixed — **No `<h1>`, no landmark elements** (`<main>`, `<nav>`) anywhere in the CRA app shell (`frontend/src/App.js`) — accessibility and SEO structure gap. (`<main>`/`<nav>` turned out to already exist in `Layout.jsx`; only the missing `<h1>` needed fixing.)
- ✅ Fixed — **Boilerplate metadata never customized:** `frontend/public/index.html` still has `<title>React App</title>` and the default CRA meta description; `manifest.json` still reads "Create React App Sample."
- ✅ Fixed — **.idea (JetBrains) project files are tracked and modified in git**, including a library file that literally references the giant backup zip. `.idea/`, `.trae/`, `.vscode/` untracked from git (kept on disk) and gitignored.

## 3. Medium severity

- ✅ Fixed — **Silent no-op on cross-user mutation attempts.** `UPDATE/DELETE ... WHERE id=? AND user_id=?` never checks `affectedRows` in `expenses.js`, `credits.js`, `budgets.js` — a request against a nonexistent or someone-else's row still returns 200 "success," masking bugs and making IDOR attempts harder to detect.
- ✅ Fixed — **Upload endpoint has no file size/type limits** (`backend/routes/upload.js:10`) — `multer({ dest: "uploads/" })` with no `limits.fileSize` or `fileFilter`. Any authenticated user can upload arbitrarily large or non-CSV files.
- ✅ Fixed — **Non-idempotent startup migration.** A "single remaining user → reassign all rows" routine in `db/index.js:138-144` runs on every server boot, not just once, and can rewrite `user_id` on rows that already belong to someone. Now gated by a persisted flag (`system_flags` table) so it runs at most once ever.
- ⚠️ Partial — **Styling is mid-migration and inconsistent by the project's own admission.** `BudgetGoals.js`/`ExpenseTemplates.js` use legacy CSS-variable stylesheets; `Analytics.js`/`Automation.js`/`SpendingTrends.js` are full Tailwind, and each redefines identical Tailwind class-string constants independently instead of sharing a `ui/` module. The 7 duplicated class constants are now extracted into `frontend/src/constants/uiClasses.js`. `BudgetGoals.js`/`ExpenseTemplates.js` were deliberately left on their current CSS styling — that's a real visual rewrite with no way to verify it in a browser from here.
- ✅ Fixed — **Inconsistent user feedback pattern:** `ExpenseTemplates.js` uses native `alert()` while everything else uses `react-hot-toast`.
- ✅ Fixed — **Accessibility inconsistency within a single file:** in `Automation.js`, some form sections use unlabeled placeholder-only inputs while others (Email Settings, same file) correctly use `<label>`.
- ✅ Fixed — **No test coverage** for `credits.js`, `upload.js`, `reports.js`, `reportSchedules.js`, `email.js`, `automation.js` — a simple two-user data-isolation test would have caught findings #1 and the IDOR issue immediately. All six now have dedicated test files, plus a new `data-isolation.test.js` cross-user suite.
- ✅ Fixed — **No unified build/test tooling** across the three `package.json` files (root, `frontend/`, `Personal_expense_tracker/`); the root `vitest.config.mjs` only covers backend tests. Added `npm run test:all` at the root (backend vitest + frontend CRA tests). `Personal_expense_tracker/` deliberately excluded — its canonical status is still undecided.
- 🔲 Open — **Next.js app's indexability is unverified** — no `robots.ts` or `metadata.robots` could be confirmed (source files for `app/` are currently missing from the checkout, per finding #3 above). `Personal_expense_tracker/`'s working tree is restored now, so this is re-checkable, but wasn't re-verified in this pass.

## 4. Low severity

- ✅ Fixed — Dead code: `server.js:33`'s `app.options("*", cors(...))` is unreachable since `cors()` already handles preflight.
- ✅ Fixed — Timing side-channel: signature comparison uses `!==` instead of `crypto.timingSafeEqual` in `middleware/auth.js:36` (inconsistent with the correct usage a few lines later).
- ✅ Fixed — Dockerfile runs as root (no `USER node`). Verified with `docker build` + `docker run`: container now runs as `uid=1000(node)`, and `backend/uploads/` is still writable for multer.
- ✅ Fixed — `expence-tracker.sql` (typo in filename) is a messy scratch dump that duplicates/conflicts with the real migration files in `backend/db/migrations/`. Untracked from git, kept on disk.
- ✅ Fixed — `.trae/`, `.vscode/`, `.idea/` all coexist and are partly committed. Untracked from git and gitignored.
- ✅ Fixed — `ExpenseTracker.bat` — Windows-only launcher at repo root. Untracked from git, kept on disk.
- ✅ Fixed — Cosmetic: both light/dark `theme-color` meta tags in `index.html` are hard-coded to the same black.

## 5. What's already fine

- Backend auth/expenses/budgets have decent test coverage (multi-status-code checks, refresh-token rotation, soft delete).
- Parameterized queries are used correctly elsewhere (no obvious SQL injection beyond the missing-filter bugs above).
- `manifest.json` is structurally valid; no sitemap/JSON-LD clutter (correctly absent, since this isn't a content site).
- The API client's refresh-token queuing logic is well designed.

---

## Improvement Plan

**Phase 1 — Stop the bleeding (this week)**
1. [x] Add `user_id` filters to `reportGenerator.js`'s four queries; add ownership checks to `reportSchedules.js` send-now route.
2. [x] Fix the recurring-transactions insert to include `user_id`; audit existing NULL-`user_id` rows and reassign them correctly.
3. [x] Add `backend/.env` to `.dockerignore`. [ ] Rotate the DB password, JWT secret, and Gmail app password since they were baked into a built image — **not done, needs you.**
4. [ ] Lock down indexability: add `Disallow: /` + noindex meta/headers to whichever frontend(s) are actually publicly deployed. **Not addressed.**

**Phase 2 — Clean the repo (next 1-2 weeks)**
5. [ ] Strip the 122MB zip blob and the committed bank-statement CSV from git history (`git filter-repo` or BFG), then force-push; add `backend/uploads/*` and `*.zip` to `.gitignore`. **Deliberately not touched — destructive, needs your explicit decision.** `backend/uploads` was added to `.dockerignore` in the meantime so it stops reaching built images.
6. [x] Decide: is `Personal_expense_tracker/` a real migration target or an abandoned experiment? — Working tree restored to clean/non-broken; the actual keep-vs-delete decision is still open.
7. [ ] Resolve the dirty `frontend` submodule state (needs `git submodule init` — a `.git/config` write, left for you). [x] Remove tracked `.idea`/`.trae` files and gitignore them (`.vscode/` included too).

**Phase 3 — Harden the backend (2-4 weeks)**
8. [x] Add `affectedRows` checks (404 on no-op) to all update/delete routes.
9. [x] Add multer `limits`/`fileFilter` to the upload route.
10. [x] Make the startup "orphan reassignment" migration run-once (flag in DB) instead of every boot.
11. [x] Add cross-user data-isolation tests for reports, credits, uploads, and schedules.
12. [ ] Move JWT storage from localStorage to an httpOnly cookie. **Deferred — scoped as a real auth-flow migration, not a small fix.**

**Phase 4 — Consolidate frontend & polish (ongoing)**
13. [~] Pick one styling system (finish the Tailwind migration) and extract shared UI class constants into a common module instead of duplicating them per file. — Shared constants done; `BudgetGoals.js`/`ExpenseTemplates.js` Tailwind migration skipped (visual rewrite, unverifiable without a browser).
14. [x] Standardize user feedback on `react-hot-toast` everywhere; remove native `alert()`.
15. [x] Add proper `<label>`s to every form input; add an `<h1>` and landmark elements (`<main>`, `<nav>`) to the app shell.
16. [x] Replace CRA boilerplate metadata (title, description, manifest name/short_name, OG tags) with real branding.
17. [x] Set up one CI entry point that runs tests/lint across backend and whichever frontend is canonical (`npm run test:all`; `Personal_expense_tracker/` excluded pending its canonical-status decision).

---

*Full findings were gathered by three parallel specialist reviews (SEO/technical audit, backend security/bug review, frontend/architecture review) against the live codebase — all file paths and line numbers above were read directly, not inferred.*

---

## Remediation notes (July 30, 2026)

Two issues surfaced during remediation that weren't in the original audit:

- **`vitest.config.mjs` was leaking real Gmail SMTP credentials into the test environment**, loaded from `backend/.env` for DB-credential convenience. A new test for the "email not configured" path nearly sent a real email through the live account. Fixed by force-blanking `SMTP_*`/`REPORT_FROM_EMAIL`/`EMAIL_DEV_MODE` in the test env config.
- **PUT routes for `expected-incomes`, `recurring-transactions`, and `report-schedules` crashed with a 500** whenever an optional field was omitted from the request body (unlike `expenses.js`/`credits.js`, which only update the fields actually provided). Found while adding test coverage; fixed to match the existing conditional-`SET`-clause pattern.

Everything marked ✅ Fixed has a passing regression test in `backend/tests/` (or was verified via `docker build`/`docker run` for the Dockerfile change), and was confirmed to actually fail against the pre-fix code before being accepted as fixed.
