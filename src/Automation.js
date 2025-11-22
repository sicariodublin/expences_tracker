import { useCallback, useEffect, useMemo, useState } from "react";
import "./Automation.css";
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
  const [authMode, setAuthMode] = useState("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authRepeat, setAuthRepeat] = useState("");
  const [isAuthBusy, setAuthBusy] = useState(false);
  const [profile, setProfile] = useState({ first_name: "", last_name: "", date_of_birth: "", currency: "EUR", bank: "", avatar_url: "" });
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
      alert("Email settings saved");
      fetchEmailStatus();
    } catch (error) {
      console.error("Save email settings error", error);
      alert("Failed to save email settings");
    }
  };

  const loadExpectedIncomes = async () => {
    const { data } = await apiClient.get("/expected-incomes");
    setExpectedIncomes(data);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthBusy(true);
    try {
      if (authMode === "register") {
        if (!authUsername || !authPassword || authPassword !== authRepeat) {
          alert("Fill username/password and ensure passwords match.");
          return;
        }
        const { data } = await apiClient.post("/auth/register", { username: authUsername, password: authPassword });
        localStorage.setItem("auth_token", data.token);
        setAuthMode("login");
      } else {
        const { data } = await apiClient.post("/auth/login", { username: authUsername, password: authPassword });
        localStorage.setItem("auth_token", data.token);
        await fetchProfile();
        await fetchEmailSettings();
        fetchEmailStatus();
        loadReportSchedules();
      }
    } catch (error) {
      console.error("Auth error", error);
      alert("Authentication failed");
    } finally {
      setAuthBusy(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const { data } = await apiClient.get("/profile");
      setProfile({
        first_name: data?.first_name || "",
        last_name: data?.last_name || "",
        date_of_birth: data?.date_of_birth || "",
        currency: data?.currency || "EUR",
        bank: data?.bank || "",
        avatar_url: data?.avatar_url || "",
      });
    } catch (_) {}
  };

  const saveProfile = async () => {
    try {
      await apiClient.put("/profile", profile);
      alert("Profile saved");
    } catch (error) {
      console.error("Profile save error", error);
      alert("Failed to save profile");
    }
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
      alert("Enter a recipient email for the test.");
      return;
    }
    setSendingTest(true);
    try {
      const { data } = await apiClient.post("/email/test", { to: testEmail });
      if (data && data.previewUrl) {
        alert(`Test email sent. Preview: ${data.previewUrl}`);
        window.open(data.previewUrl, "_blank");
      } else {
        alert("Test email triggered. Check your inbox.");
      }
    } catch (error) {
      console.error("Failed to send test email", error);
      alert("Unable to send test email. Check server logs and configuration.");
    } finally {
      setSendingTest(false);
    }
  };

  const sendScheduleNow = async (id) => {
    setSendingScheduleId(id);
    try {
      await apiClient.post(`/report-schedules/${id}/send-now`);
      alert("Report sent.");
      loadReportSchedules();
      fetchEmailStatus();
    } catch (error) {
      console.error("Failed to send report now", error);
      alert("Unable to send report now. Ensure email is verified and check logs.");
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
    const token = localStorage.getItem("auth_token");
    if (token) {
      fetchProfile();
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
      alert("Unable to save expected income. Please try again.");
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
    if (!window.confirm("Delete this expected income?")) return;
    try {
      await apiClient.delete(`/expected-incomes/${id}`);
      loadExpectedIncomes();
      loadReconciliation();
    } catch (error) {
      console.error("Failed to delete expected income", error);
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
      alert("Unable to create recurring transaction. Please try again.");
    }
  };

  const handleRecurringDelete = async (id) => {
    if (!window.confirm("Delete this recurring transaction?")) return;
    try {
      await apiClient.delete(`/recurring-transactions/${id}`);
      loadRecurringTransactions();
    } catch (error) {
      console.error("Failed to delete recurring transaction", error);
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
      alert("Unable to export report. Please try again.");
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
      alert("Unable to create report schedule. Please try again.");
    }
  };

  const handleScheduleDelete = async (id) => {
    if (!window.confirm("Delete this schedule?")) return;
    try {
      await apiClient.delete(`/report-schedules/${id}`);
      loadReportSchedules();
    } catch (error) {
      console.error("Failed to delete schedule", error);
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

  return (
    <div className="automation-container">
      <section className="card automation-card">
        <div className="card-header">
          <h2>Account</h2>
        </div>
        <form className="grid-form" onSubmit={handleAuthSubmit}>
          <select value={authMode} onChange={(e) => setAuthMode(e.target.value)}>
            <option value="login">Login</option>
            <option value="register">Create account</option>
          </select>
          <input type="text" placeholder="Username" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} />
          <input type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
          {authMode === "register" && (
            <input type="password" placeholder="Repeat password" value={authRepeat} onChange={(e) => setAuthRepeat(e.target.value)} />
          )}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={isAuthBusy}>{authMode === "register" ? "Create account" : "Login"}</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setAuthUsername(""); setAuthPassword(""); setAuthRepeat(""); }}>Clear</button>
          </div>
        </form>
        <div className="grid-form">
          <input type="text" placeholder="First name" value={profile.first_name} onChange={(e) => setProfile((p) => ({ ...p, first_name: e.target.value }))} />
          <input type="text" placeholder="Last name" value={profile.last_name} onChange={(e) => setProfile((p) => ({ ...p, last_name: e.target.value }))} />
          <input type="date" placeholder="Date of birth" value={profile.date_of_birth} onChange={(e) => setProfile((p) => ({ ...p, date_of_birth: e.target.value }))} />
          <input type="text" placeholder="Currency" value={profile.currency} onChange={(e) => setProfile((p) => ({ ...p, currency: e.target.value }))} />
          <input type="text" placeholder="Bank" value={profile.bank} onChange={(e) => setProfile((p) => ({ ...p, bank: e.target.value }))} />
          <input type="url" placeholder="Avatar URL" value={profile.avatar_url} onChange={(e) => setProfile((p) => ({ ...p, avatar_url: e.target.value }))} />
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={saveProfile}>Save Profile</button>
          </div>
        </div>
      </section>
      <section className="card automation-card">
        <div className="card-header">
          <h2>Expected Income</h2>
        </div>
        <form className="grid-form" onSubmit={handleIncomeSubmit}>
          <input
            type="text"
            placeholder="Name"
            value={newIncome.name}
            onChange={(e) =>
              setNewIncome((prev) => ({ ...prev, name: e.target.value }))
            }
            required
          />
          <select
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
            value={newIncome.due_day}
            onChange={(e) =>
              setNewIncome((prev) => ({ ...prev, due_day: e.target.value }))
            }
          />
          <input
            type="text"
            placeholder="Notes"
            value={newIncome.notes}
            onChange={(e) =>
              setNewIncome((prev) => ({ ...prev, notes: e.target.value }))
            }
          />
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              {editingIncome ? "Update Income" : "Add Income"}
            </button>
            {editingIncome && (
              <button
                type="button"
                className="btn btn-ghost"
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
        <div className="table-wrapper">
          <table className="styled-table compact">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Expected</th>
                <th>Frequency</th>
                <th>Due</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expectedIncomes.map((income) => (
                <tr key={income.id}>
                  <td>{income.name}</td>
                  <td>{income.category}</td>
                  <td>{formatCurrency(income.expected_amount)}</td>
                  <td>{income.frequency}</td>
                  <td>{income.due_day ? `Day ${income.due_day}` : "-"}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleIncomeEdit(income)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleIncomeDelete(income.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {expectedIncomes.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No expected incomes configured yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card automation-card">
        <div className="card-header">
          <h2>Income Reconciliation</h2>
          <div className="recon-controls">
            <input
              type="month"
              value={reconciliationMonth}
              onChange={(e) => setReconciliationMonth(e.target.value)}
              max={todayMonth}
            />
          </div>
        </div>
        {isReconLoading ? (
          <p className="loading-state">Loading reconciliation...</p>
        ) : (
          <>
            <div className="recon-summary">
              <div>
                <span className="label">Expected</span>
                <strong>{formatCurrency(reconciliationTotals.expected)}</strong>
              </div>
              <div>
                <span className="label">Received</span>
                <strong>{formatCurrency(reconciliationTotals.received)}</strong>
              </div>
              <div>
                <span className="label">Difference</span>
                <strong>
                  {formatCurrency(
                    reconciliationTotals.received -
                      reconciliationTotals.expected
                  )}
                </strong>
              </div>
            </div>
            <div className="recon-grid">
              {reconciliation.map((record) => (
                <article
                  key={record.income.id}
                  className={`recon-card status-${record.status}`}
                >
                  <header>
                    <h3>{record.income.name}</h3>
                    <span className="status-pill">{record.status}</span>
                  </header>
                  <p>Category: {record.income.category}</p>
                  <p>
                    Expected: {formatCurrency(record.income.expected_amount)} by{" "}
                    {record.dueDate}
                  </p>
                  <p>
                    Received: {formatCurrency(record.receivedAmount)}{" "}
                    {record.lastReceived
                      ? `(last on ${record.lastReceived})`
                      : ""}
                  </p>
                  {record.receivedRecords.length > 0 && (
                    <details>
                      <summary>View receipts</summary>
                      <ul>
                        {record.receivedRecords.map((credit) => (
                          <li key={credit.id}>
                            {credit.date} - {credit.name}:{" "}
                            {formatCurrency(credit.amount)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </article>
              ))}
              {reconciliation.length === 0 && (
                <p className="empty-state">
                  No expected incomes found for reconciliation.
                </p>
              )}
            </div>
          </>
        )}
      </section>

      <section className="card automation-card">
        <div className="card-header">
          <h2>Recurring Transactions</h2>
        </div>
        <form className="grid-form" onSubmit={handleRecurringSubmit}>
          <select
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
            value={newRecurring.name}
            onChange={(e) =>
              setNewRecurring((prev) => ({ ...prev, name: e.target.value }))
            }
            required
          />
          <select
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
            value={newRecurring.amount}
            onChange={(e) =>
              setNewRecurring((prev) => ({ ...prev, amount: e.target.value }))
            }
            required
          />
          <select
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
            value={newRecurring.dayOfMonth}
            onChange={(e) =>
              setNewRecurring((prev) => ({
                ...prev,
                dayOfMonth: e.target.value,
              }))
            }
          />
          <select
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
            value={newRecurring.startDate}
            onChange={(e) =>
              setNewRecurring((prev) => ({
                ...prev,
                startDate: e.target.value,
              }))
            }
          />
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Add Recurring
            </button>
          </div>
        </form>
        <div className="table-wrapper">
          <table className="styled-table compact">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Frequency</th>
                <th>Next Run</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recurringTransactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{tx.type}</td>
                  <td>{tx.name}</td>
                  <td>{tx.category}</td>
                  <td>{formatCurrency(tx.amount)}</td>
                  <td>{tx.frequency}</td>
                  <td>{tx.next_run_date}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleRecurringDelete(tx.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {recurringTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">
                    No recurring transactions configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card automation-card">
        <div className="card-header">
          <h2>Email Settings</h2>
        </div>
        <div className="grid-form">
          <label>
            Provider
            <select>
              <option value="">Select...</option>
              <option value="sendgrid">SendGrid</option>
              <option value="outlook">Outlook</option>
              <option value="smtp">Generic SMTP</option>
            </select>
          </label>
          <label>
            From Email
            <input type="email" />
          </label>
          <label>
            SendGrid API Key
            <input type="password" />
          </label>
          <label>
            SMTP Host
            <input type="text" />
          </label>
          <label>
            SMTP Port
            <input type="number" />
          </label>
          <label>
            SMTP User
            <input type="text" />
          </label>
          <label>
            SMTP Password / App Password
            <input type="password" />
          </label>
        </div>
      </section>

      <section className="card automation-card">
        <div className="card-header">
          <h2>Reports & Scheduling</h2>
        </div>
        <div className="email-status-bar">
          <div>
            <strong>Email Status:</strong>
            {isEmailLoading ? (
              <span className="loading-state"> Checking...</span>
            ) : emailStatus ? (
              <span>
                {emailStatus.verified ? "Verified" : "Not verified"} {emailStatus.configured ? "(configured)" : "(not configured)"}
              </span>
            ) : (
              <span>Unknown</span>
            )}
          </div>
          <div className="email-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={fetchEmailStatus}>
              Refresh status
            </button>
            <input
              type="email"
              placeholder="Send test to..."
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              style={{ maxWidth: 240 }}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={sendTestEmail} disabled={isSendingTest}>
              {isSendingTest ? "Sending..." : "Send test"}
            </button>
          </div>
          {emailStatus && emailStatus.transport && (
            <div className="email-details">
              <span>Host: {emailStatus.transport.host}</span>
              <span>Port: {emailStatus.transport.port}</span>
              <span>Secure: {String(emailStatus.transport.secure)}</span>
            </div>
          )}
        </div>
        <div className="report-grid">
          <form className="export-form" onSubmit={handleExport}>
            <h3>Export on demand</h3>
            <label>
              Format
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
              >
                {exportFormats.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="date-range">
              <label>
                Start date
                <input
                  type="date"
                  value={exportStart}
                  onChange={(e) => setExportStart(e.target.value)}
                />
              </label>
              <label>
                End date
                <input
                  type="date"
                  value={exportEnd}
                  onChange={(e) => setExportEnd(e.target.value)}
                />
              </label>
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isExporting}
            >
              {isExporting ? "Generating..." : "Download report"}
            </button>
          </form>

          <form className="schedule-form" onSubmit={handleScheduleSubmit}>
            <h3>Schedule reports</h3>
            <input
              type="email"
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
            <label>
              Format
              <select
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
            </label>
            <label>
              Frequency
              <select
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
            </label>
            <label>
              First send date
              <input
                type="date"
                value={newSchedule.next_send_date}
                onChange={(e) =>
                  setNewSchedule((prev) => ({
                    ...prev,
                    next_send_date: e.target.value,
                  }))
                }
              />
            </label>
            <button type="submit" className="btn btn-secondary">
              Create schedule
            </button>
          </form>
        </div>
        <div className="table-wrapper">
          <table className="styled-table compact">
            <thead>
              <tr>
                <th>Email</th>
                <th>Format</th>
                <th>Frequency</th>
                <th>Next Send</th>
                <th>Status</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reportSchedules.map((schedule) => (
                <tr key={schedule.id}>
                  <td>{schedule.recipient_email}</td>
                  <td>{schedule.format}</td>
                  <td>{schedule.frequency}</td>
                  <td>{schedule.next_send_date}</td>
                  <td>{schedule.is_active ? "Active" : "Paused"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleScheduleDelete(schedule.id)}
                    >
                      Delete
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
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
                  <td colSpan={6} className="empty-state">
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
