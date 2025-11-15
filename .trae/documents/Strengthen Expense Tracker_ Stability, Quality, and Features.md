## Current State
- Backend: Node.js + Express, MySQL via `mysql2`, CSV import, reports (PDF/Excel), cron jobs in `backend/server.js`.
- Frontend: React (CRA), charts with `react-chartjs-2`, API via `axios`.
- Utilities: CSV heuristics in `backend/utils/csvNormalizer.js` (e.g., keyword → category at backend/utils/csvNormalizer.js:58).
- Tests: Minimal CRA sample test; no backend tests.
- Ops: No backend start scripts, no Docker/CI, open CORS, no auth.

## Priority Roadmap
1) Ops & Safety (fast wins)
- Add backend start/dev scripts, health endpoint, centralized error handler, request validation, tightened CORS, security headers, rate limiting.
- Move cron tasks to a separate worker or guarded scheduler.

2) Data & Import Reliability
- Fix SQL DDL issues and add missing tables (`expenses`, `credits`) and indexes.
- Make CSV import transactional with row validation, duplicate detection, and a dry‑run mode.

3) Reporting & Automation
- Honor `report_schedules` flags in generated PDFs/Excels, add localized currency/locale, improve email templates.
- Add basic delivery monitoring (last sent status, retry/backoff).

4) Frontend UX & Tests
- Replace sample test with meaningful component/integration tests (mock `axios`).
- Improve accessibility and consistent loading/error states across modals/forms.
- Add `.env.example` and developer setup notes.

5) Dev Experience & CI
- Add Docker for backend + MySQL with seeded schema.
- Add lint/format (`eslint`, `prettier`) and CI (tests + lint + build).
- Optional: begin TypeScript migration in new modules.

## Concrete Changes
- Backend scripts: `start`/`dev` running `backend/server.js`; health route `/api/health`.
- Middleware: error handler, `helmet`, `cors` restricted to frontend origin, `express-rate-limit`; validation with `zod`/`joi`.
- DB: correct `budget_goals.created_date` default, add DDL for `expenses`/`credits`, add indexes on `date`/`category`.
- CSV: pre-validate rows, wrap inserts in a transaction, add `dryRun=true` option, duplicate detection by `(name, amount, date)` within a window.
- Reports: respect schedule flags for sections, add currency/locale formatting, email subjects/body templates.
- Frontend: replace `App.test.js` with tests for dashboard, forms, API client; add ARIA roles, focus trapping in modals, skeletons/spinners + toasts.
- DevX: Dockerfiles + `docker-compose.yml`, `eslint` + `prettier` configs, GitHub Actions workflow.

## Milestones
- Phase 1 (1–2 days): Ops & Safety.
- Phase 2 (1–2 days): DB & Import.
- Phase 3 (1–2 days): Reporting.
- Phase 4 (2–3 days): Frontend & tests.
- Phase 5 (1 day): DevX & CI.

## Ready to Proceed
I will start with Phase 1 (Ops & Safety), then progress through phases, verifying each change with tests and, where applicable, local preview. Confirm to proceed or reorder priorities.