# Expense Tracker — Project Plan

> **Assessment date:** June 2026  
> **Decision: Strategic Refactor + UI Overhaul** — not a restart

---

## 1. Verdict: Restart or Refactor?

**Short answer: Refactor with a new face.**

The app has months of real, working business logic that is hard to recreate. Restarting throws that away. The problems are structural (monolithic files, no tests, no validation) and cosmetic (dated UI) — both are fixable without rewriting the entire app.

| Dimension | Current State | Target |
|-----------|--------------|--------|
| Feature completeness | 8/10 — core features all work | Maintain + add missing auth pieces |
| Code quality | 4/10 — monolithic, no tests | Separated modules, tested |
| Architecture | 3/10 — one file per layer | Routes/controllers/services split |
| Security | 5/10 — auth works, missing safeguards | Rate limiting, refresh tokens, validation |
| UI / UX | 4/10 — vanilla CSS, dated look | Modern component library, consistent design |
| DevOps | 1/10 — .bat file, no CI | Docker, GitHub Actions, migrations |
| Testing | 1/10 — no real coverage | Backend integration tests + key frontend tests |

---

## 2. Current Architecture Snapshot

> **Updated June 2026** — reflects all phases complete through Phase 6.

```
expense-tracker/
├── backend/
│   ├── server.js             ← Express setup only (~60 lines)
│   ├── routes/
│   │   ├── auth.js           ← register, login, logout, profile, password-reset
│   │   ├── expenses.js       ← CRUD + filtering
│   │   ├── credits.js        ← CRUD + filtering
│   │   ├── budgets.js        ← budget goals + progress
│   │   ├── automation.js     ← recurring, expected-incomes, reconciliation
│   │   ├── reports.js        ← export + schedules + send-now
│   │   ├── email.js          ← settings + test
│   │   └── upload.js         ← CSV import (dry-run + commit)
│   ├── middleware/
│   │   ├── auth.js           ← JWT verification
│   │   ├── validate.js       ← Zod schema wrapper (z.coerce.number for form fields)
│   │   └── rateLimiter.js    ← express-rate-limit (passthrough in test env)
│   ├── jobs/
│   │   ├── recurringTransactions.js
│   │   └── scheduledReports.js
│   ├── utils/
│   │   ├── csvNormalizer.js  ← keyword-based auto-categorisation
│   │   ├── reportGenerator.js
│   │   └── email.js
│   ├── db/
│   │   ├── index.js          ← mysql2 pool
│   │   ├── migrate.js        ← versioned migration runner
│   │   └── migrations/
│   │       └── 001_initial_schema.sql
│   ├── tests/
│   │   ├── setup.js
│   │   ├── auth.test.js      ← 17 tests
│   │   ├── expenses.test.js  ← 11 tests
│   │   └── budgets.test.js   ← 10 tests
│   ├── Dockerfile
│   └── .env.example
├── frontend/                  ← git submodule (sicariodublin/expences_tracker)
│   ├── tailwind.config.js    ← Tailwind v3 (darkMode: 'class')
│   ├── Dockerfile            ← multi-stage: CRA build + nginx
│   ├── nginx.conf            ← SPA fallback + /api/ proxy
│   └── src/
│       ├── App.js            ← ~25 lines — providers + Layout only
│       ├── App.css           ← CSS variables + global resets
│       ├── context/AuthContext.jsx
│       ├── pages/
│       │   ├── Dashboard.jsx ← TanStack Query, category breakdown chart
│       │   └── ResetPassword.jsx
│       ├── Analytics.js      ← full Tailwind (no Analytics.css)
│       ├── Automation.js     ← full Tailwind (no Automation.css)
│       ├── BudgetGoals.js    ← budget tracking with progress bars
│       ├── SpendingTrends.js ← full Tailwind (no SpendingTrends.css)
│       ├── ExpenseTemplates.js
│       ├── components/Layout.jsx
│       ├── api/apiClient.js  ← Axios + silent refresh interceptor
│       ├── constants/categories.js
│       └── utils/format.js
├── docker-compose.yml         ← MySQL → backend (volume mount) → frontend :3001
├── .github/workflows/ci.yml
├── vitest.config.mjs
└── .env.example
```

### What Works Right Now
- Full CRUD for expenses and credits (income)
- CSV bank statement import (AIB format + generic fallback, dry-run preview, duplicate detection)
- 20 categories with keyword-based auto-categorization
- Budget goals with monthly progress tracking (On Track / Watch / Critical / Over Budget)
- Recurring transactions with daily cron automation
- Expected income forecasting with monthly reconciliation
- PDF and Excel report export
- Scheduled email reports (weekly/monthly via cron)
- Per-user SMTP configuration (AES-256-GCM encrypted)
- Quick-add templates (10 built-in + custom)
- Dark mode (CSS variables, localStorage persistent)
- Authentication: JWT, PBKDF2 password hashing, per-user data isolation

### Known Gaps
- No error tracking or structured logging (Winston deferred)
- No email verification on register
- Credentials in `.env` (gitignored, not committed — see `.env.example`)

---

## 3. Technology Decisions

### Keep (proven, no reason to change)
- **Node.js + Express** — straightforward, no overhead
- **MySQL + mysql2** — schema is sound and has proper indexes
- **React 19** — already on latest
- **Chart.js + react-chartjs-2** — analytics charts work well
- **PDFKit + ExcelJS** — report generation works
- **Nodemailer** — email sending + scheduling works
- **node-cron** — fine for a personal/single-instance app
- **dayjs** — lightweight date handling

### Add (missing pieces)
- **Zod** — input validation on all backend routes
- **express-rate-limit** — brute-force protection on auth endpoints
- **Tailwind CSS** — replaces vanilla CSS, consistent utility-first styling
- **shadcn/ui** or **Radix UI** — headless components (modals, dropdowns, toasts)
- **React Router v6** — replace tab-based navigation with real URL routing
- **TanStack Query (React Query)** — replace manual fetch/state in every component
- **Winston** — structured backend logging
- **Vitest + Supertest** — backend route testing
- **React Testing Library** — key frontend component tests

### Optional upgrades (lower priority)
- **TypeScript** — adds safety but requires significant migration effort; skip for now
- **Vite** — faster dev server than CRA; low-effort swap if CRA causes pain
- **PM2** — production process manager (before Docker)
- **Flyway / db-migrate** — proper migration versioning (currently schema is one .sql dump)

---

## 4. Target Architecture (After Refactor)

```
backend/
├── server.js             ← Express setup only (~50 lines)
├── routes/
│   ├── auth.js           ← register, login, logout, password-reset
│   ├── expenses.js       ← CRUD + filtering
│   ├── credits.js        ← CRUD + filtering
│   ├── budgets.js        ← budget goals + progress
│   ├── automation.js     ← recurring, expected-incomes, reconciliation
│   ├── reports.js        ← export + schedules + send-now
│   ├── email.js          ← settings + test
│   └── upload.js         ← CSV import (dry-run + commit)
├── middleware/
│   ├── auth.js           ← JWT verification
│   ├── validate.js       ← Zod schema wrapper
│   └── rateLimiter.js    ← express-rate-limit config
├── jobs/
│   ├── recurringTransactions.js  ← cron logic (isolated)
│   └── scheduledReports.js       ← email report cron
├── utils/
│   ├── csvNormalizer.js  ← bank import (unchanged)
│   ├── reportGenerator.js  ← PDF/Excel generation
│   └── email.js          ← nodemailer helpers
├── db/
│   └── index.js          ← mysql2 pool setup
└── .env.example          ← committed template (not actual secrets)

frontend/src/
├── pages/
│   ├── Dashboard.jsx     ← transaction tables + filters
│   ├── Analytics.jsx     ← charts (from current Analytics.js)
│   ├── Budgets.jsx       ← budget goals (from BudgetGoals.js)
│   ├── Automation.jsx    ← recurring + schedules (from Automation.js)
│   ├── Trends.jsx        ← year-over-year (from SpendingTrends.js)
│   └── Profile.jsx       ← user profile + email settings
├── components/
│   ├── ui/               ← shadcn/ui primitives (Button, Modal, Card...)
│   ├── TransactionTable.jsx
│   ├── CategoryBadge.jsx
│   ├── BudgetProgressBar.jsx
│   ├── ExpenseTemplates.jsx
│   └── CsvImportModal.jsx
├── hooks/
│   ├── useExpenses.js    ← TanStack Query hook
│   ├── useCredits.js
│   ├── useBudgets.js
│   └── useAuth.js
├── api/
│   └── apiClient.js      ← unchanged (already well-structured)
├── constants/
│   └── categories.js     ← unchanged
└── utils/
    └── format.js         ← unchanged
```

---

## 5. Phased Execution Plan

### Phase 0 — Security Fixes ✅ Complete

- [x] `.env` was never committed (already gitignored) — no history cleanup needed
- [x] Created `backend/.env.example` with placeholders and key-generation instructions
- [x] JWT_SECRET / EMAIL_SECRET_KEY already strong; **do not rotate EMAIL_SECRET_KEY** without clearing `email_settings` table (stored SMTP passwords are encrypted with it)
- [x] `express-rate-limit` applied to `/api/auth/login` and `/api/auth/register` (10 req / 15 min)
- [x] Zod validation on all POST/PUT endpoints via `backend/middleware/validate.js`

### Phase 1 — Backend Refactor ✅ Complete

- [x] Created `backend/db/index.js` — mysql2 pool
- [x] Created `backend/middleware/auth.js` — JWT authMiddleware
- [x] Created `backend/middleware/validate.js` — Zod wrapper middleware
- [x] Created `backend/middleware/rateLimiter.js` — express-rate-limit on auth endpoints
- [x] Created `backend/routes/` — all endpoints split across 8 route files
- [x] Created `backend/jobs/` — cron logic isolated from server.js
- [x] Created `backend/utils/reportGenerator.js` — PDF/Excel logic separated
- [x] Created `backend/utils/email.js` — nodemailer helpers
- [x] `server.js` is now ~60 lines (Express setup + route mounting only)

> **Deferred:** Winston logging, forgot-password flow — moved to Phase 4.

### Phase 2 — Frontend Refactor ✅ Complete

- [x] Installed react-router-dom@7 + @tanstack/react-query@5
- [x] Created `src/context/AuthContext.jsx` — all auth state/logic extracted into React context (login, register, logout, token storage)
- [x] Created `src/components/Layout.jsx` — sidebar with `<NavLink>` (URL-driven active state), header, dark mode toggle, auth modal, `<Toaster>`, `<Routes>`
- [x] Created `src/pages/Dashboard.jsx` — full dashboard using TanStack Query: `useQuery` for expenses/credits, `useMutation` for all CRUD + CSV upload; sorting computed in `useMemo` (survives refetch)
- [x] `App.js` reduced from 920 → 25 lines — just providers + Layout
- [x] URL routing: `/` Dashboard, `/budgets` Budget Goals, `/analytics` Analytics + Trends, `/automation` Automation
- [x] Toast notifications done in Phase 3 ✅

> **Deferred:** Error boundaries, further component extraction (TransactionTable, CsvImportModal as standalone files) — can be done in Phase 5 alongside testing.

### Phase 3 — UI Overhaul ✅ Complete

> **Note:** Decided against shadcn/ui — Tailwind + lucide-react + react-hot-toast is lighter and sufficient. shadcn/ui can be added later if needed.

- [x] Installed Tailwind CSS v3 (CRA-compatible, `tailwind.config.js`, `darkMode: 'class'`)
- [x] Replaced all `window.alert()` / DOM notification manipulation with `react-hot-toast`
- [x] New sidebar navigation with lucide-react icons and active states
- [x] New top header bar (dark mode toggle, username, logout)
- [x] Redesigned auth modal (login / register with proper form layout)
- [x] Redesigned Dashboard layout: summary cards, Add Expense/Income panels, transaction table with filters
- [x] Dark mode via `document.documentElement.classList.toggle('dark')` + Tailwind `dark:` variants
- [x] Mobile sidebar toggle (hamburger menu)
- [x] Restored shared CSS component classes in App.css (`.card`, `.btn`, `.form-input`, `.styled-table`, etc.) with CSS-variable-based dark mode for child components
- [x] Fixed dark mode in all child components: consistent color variables (`--color-surface`, `--color-input`, `--color-border`)
- [x] Replaced all `window.confirm` delete dialogs with inline "Sure?" two-click pattern (3-second timeout auto-reset)
- [x] Added `animate-pulse` Tailwind loading skeletons to BudgetGoals, Analytics chart, SpendingTrends chart
- [x] Mobile responsiveness throughout
- [x] Full Tailwind migration of Analytics, Automation, SpendingTrends — removed all three `.css` files
- [x] Dashboard category breakdown chart: fixed ResizeObserver resize loop (`maintainAspectRatio: false` + fixed `h-72` wrapper); update chart in-place on data change; `refetchOnWindowFocus: false`

### Phase 4 — Auth Hardening ✅ Complete

- [x] Access token reduced to 15 min (was 7 days); refresh token (7-day httpOnly cookie, `path: /api/auth`) stored as SHA-256 hash in `refresh_tokens` table; rotated on every use
- [x] Silent token refresh interceptor in `apiClient.js` — queues parallel 401s, retries after single refresh call, falls back to reload if refresh fails
- [x] Password reset flow: `POST /auth/forgot-password` (rate-limited, anti-enumeration) → email with 1-hour time-limited link → `POST /auth/reset-password` revokes all sessions on success
- [x] `ResetPassword.jsx` page at `/reset-password` (outside Layout, accessible when logged out)
- [x] Logout (`POST /auth/logout`) revokes refresh token in DB before clearing local state
- [x] Account deletion (`DELETE /auth/account`) removes all user-scoped data then deletes user row (cascade handles profiles/settings/tokens)
- [x] Forgot-password UI in auth modal ("Forgot password?" link in login mode)

### Phase 5 — Testing ✅ Complete

- [x] Installed Vitest + Supertest as devDependencies
- [x] Created `vitest.config.mjs` — `fileParallelism: false`, `forceExit`, loads DB credentials from `.env`
- [x] Created `backend/tests/setup.js` — `beforeAll` ensures tables exist + `afterEach` wipes test data
- [x] Created `backend/tests/auth.test.js` — 17 tests (register, login, refresh rotation, logout, forgot-password anti-enumeration, reset-password, delete account)
- [x] Created `backend/tests/expenses.test.js` — 11 tests (auth guard, empty list, create, validate category, update, delete)
- [x] Created `backend/tests/budgets.test.js` — 10 tests (create, validate, list, soft-delete, progress with real spend)
- [x] Updated `frontend/src/App.test.js` — checks auth modal renders when logged out
- [x] Added GitHub Actions CI (`.github/workflows/ci.yml`) — MySQL 8 service + backend tests + frontend build
- [x] Fixed `server.js` — `module.exports = app` + `if (require.main === module)` guard for testability
- [x] Fixed `db/index.js` — `await initAuthTables()` before `resolve()` so tables exist when tests run
- [x] Fixed `rateLimiter.js` — passthrough middleware in `NODE_ENV=test`
- [x] Fixed `routes/budgets.js` — `selectedMonth.slice(0, 7)` so YYYY-MM comparison works (was a real production bug)

**38/38 tests passing.**

### Phase 6 — DevOps ✅ Complete

- [x] Created `backend/Dockerfile` (Node 20 Alpine, prod deps only)
- [x] Created `frontend/Dockerfile` (multi-stage: CRA build with `REACT_APP_API_URL=/api` + nginx serve)
- [x] Created `frontend/nginx.conf` (SPA fallback + `/api/` proxy to backend container)
- [x] Created `docker-compose.yml` (MySQL 8 with healthcheck → migrate → backend → frontend on port 3001)
- [x] Created `backend/db/migrate.js` — versioned migration runner (skips applied files, tolerates idempotent errors)
- [x] Created `backend/db/migrations/001_initial_schema.sql` — complete schema with `user_id` columns, replaces ad-hoc `.sql` dump
- [x] Added `.env.example` (root) with `MYSQL_ROOT_PASSWORD` + `APP_PORT` documented
- [x] `.bat` file superseded by `docker compose up -d`
- [x] Fixed `migrate.js` SQL comment-stripping bug — `--` comment lines before a `CREATE TABLE` caused the entire statement to be silently dropped, triggering FK crash loop on startup; fixed with `sql.replace(/--[^\n]*/g, "")` before splitting
- [x] Added `./backend:/app/backend` volume mount — backend code changes now take effect with `docker compose restart backend` (no `--build` needed)
- [x] Configured Gmail SMTP (`smtp.gmail.com:587`) in `backend/.env` — registration confirmation and password reset emails working in Docker
- [x] `validate.js`: `z.coerce.number()` for all numeric form fields — HTML inputs always send strings; `z.number()` was rejecting them with 400

**Start the full stack:** `docker compose up -d` → app at `http://localhost:3001`

---

## 6. Priority Order

If time is limited, do phases in this order:

1. **Phase 0** (security) — can't skip
2. **Phase 3** (UI overhaul) — highest visual impact, motivating
3. **Phase 1** (backend refactor) — makes future work maintainable
4. **Phase 2** (frontend refactor) — follows naturally from Phase 3
5. **Phase 4** (auth hardening) — important but not urgent for personal use
6. **Phase 5** (testing) — required before sharing or deploying publicly
7. **Phase 6** (DevOps) — only needed when deploying beyond local machine

---

## 7. What NOT to Change

- **CSV normalizer logic** — AIB format heuristics work; leave it alone
- **Database schema** — it is well-structured with correct indexes; no need to redesign
- **Category list** — the 20 categories are the right granularity
- **Report generation logic** — PDFKit/ExcelJS output works; only move it to its own file
- **Cron scheduling** — node-cron is fine for a personal single-instance app; no need for Bull/BullMQ
- **Authentication approach** — JWT is the right choice; just add refresh tokens and rate limiting

---

## 8. Effort Estimate

| Phase | Description | Estimated Days |
|-------|-------------|----------------|
| 0 | Security fixes | 1 |
| 1 | Backend refactor | 2–3 |
| 2 | Frontend refactor | 2–3 |
| 3 | UI overhaul | 3–4 |
| 4 | Auth hardening | 1–2 |
| 5 | Testing | 2–3 |
| 6 | DevOps | 1–2 |
| **Total** | | **12–18 days** |

Phases 0 + 3 alone (4–5 days) give the biggest bang: a secure app with a modern look, without touching any working business logic.

---

## 9. Outcome

After all phases, the app will be:

- **Secure** — validated inputs, rate-limited auth, rotated secrets, refresh tokens
- **Maintainable** — <200-line modules, clear separation of concerns
- **Testable** — route-level integration tests, key component tests
- **Modern-looking** — Tailwind + shadcn/ui design system, proper navigation
- **Deployable** — Docker + CI pipeline, not a .bat file
- **Extensible** — adding a new feature means adding one route file + one page, not editing two 1000-line files
