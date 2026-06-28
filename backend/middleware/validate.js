const { z } = require("zod");

const CATEGORIES = [
  "Carro", "Credit", "Eating Out", "Education", "Entertainment",
  "Family", "Fees", "Gifts", "Groceries", "Gym", "Healthcare",
  "Holidays", "Income", "Investment", "Licenses", "Loan/CreditCard",
  "Others", "Self-Care", "Transport", "Utilities",
];

const FREQUENCIES = ["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"];

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");
const category = z.enum(CATEGORIES);
const positiveAmount = z.number({ invalid_type_error: "Amount must be a number" }).positive().max(10_000_000);

// ── Auth ───────────────────────────────────────────────────────────────────
const auth = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(100),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

const forgotPassword = z.object({
  email: z.string().email("Must be a valid email address").max(100),
});

const resetPassword = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

// ── Transactions ───────────────────────────────────────────────────────────
const transaction = z.object({
  name: z.string().min(1).max(200),
  amount: positiveAmount,
  date: dateStr,
  category,
});

const transactionPatch = transaction.partial().refine(
  (d) => Object.keys(d).length > 0,
  "At least one field is required"
);

// ── Budget Goals ───────────────────────────────────────────────────────────
const budgetGoal = z.object({
  category,
  monthly_limit: positiveAmount,
});

const budgetGoalPatch = budgetGoal.partial().refine(
  (d) => Object.keys(d).length > 0,
  "At least one field is required"
);

// ── Expected Incomes ───────────────────────────────────────────────────────
const expectedIncome = z.object({
  name: z.string().min(1).max(200),
  category,
  expected_amount: positiveAmount,
  frequency: z.enum(FREQUENCIES).optional(),
  due_day: z.number().int().min(1).max(31).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  last_received_date: dateStr.nullable().optional(),
});

const expectedIncomePatch = expectedIncome.partial();

// ── Recurring Transactions ─────────────────────────────────────────────────
const recurringTransaction = z.object({
  type: z.enum(["expense", "credit"]),
  name: z.string().min(1).max(200),
  category,
  amount: positiveAmount,
  frequency: z.enum(FREQUENCIES).optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  startDate: dateStr.nullable().optional(),
  is_active: z.boolean().optional(),
});

const recurringTransactionPatch = z.object({
  name: z.string().min(1).max(200).optional(),
  category: category.optional(),
  amount: positiveAmount.optional(),
  frequency: z.enum(FREQUENCIES).optional(),
  day_of_month: z.number().int().min(1).max(31).nullable().optional(),
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  next_run_date: dateStr.nullable().optional(),
  is_active: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, "At least one field is required");

// ── Report Schedules ───────────────────────────────────────────────────────
const reportSchedule = z.object({
  recipient_email: z.string().email("Must be a valid email address"),
  format: z.enum(["pdf", "excel"]).optional(),
  frequency: z.enum(["weekly", "monthly"]).optional(),
  include_budget_overview: z.boolean().optional(),
  include_trends: z.boolean().optional(),
  include_recurring: z.boolean().optional(),
  next_send_date: dateStr.optional(),
});

const reportSchedulePatch = reportSchedule.extend({
  is_active: z.boolean().optional(),
});

// ── Report Export ──────────────────────────────────────────────────────────
const reportExport = z.object({
  format: z.enum(["pdf", "excel"]).optional(),
  startDate: dateStr.nullable().optional(),
  endDate: dateStr.nullable().optional(),
});

// ── Profile ────────────────────────────────────────────────────────────────
const profile = z.object({
  first_name: z.string().max(100).nullable().optional(),
  last_name: z.string().max(100).nullable().optional(),
  date_of_birth: dateStr.nullable().optional(),
  currency: z.string().max(10).nullable().optional(),
  bank: z.string().max(100).nullable().optional(),
  avatar_url: z.string().url().max(500).or(z.literal("")).nullable().optional(),
});

// ── Email Settings ─────────────────────────────────────────────────────────
const emailSettings = z.object({
  provider: z.string().max(50).optional(),
  smtp_host: z.string().max(255).nullable().optional(),
  smtp_port: z.coerce.number().int().min(1).max(65535).nullable().optional(),
  smtp_user: z.string().max(200).nullable().optional(),
  smtp_pass: z.string().max(500).nullable().optional(),
  api_key: z.string().max(500).nullable().optional(),
  from_email: z.string().email().max(200).or(z.literal("")).nullable().optional(),
});

// ── Middleware factory ─────────────────────────────────────────────────────
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.issues.map((e) => ({
          field: e.path.join(".") || "body",
          message: e.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}

module.exports = {
  validate,
  schemas: {
    auth,
    forgotPassword,
    resetPassword,
    transaction,
    transactionPatch,
    budgetGoal,
    budgetGoalPatch,
    expectedIncome,
    expectedIncomePatch,
    recurringTransaction,
    recurringTransactionPatch,
    reportSchedule,
    reportSchedulePatch,
    reportExport,
    profile,
    emailSettings,
  },
};
