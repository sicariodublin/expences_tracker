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
    loadReportSchedules();
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
          <h2>Reports & Scheduling</h2>
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
