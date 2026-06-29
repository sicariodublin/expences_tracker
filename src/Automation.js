import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import apiClient from "./api/apiClient";
import { EXPENSE_CATEGORIES } from "./constants/categories";
import { formatCurrency } from "./utils/format";

const emptyIncome = {
  name: "",
  category: "",
  expected_amount: "",
  frequency: "monthly",
  due_day: "",
  notes: "",
};

const emptyRecurring = {
  type: "expense",
  name: "",
  category: "",
  amount: "",
  frequency: "monthly",
  dayOfMonth: "",
  weekday: "",
  startDate: "",
};

const emptySchedule = {
  recipient_email: "",
  format: "pdf",
  frequency: "monthly",
  next_send_date: "",
};

const frequencyOptions = [
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
  { label: "Yearly", value: "yearly" },
  { label: "One-time", value: "one-time" },
];

const recurringFrequencyOptions = [
  { label: "Weekly", value: "weekly" },
  { label: "Bi-weekly", value: "biweekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
  { label: "Yearly", value: "yearly" },
];

const weekdayLabels = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const exportFormats = [
  { label: "PDF", value: "pdf" },
  { label: "Excel", value: "excel" },
];

const scheduleFrequencies = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];

const todayMonth = new Date().toISOString().slice(0, 7);

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const Automation = () => {
  const [expectedIncomes, setExpectedIncomes] = useState([]);
  const [newIncome, setNewIncome] = useState(emptyIncome);
  const [editingIncome, setEditingIncome] = useState(null);

  const [recurringTransactions, setRecurringTransactions] = useState([]);
  const [newRecurring, setNewRecurring] = useState(emptyRecurring);

  const [reconciliationMonth, setReconciliationMonth] = useState(todayMonth);
  const [reconciliation, setReconciliation] = useState([]);
  const [isReconLoading, setReconLoading] = useState(false);

  const [exportFormat, setExportFormat] = useState("pdf");
  const [exportStart, setExportStart] = useState("");
  const [exportEnd, setExportEnd] = useState("");
  const [isExporting, setExporting] = useState(false);

  const [reportSchedules, setReportSchedules] = useState([]);
  const [newSchedule, setNewSchedule] = useState(emptySchedule);
  const [emailStatus, setEmailStatus] = useState(null);
  const [isEmailLoading, setEmailLoading] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [isSendingTest, setSendingTest] = useState(false);
  const [sendingScheduleId, setSendingScheduleId] = useState(null);

  const [confirmIncomeId, setConfirmIncomeId] = useState(null);
  const [confirmRecurringId, setConfirmRecurringId] = useState(null);
  const [confirmScheduleId, setConfirmScheduleId] = useState(null);

  const [emailProvider, setEmailProvider] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [sendgridKey, setSendgridKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");

  const fetchEmailSettings = async () => {
    try {
      const { data } = await apiClient.get("/email/settings");
      setEmailProvider(data?.provider || "");
      setSmtpHost(data?.smtp_host || "");
      setSmtpPort(data?.smtp_port || 587);
      setSmtpUser(data?.smtp_user || "");
      setFromEmail(data?.from_email || "");
    } catch (_) {}
  };

  const saveEmailSettings = async () => {
    try {
      const payload = {
        provider: emailProvider,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        smtp_pass: smtpPass || undefined,
        api_key: sendgridKey || undefined,
        from_email: fromEmail,
      };
      await apiClient.put("/email/settings", payload);
      toast.success("Email settings saved.");
      fetchEmailStatus();
    } catch (error) {
      console.error("Save email settings error", error);
      toast.error("Failed to save email settings.");
    }
  };

  const loadExpectedIncomes = async () => {
    const { data } = await apiClient.get("/expected-incomes");
    setExpectedIncomes(data);
  };



  const loadRecurringTransactions = async () => {
    const { data } = await apiClient.get("/recurring-transactions");
    setRecurringTransactions(data);
  };

  const loadReportSchedules = async () => {
    const { data } = await apiClient.get("/report-schedules");
    setReportSchedules(data);
  };

  const fetchEmailStatus = async () => {
    setEmailLoading(true);
    try {
      const { data } = await apiClient.get("/email/status");
      setEmailStatus(data);
    } catch (error) {
      console.error("Failed to fetch email status", error);
      setEmailStatus({ configured: false, verified: false, error: "Unable to fetch status" });
    } finally {
      setEmailLoading(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail) {
      toast.error("Enter a recipient email for the test.");
      return;
    }
    setSendingTest(true);
    try {
      const { data } = await apiClient.post("/email/test", { to: testEmail });
      if (data && data.previewUrl) {
        toast.success("Test email sent. Opening preview…");
        window.open(data.previewUrl, "_blank");
      } else {
        toast.success("Test email triggered. Check your inbox.");
      }
    } catch (error) {
      console.error("Failed to send test email", error);
      toast.error("Unable to send test email. Check server logs and configuration.");
    } finally {
      setSendingTest(false);
    }
  };

  const sendScheduleNow = async (id) => {
    setSendingScheduleId(id);
    try {
      await apiClient.post(`/report-schedules/${id}/send-now`);
      toast.success("Report sent.");
      loadReportSchedules();
      fetchEmailStatus();
    } catch (error) {
      console.error("Failed to send report now", error);
      toast.error("Unable to send report now. Ensure email is verified and check logs.");
    } finally {
      setSendingScheduleId(null);
    }
  };

  const loadReconciliation = useCallback(
    async (targetMonth = reconciliationMonth) => {
      setReconLoading(true);
      try {
        const { data } = await apiClient.get("/income-reconciliation", {
          params: { month: targetMonth },
        });
        setReconciliation(data.results || []);
      } catch (error) {
        console.error("Failed to load reconciliation", error);
      } finally {
        setReconLoading(false);
      }
    },
    [reconciliationMonth]
  );

  useEffect(() => {
    loadExpectedIncomes();
    loadRecurringTransactions();
    fetchEmailStatus();
    const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
    if (token) {
      fetchEmailSettings();
      loadReportSchedules();
    }
  }, []);

  useEffect(() => {
    loadReconciliation(reconciliationMonth);
  }, [loadReconciliation, reconciliationMonth]);

  const handleIncomeSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      ...newIncome,
      expected_amount: Number(newIncome.expected_amount || 0),
      due_day: newIncome.due_day ? Number(newIncome.due_day) : null,
    };
    try {
      if (editingIncome) {
        await apiClient.put(`/expected-incomes/${editingIncome.id}`, {
          ...payload,
          last_received_date: editingIncome.last_received_date || null,
        });
      } else {
        await apiClient.post("/expected-incomes", payload);
      }
      setNewIncome(emptyIncome);
      setEditingIncome(null);
      loadExpectedIncomes();
      loadReconciliation();
    } catch (error) {
      console.error("Failed to save expected income", error);
      toast.error("Unable to save expected income. Please try again.");
    }
  };

  const handleIncomeEdit = (income) => {
    setEditingIncome(income);
    setNewIncome({
      name: income.name,
      category: income.category,
      expected_amount: income.expected_amount,
      frequency: income.frequency,
      due_day: income.due_day ?? "",
      notes: income.notes ?? "",
    });
  };

  const handleIncomeDelete = async (id) => {
    if (confirmIncomeId !== id) {
      setConfirmIncomeId(id);
      setTimeout(() => setConfirmIncomeId((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    setConfirmIncomeId(null);
    try {
      await apiClient.delete(`/expected-incomes/${id}`);
      loadExpectedIncomes();
      loadReconciliation();
    } catch (error) {
      console.error("Failed to delete expected income", error);
      toast.error("Could not delete. Please try again.");
    }
  };

  const handleRecurringSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      ...newRecurring,
      amount: Number(newRecurring.amount || 0),
      dayOfMonth: newRecurring.dayOfMonth
        ? Number(newRecurring.dayOfMonth)
        : null,
      weekday: newRecurring.weekday !== ""
        ? Number(newRecurring.weekday)
        : null,
    };

    try {
      await apiClient.post("/recurring-transactions", payload);
      setNewRecurring(emptyRecurring);
      loadRecurringTransactions();
    } catch (error) {
      console.error("Failed to create recurring transaction", error);
      toast.error("Unable to create recurring transaction. Please try again.");
    }
  };

  const handleRecurringDelete = async (id) => {
    if (confirmRecurringId !== id) {
      setConfirmRecurringId(id);
      setTimeout(() => setConfirmRecurringId((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    setConfirmRecurringId(null);
    try {
      await apiClient.delete(`/recurring-transactions/${id}`);
      loadRecurringTransactions();
    } catch (error) {
      console.error("Failed to delete recurring transaction", error);
      toast.error("Could not delete. Please try again.");
    }
  };

  const handleExport = async (event) => {
    event.preventDefault();
    setExporting(true);
    try {
      const { data } = await apiClient.post(
        "/reports/export",
        {
          format: exportFormat,
          startDate: exportStart || undefined,
          endDate: exportEnd || undefined,
        },
        { responseType: "blob" }
      );

      const filename = `expense-report.${
        exportFormat === "pdf" ? "pdf" : "xlsx"
      }`;
      downloadBlob(data, filename);
    } catch (error) {
      console.error("Failed to export report", error);
      toast.error("Unable to export report. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleScheduleSubmit = async (event) => {
    event.preventDefault();
    try {
      await apiClient.post("/report-schedules", newSchedule);
      setNewSchedule(emptySchedule);
      loadReportSchedules();
    } catch (error) {
      console.error("Failed to create schedule", error);
      toast.error("Unable to create report schedule. Please try again.");
    }
  };

  const handleScheduleDelete = async (id) => {
    if (confirmScheduleId !== id) {
      setConfirmScheduleId(id);
      setTimeout(() => setConfirmScheduleId((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    setConfirmScheduleId(null);
    try {
      await apiClient.delete(`/report-schedules/${id}`);
      loadReportSchedules();
    } catch (error) {
      console.error("Failed to delete schedule", error);
      toast.error("Could not delete. Please try again.");
    }
  };

  const reconciliationTotals = useMemo(() => {
    return reconciliation.reduce(
      (acc, record) => {
        acc.expected += Number(record.income.expected_amount || 0);
        acc.received += Number(record.receivedAmount || 0);
        return acc;
      },
      { expected: 0, received: 0 }
    );
  }, [reconciliation]);

  const cardCls = "bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm";
  const inputCls = "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400 dark:placeholder-slate-500";
  const labelCls = "block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1";
  const btnPrimary = "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const btnSecondary = "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium transition-colors";
  const btnGhost = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium transition-colors";
  const btnDanger = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-medium transition-colors";
  const thCls = "px-3 py-2.5 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-700/50";
  const tdCls = "px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300";

  const statusColors = {
    on_track: "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20",
    partial:  "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20",
    missing:  "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20",
    late:     "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20",
  };
  const pillColors = {
    on_track: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    partial:  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    missing:  "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    late:     "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  };

  const diff = reconciliationTotals.received - reconciliationTotals.expected;

  return (
    <div className="space-y-6">

      {/* Expected Income */}
      <section className={cardCls + " p-6"}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Expected Income</h2>
        </div>
        <form onSubmit={handleIncomeSubmit}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <input
              type="text"
              placeholder="Name"
              className={inputCls}
              value={newIncome.name}
              onChange={(e) =>
                setNewIncome((prev) => ({ ...prev, name: e.target.value }))
              }
              required
            />
            <select
              className={inputCls}
              value={newIncome.category}
              onChange={(e) =>
                setNewIncome((prev) => ({ ...prev, category: e.target.value }))
              }
              required
            >
              <option value="">Category</option>
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Expected amount"
              className={inputCls}
              value={newIncome.expected_amount}
              onChange={(e) =>
                setNewIncome((prev) => ({
                  ...prev,
                  expected_amount: e.target.value,
                }))
              }
              required
            />
            <select
              className={inputCls}
              value={newIncome.frequency}
              onChange={(e) =>
                setNewIncome((prev) => ({ ...prev, frequency: e.target.value }))
              }
            >
              {frequencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              max="31"
              placeholder="Due day (optional)"
              className={inputCls}
              value={newIncome.due_day}
              onChange={(e) =>
                setNewIncome((prev) => ({ ...prev, due_day: e.target.value }))
              }
            />
            <input
              type="text"
              placeholder="Notes"
              className={inputCls}
              value={newIncome.notes}
              onChange={(e) =>
                setNewIncome((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          </div>
          <div className="flex gap-2 mt-2">
            <button type="submit" className={btnPrimary}>
              {editingIncome ? "Update Income" : "Add Income"}
            </button>
            {editingIncome && (
              <button
                type="button"
                className={btnGhost}
                onClick={() => {
                  setEditingIncome(null);
                  setNewIncome(emptyIncome);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
        <div className="overflow-x-auto mt-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className={thCls}>Name</th>
                <th className={thCls}>Category</th>
                <th className={thCls}>Expected</th>
                <th className={thCls}>Frequency</th>
                <th className={thCls}>Due</th>
                <th className={thCls}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {expectedIncomes.map((income) => (
                <tr key={income.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className={tdCls}>{income.name}</td>
                  <td className={tdCls}>{income.category}</td>
                  <td className={tdCls}>{formatCurrency(income.expected_amount)}</td>
                  <td className={tdCls}>{income.frequency}</td>
                  <td className={tdCls}>{income.due_day ? `Day ${income.due_day}` : "-"}</td>
                  <td className={tdCls}>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={() => handleIncomeEdit(income)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={btnDanger}
                        onClick={() => handleIncomeDelete(income.id)}
                      >
                        {confirmIncomeId === income.id ? "Sure?" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {expectedIncomes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                    No expected incomes configured yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Income Reconciliation */}
      <section className={cardCls + " p-6"}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Income Reconciliation</h2>
          <input
            type="month"
            className={inputCls.replace("w-full", "w-auto")}
            value={reconciliationMonth}
            onChange={(e) => setReconciliationMonth(e.target.value)}
            max={todayMonth}
          />
        </div>
        {isReconLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-4">Loading reconciliation...</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Expected</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(reconciliationTotals.expected)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Received</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(reconciliationTotals.received)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Difference</p>
                <p className={`text-lg font-bold ${diff >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatCurrency(diff)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {reconciliation.map((record) => (
                <article
                  key={record.income.id}
                  className={`rounded-xl border p-4 ${statusColors[record.status] || "border-slate-200 dark:border-slate-700"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{record.income.name}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pillColors[record.status] || ""}`}>{record.status}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Category: {record.income.category}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Expected: {formatCurrency(record.income.expected_amount)} by {record.dueDate}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Received: {formatCurrency(record.receivedAmount)}{" "}
                    {record.lastReceived ? `(last on ${record.lastReceived})` : ""}
                  </p>
                  {record.receivedRecords.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer">View receipts</summary>
                      <ul className="mt-1 space-y-0.5">
                        {record.receivedRecords.map((credit) => (
                          <li key={credit.id} className="text-xs text-slate-500 dark:text-slate-400">
                            {credit.date} - {credit.name}: {formatCurrency(credit.amount)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </article>
              ))}
              {reconciliation.length === 0 && (
                <p className="col-span-full text-sm text-center text-slate-400 dark:text-slate-500 py-8">
                  No expected incomes found for reconciliation.
                </p>
              )}
            </div>
          </>
        )}
      </section>

      {/* Recurring Transactions */}
      <section className={cardCls + " p-6"}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Recurring Transactions</h2>
        </div>
        <form onSubmit={handleRecurringSubmit}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <select
              className={inputCls}
              value={newRecurring.type}
              onChange={(e) =>
                setNewRecurring((prev) => ({ ...prev, type: e.target.value }))
              }
            >
              <option value="expense">Expense</option>
              <option value="credit">Income</option>
            </select>
            <input
              type="text"
              placeholder="Name"
              className={inputCls}
              value={newRecurring.name}
              onChange={(e) =>
                setNewRecurring((prev) => ({ ...prev, name: e.target.value }))
              }
              required
            />
            <select
              className={inputCls}
              value={newRecurring.category}
              onChange={(e) =>
                setNewRecurring((prev) => ({ ...prev, category: e.target.value }))
              }
              required
            >
              <option value="">Category</option>
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount"
              className={inputCls}
              value={newRecurring.amount}
              onChange={(e) =>
                setNewRecurring((prev) => ({ ...prev, amount: e.target.value }))
              }
              required
            />
            <select
              className={inputCls}
              value={newRecurring.frequency}
              onChange={(e) =>
                setNewRecurring((prev) => ({
                  ...prev,
                  frequency: e.target.value,
                }))
              }
            >
              {recurringFrequencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              max="31"
              placeholder="Day of month"
              className={inputCls}
              value={newRecurring.dayOfMonth}
              onChange={(e) =>
                setNewRecurring((prev) => ({
                  ...prev,
                  dayOfMonth: e.target.value,
                }))
              }
            />
            <select
              className={inputCls}
              value={newRecurring.weekday}
              onChange={(e) =>
                setNewRecurring((prev) => ({
                  ...prev,
                  weekday: e.target.value,
                }))
              }
            >
              <option value="">Weekday (optional)</option>
              {weekdayLabels.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
            <input
              type="date"
              className={inputCls}
              value={newRecurring.startDate}
              onChange={(e) =>
                setNewRecurring((prev) => ({
                  ...prev,
                  startDate: e.target.value,
                }))
              }
            />
          </div>
          <div className="flex gap-2 mt-2">
            <button type="submit" className={btnPrimary}>
              Add Recurring
            </button>
          </div>
        </form>
        <div className="overflow-x-auto mt-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className={thCls}>Type</th>
                <th className={thCls}>Name</th>
                <th className={thCls}>Category</th>
                <th className={thCls}>Amount</th>
                <th className={thCls}>Frequency</th>
                <th className={thCls}>Next Run</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {recurringTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className={tdCls}>{tx.type}</td>
                  <td className={tdCls}>{tx.name}</td>
                  <td className={tdCls}>{tx.category}</td>
                  <td className={tdCls}>{formatCurrency(tx.amount)}</td>
                  <td className={tdCls}>{tx.frequency}</td>
                  <td className={tdCls}>{tx.next_run_date}</td>
                  <td className={tdCls}>
                    <button
                      type="button"
                      className={btnDanger}
                      onClick={() => handleRecurringDelete(tx.id)}
                    >
                      {confirmRecurringId === tx.id ? "Sure?" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
              {recurringTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                    No recurring transactions configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Email Settings */}
      <section className={cardCls + " p-6"}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Email Settings</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelCls}>Provider</label>
            <select className={inputCls} value={emailProvider} onChange={(e) => setEmailProvider(e.target.value)}>
              <option value="">Select...</option>
              <option value="sendgrid">SendGrid</option>
              <option value="outlook">Outlook</option>
              <option value="smtp">Generic SMTP</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>From Email</label>
            <input type="email" className={inputCls} value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>SendGrid API Key</label>
            <input type="password" className={inputCls} value={sendgridKey} onChange={(e) => setSendgridKey(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>SMTP Host</label>
            <input type="text" className={inputCls} value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>SMTP Port</label>
            <input type="number" className={inputCls} value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value) || 0)} />
          </div>
          <div>
            <label className={labelCls}>SMTP User</label>
            <input type="text" className={inputCls} value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>SMTP Password / App Password</label>
            <input type="password" className={inputCls} value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} />
          </div>
        </div>
        <button type="button" className={btnSecondary} onClick={saveEmailSettings}>Save Email Settings</button>
      </section>

      {/* Reports & Scheduling */}
      <section className={cardCls + " p-6"}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Reports &amp; Scheduling</h2>
        </div>

        {/* Email Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-700 dark:text-slate-300">
            <strong>Email Status: </strong>
            {isEmailLoading ? (
              <span> Checking...</span>
            ) : emailStatus ? (
              <span>
                {emailStatus.verified ? "Verified" : "Not verified"}{" "}
                {emailStatus.configured ? "(configured)" : "(not configured)"}
              </span>
            ) : (
              <span>Unknown</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btnGhost} onClick={fetchEmailStatus}>
              Refresh status
            </button>
            <input
              type="email"
              className={inputCls.replace("w-full", "w-auto")}
              placeholder="Send test to..."
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              style={{ maxWidth: 240 }}
            />
            <button
              type="button"
              className={btnPrimary.replace("px-4 py-2", "px-3 py-1.5 text-xs")}
              onClick={sendTestEmail}
              disabled={isSendingTest}
            >
              {isSendingTest ? "Sending..." : "Send test"}
            </button>
          </div>
          {emailStatus?.transport && (
            <div className="flex gap-4 text-xs text-slate-400 dark:text-slate-500 w-full">
              <span>Host: {emailStatus.transport.host}</span>
              <span>Port: {emailStatus.transport.port}</span>
              <span>Secure: {String(emailStatus.transport.secure)}</span>
            </div>
          )}
        </div>

        {/* Report Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Export on demand */}
          <form onSubmit={handleExport} className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Export on demand</h3>
            <div>
              <label className={labelCls}>Format</label>
              <select
                className={inputCls}
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
              >
                {exportFormats.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Start date</label>
                <input
                  type="date"
                  className={inputCls}
                  value={exportStart}
                  onChange={(e) => setExportStart(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>End date</label>
                <input
                  type="date"
                  className={inputCls}
                  value={exportEnd}
                  onChange={(e) => setExportEnd(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className={btnPrimary} disabled={isExporting}>
              {isExporting ? "Generating..." : "Download report"}
            </button>
          </form>

          {/* Schedule reports */}
          <form onSubmit={handleScheduleSubmit} className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Schedule reports</h3>
            <div>
              <label className={labelCls}>Recipient email</label>
              <input
                type="email"
                className={inputCls}
                placeholder="Recipient email"
                value={newSchedule.recipient_email}
                onChange={(e) =>
                  setNewSchedule((prev) => ({
                    ...prev,
                    recipient_email: e.target.value,
                  }))
                }
                required
              />
            </div>
            <div>
              <label className={labelCls}>Format</label>
              <select
                className={inputCls}
                value={newSchedule.format}
                onChange={(e) =>
                  setNewSchedule((prev) => ({
                    ...prev,
                    format: e.target.value,
                  }))
                }
              >
                {exportFormats.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Frequency</label>
              <select
                className={inputCls}
                value={newSchedule.frequency}
                onChange={(e) =>
                  setNewSchedule((prev) => ({
                    ...prev,
                    frequency: e.target.value,
                  }))
                }
              >
                {scheduleFrequencies.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>First send date</label>
              <input
                type="date"
                className={inputCls}
                value={newSchedule.next_send_date}
                onChange={(e) =>
                  setNewSchedule((prev) => ({
                    ...prev,
                    next_send_date: e.target.value,
                  }))
                }
              />
            </div>
            <button type="submit" className={btnSecondary}>
              Create schedule
            </button>
          </form>
        </div>

        {/* Scheduled reports table */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className={thCls}>Email</th>
                <th className={thCls}>Format</th>
                <th className={thCls}>Frequency</th>
                <th className={thCls}>Next Send</th>
                <th className={thCls}>Status</th>
                <th className={thCls}></th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {reportSchedules.map((schedule) => (
                <tr key={schedule.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className={tdCls}>{schedule.recipient_email}</td>
                  <td className={tdCls}>{schedule.format}</td>
                  <td className={tdCls}>{schedule.frequency}</td>
                  <td className={tdCls}>{schedule.next_send_date}</td>
                  <td className={tdCls}>{schedule.is_active ? "Active" : "Paused"}</td>
                  <td className={tdCls}>
                    <button
                      type="button"
                      className={btnDanger}
                      onClick={() => handleScheduleDelete(schedule.id)}
                    >
                      {confirmScheduleId === schedule.id ? "Sure?" : "Delete"}
                    </button>
                  </td>
                  <td className={tdCls}>
                    <button
                      type="button"
                      className={btnPrimary.replace("px-4 py-2", "px-3 py-1.5 text-xs")}
                      onClick={() => sendScheduleNow(schedule.id)}
                      disabled={sendingScheduleId === schedule.id}
                    >
                      {sendingScheduleId === schedule.id ? "Sending..." : "Send now"}
                    </button>
                  </td>
                </tr>
              ))}
              {reportSchedules.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                    No scheduled reports yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default Automation;
