import Chart from "chart.js/auto";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Analytics from "./Analytics";
import "./App.css";
import BudgetGoals from "./BudgetGoals";
import ExpenseTemplates from "./ExpenseTemplates";
import SpendingTrends from "./SpendingTrends";
import Automation from "./Automation";
import apiClient from "./api/apiClient";
import { EXPENSE_CATEGORIES } from "./constants/categories";
import { formatCurrency } from "./utils/format";

const CHART_COLORS = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
  "#eab308",
];

const TODAY = new Date().toISOString().split("T")[0];

const SORT_ICONS = {
  asc: "↑",
  desc: "↓",
};

const parseByType = (value, type) => {
  if (type === "number") {
    return parseFloat(value) || 0;
  }
  if (type === "date") {
    return new Date(value).getTime();
  }
  return (value || "").toString().toLowerCase();
};

const sortByColumn = (collection, column, type, order) => {
  return [...collection].sort((a, b) => {
    const aVal = parseByType(a[column], type);
    const bVal = parseByType(b[column], type);

    if (aVal === bVal) {
      return 0;
    }

    if (order === "asc") {
      return aVal > bVal ? 1 : -1;
    }

    return aVal < bVal ? 1 : -1;
  });
};

function App() {
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("darkMode") === "true"
  );
  const [activeTab, setActiveTab] = useState("dashboard");
  const [expenses, setExpenses] = useState([]);
  const [credits, setCredits] = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]);
  const [filteredCredits, setFilteredCredits] = useState([]);
  const [showExpenses, setShowExpenses] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [creditName, setCreditName] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDate, setCreditDate] = useState(TODAY);
  const [creditCategory, setCreditCategory] = useState("");
  const [filterName, setFilterName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortColumn, setSortColumn] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const chartCanvasRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const fileInputRef = useRef(null);

  const categories = EXPENSE_CATEGORIES;

  // Edit modal state for inline category/name fixes
  const [editTarget, setEditTarget] = useState(null); // { type: 'expense'|'credit', record }
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", darkMode);
    document.body.classList.toggle("dark-mode", darkMode);
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prevMode) => !prevMode);

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/expenses");
      setExpenses(response.data);
      setFilteredExpenses(response.data);
    } catch (error) {
      console.error("Error fetching expenses:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCredits = useCallback(async () => {
    try {
      const response = await apiClient.get("/credits");
      setCredits(response.data);
      setFilteredCredits(response.data);
    } catch (error) {
      console.error("Error fetching credits:", error);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
    fetchCredits();
  }, [fetchExpenses, fetchCredits]);

  const totalExpenses = useMemo(
    () =>
      filteredExpenses.reduce(
        (sum, exp) => sum + (parseFloat(exp.amount) || 0),
        0
      ),
    [filteredExpenses]
  );

  const totalIncome = useMemo(
    () =>
      filteredCredits.reduce(
        (sum, credit) => sum + (parseFloat(credit.amount) || 0),
        0
      ),
    [filteredCredits]
  );

  const balance = useMemo(
    () => totalIncome - totalExpenses,
    [totalIncome, totalExpenses]
  );

  useEffect(() => {
    if (!isModalOpen) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
      return;
    }

    if (!chartCanvasRef.current) {
      return;
    }

    const totals = {};

    filteredExpenses.forEach((exp) => {
      const amount = parseFloat(exp.amount) || 0;
      totals[exp.category] = (totals[exp.category] || 0) + amount;
    });

    filteredCredits.forEach((credit) => {
      const amount = parseFloat(credit.amount) || 0;
      totals[credit.category] = (totals[credit.category] || 0) + amount;
    });

    const labels = Object.keys(totals);

    if (!labels.length) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
      return;
    }

    const data = labels.map((label) =>
      Math.round((totals[label] || 0) * 100) / 100
    );

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    chartInstanceRef.current = new Chart(chartCanvasRef.current, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: CHART_COLORS,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (context) =>
                `${context.label}: ${formatCurrency(context.raw)}`,
            },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [filteredCredits, filteredExpenses, isModalOpen]);

  const handleAddExpense = async () => {
    if (!name || !amount || !date || !category) {
      alert("Please fill in all expense fields.");
      return;
    }

    try {
      setLoading(true);
      await apiClient.post("/expenses", { name, amount, date, category });
      await fetchExpenses();
      setShowExpenses(true);
      setName("");
      setAmount("");
      setDate("");
      setCategory("");
    } catch (error) {
      console.error("Error adding expense:", error);
      alert("Could not add the expense. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const addExpenseFromTemplate = async (template) => {
    try {
      setLoading(true);
      await apiClient.post("/expenses", template);
      await fetchExpenses();
      setShowExpenses(true);

      const notification = document.createElement("div");
      notification.className = "template-notification";
      notification.textContent = `Added ${template.name} (${formatCurrency(
        template.amount
      )})`;
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.remove();
      }, 3000);
    } catch (error) {
      console.error("Error adding expense from template:", error);
      alert("Could not add the expense template. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCredit = async () => {
    if (!creditName || !creditAmount || !creditDate || !creditCategory) {
      alert("Please fill in all credit fields.");
      return;
    }

    try {
      await apiClient.post("/credits", {
        name: creditName,
        amount: creditAmount,
        date: creditDate,
        category: creditCategory,
      });
      await fetchCredits();
      setShowExpenses(true);
      setCreditName("");
      setCreditAmount("");
      setCreditDate(TODAY);
      setCreditCategory("");
    } catch (error) {
      console.error("Error adding credit:", error);
      alert("Could not add the credit. Please try again.");
    }
  };

  const handleSortExpenses = (column, type) => {
    const nextOrder =
      sortColumn === column && sortOrder === "asc" ? "desc" : "asc";
    setSortColumn(column);
    setSortOrder(nextOrder);
    setFilteredExpenses(
      sortByColumn(filteredExpenses, column, type, nextOrder)
    );
  };

  const handleSortCredits = (column, type) => {
    const nextOrder =
      sortColumn === column && sortOrder === "asc" ? "desc" : "asc";
    setSortColumn(column);
    setSortOrder(nextOrder);
    setFilteredCredits(sortByColumn(filteredCredits, column, type, nextOrder));
  };

  const applyFilters = () => {
    const query = filterName.trim().toLowerCase();

    const matchQuery = (record) =>
      !query ||
      record.name.toLowerCase().includes(query) ||
      record.category.toLowerCase().includes(query);

    const matchStart = (recordDate) =>
      !startDate || recordDate >= startDate;

    const matchEnd = (recordDate) => !endDate || recordDate <= endDate;

    const filteredExp = expenses.filter((exp) => {
      const normalizedDate = exp.date?.slice(0, 10);
      return (
        matchQuery(exp) &&
        matchStart(normalizedDate) &&
        matchEnd(normalizedDate)
      );
    });

    const filteredCreds = credits.filter((credit) => {
      const normalizedDate = credit.date?.slice(0, 10);
      return (
        matchQuery(credit) &&
        matchStart(normalizedDate) &&
        matchEnd(normalizedDate)
      );
    });

    setFilteredExpenses(filteredExp);
    setFilteredCredits(filteredCreds);
    setShowExpenses(true);
  };

  const resetFilters = () => {
    setFilterName("");
    setStartDate("");
    setEndDate("");
    setFilteredExpenses(expenses);
    setFilteredCredits(credits);
    setShowExpenses(false);
    setSortColumn(null);
    setSortOrder("asc");
  };

  const handleFileChange = (event) => {
    setFile(event.target.files?.[0] || null);
  };

  const uploadCSV = async () => {
    if (!file) {
      alert("Please select a CSV file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      await apiClient.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await fetchExpenses();
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      alert("CSV uploaded successfully.");
    } catch (error) {
      console.error("Error uploading CSV:", error);
      alert("Could not upload the CSV file. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const deleteExpense = async (id) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) {
      return;
    }

    try {
      await apiClient.delete(`/expenses/${id}`);
      await fetchExpenses();
    } catch (error) {
      console.error("Error deleting expense:", error);
      alert("Could not delete the expense. Please try again.");
    }
  };

  const openEdit = (record, type) => {
    setEditTarget({ type, record });
    setEditName(record.name || "");
    setEditCategory(record.category || "");
  };

  const closeEdit = () => {
    setEditTarget(null);
    setEditName("");
    setEditCategory("");
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    const { type, record } = editTarget;
    try {
      const payload = {};
      if (editName && editName !== record.name) payload.name = editName;
      if (editCategory && editCategory !== record.category)
        payload.category = editCategory;
      if (!Object.keys(payload).length) {
        closeEdit();
        return;
      }
      if (type === "expense") {
        await apiClient.put(`/expenses/${record.id}`, payload);
        await fetchExpenses();
      } else {
        await apiClient.put(`/credits/${record.id}`, payload);
        await fetchCredits();
      }
    } catch (error) {
      console.error("Error saving edit:", error);
      alert("Could not save changes. Please try again.");
    } finally {
      closeEdit();
    }
  };

  const deleteCredit = async (id) => {
    if (!window.confirm("Are you sure you want to delete this credit?")) {
      return;
    }

    try {
      await apiClient.delete(`/credits/${id}`);
      await fetchCredits();
    } catch (error) {
      console.error("Error deleting credit:", error);
      alert("Could not delete the credit. Please try again.");
    }
  };

  const renderSortIcon = (column) => {
    if (sortColumn !== column) {
      return null;
    }

    return (
      <span className="sort-icon" aria-hidden="true">
        {sortOrder === "asc" ? SORT_ICONS.asc : SORT_ICONS.desc}
      </span>
    );
  };

  const renderDashboardContent = () => (
    <>
      <section className="summary-grid">
        <article className="summary-card expenses">
          <div className="summary-icon" aria-hidden="true">
            EXP
          </div>
          <div className="summary-content">
            <h3>Total Expenses</h3>
            <p className="summary-amount">{formatCurrency(totalExpenses)}</p>
          </div>
        </article>
        <article className="summary-card income">
          <div className="summary-icon" aria-hidden="true">
            INC
          </div>
          <div className="summary-content">
            <h3>Total Income</h3>
            <p className="summary-amount">{formatCurrency(totalIncome)}</p>
          </div>
        </article>
        <article
          className={`summary-card balance ${
            balance >= 0 ? "positive" : "negative"
          }`}
        >
          <div className="summary-icon" aria-hidden="true">
            BAL
          </div>
          <div className="summary-content">
            <h3>Balance</h3>
            <p className="summary-amount">{formatCurrency(balance)}</p>
          </div>
        </article>
      </section>

      <section className="form-sections">
        <div className="card form-card">
          <div className="card-header">
            <h2>Add Expense</h2>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="expense-name">
                Expense Name
              </label>
              <input
                id="expense-name"
                type="text"
                className="form-input"
                placeholder="Enter expense name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="expense-amount">
                Amount
              </label>
              <input
                id="expense-amount"
                type="number"
                className="form-input"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                step="0.01"
                min="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="expense-date">
                Date
              </label>
              <input
                id="expense-date"
                type="date"
                className="form-input"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                max={TODAY}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="expense-category">
                Category
              </label>
              <select
                id="expense-category"
                className="form-select"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAddExpense}
              disabled={loading}
            >
              Add Expense
            </button>
          </div>
        </div>

        <div className="card form-card">
          <div className="card-header">
            <h2>Add Credit</h2>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="credit-name">
                Credit Name
              </label>
              <input
                id="credit-name"
                type="text"
                className="form-input"
                placeholder="Enter credit name"
                value={creditName}
                onChange={(event) => setCreditName(event.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="credit-amount">
                Amount
              </label>
              <input
                id="credit-amount"
                type="number"
                className="form-input"
                placeholder="0.00"
                value={creditAmount}
                onChange={(event) => setCreditAmount(event.target.value)}
                step="0.01"
                min="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="credit-date">
                Date
              </label>
              <input
                id="credit-date"
                type="date"
                className="form-input"
                value={creditDate}
                onChange={(event) => setCreditDate(event.target.value)}
                max={TODAY}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="credit-category">
                Category
              </label>
              <select
                id="credit-category"
                className="form-select"
                value={creditCategory}
                onChange={(event) => setCreditCategory(event.target.value)}
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleAddCredit}
            >
              Add Credit
            </button>
          </div>
        </div>
      </section>

      <ExpenseTemplates
        onAddExpense={addExpenseFromTemplate}
        categories={categories}
      />

      <section className="card filters-card">
        <div className="card-header">
          <h2>Filters</h2>
        </div>
        <div className="filter-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="filter-query">
              Search by name or category
            </label>
            <input
              id="filter-query"
              type="text"
              className="form-input"
              placeholder="E.g. groceries, rent, salary"
              value={filterName}
              onChange={(event) => setFilterName(event.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="filter-start">
              Start date
            </label>
            <input
              id="filter-start"
              type="date"
              className="form-input"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              max={TODAY}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="filter-end">
              End date
            </label>
            <input
              id="filter-end"
              type="date"
              className="form-input"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              max={TODAY}
            />
          </div>
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={applyFilters}
          >
            Apply Filters
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={resetFilters}
          >
            Reset
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setShowExpenses((prev) => !prev)}
          >
            {showExpenses ? "Hide Tables" : "Show Tables"}
          </button>
        </div>
      </section>

      <section className="card upload-card">
        <div className="card-header">
          <h2>Import Transactions</h2>
        </div>
        <div className="upload-controls">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="form-input"
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={uploadCSV}
            disabled={loading}
          >
            Upload CSV
          </button>
        </div>
      </section>

      <div className="chart-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsModalOpen(true)}
          disabled={!filteredExpenses.length && !filteredCredits.length}
        >
          View Category Breakdown
        </button>
      </div>

      {showExpenses && (
        <>
          <section className="card table-card">
            <div className="card-header">
              <h2>Expenses</h2>
              <span className="table-meta">
                {filteredExpenses.length} item
                {filteredExpenses.length === 1 ? "" : "s"}
              </span>
            </div>
            <table className="styled-table">
              <thead>
                <tr>
                  <th onClick={() => handleSortExpenses("name", "string")}>
                    Name {renderSortIcon("name")}
                  </th>
                  <th onClick={() => handleSortExpenses("amount", "number")}>
                    Amount {renderSortIcon("amount")}
                  </th>
                  <th onClick={() => handleSortExpenses("date", "date")}>
                    Date {renderSortIcon("date")}
                  </th>
                  <th>Category</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{expense.name}</td>
                    <td>{formatCurrency(expense.amount)}</td>
                    <td>
                      {new Date(expense.date).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td>
                      <span className="category-badge">
                        {expense.category}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => openEdit(expense, "expense")}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteExpense(expense.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card table-card">
            <div className="card-header">
              <h2>Income</h2>
              <span className="table-meta">
                {filteredCredits.length} item
                {filteredCredits.length === 1 ? "" : "s"}
              </span>
            </div>
            <table className="styled-table">
              <thead>
                <tr>
                  <th onClick={() => handleSortCredits("name", "string")}>
                    Source {renderSortIcon("name")}
                  </th>
                  <th onClick={() => handleSortCredits("amount", "number")}>
                    Amount {renderSortIcon("amount")}
                  </th>
                  <th onClick={() => handleSortCredits("date", "date")}>
                    Date {renderSortIcon("date")}
                  </th>
                  <th>Category</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCredits.map((credit) => (
                  <tr key={credit.id}>
                    <td>{credit.name}</td>
                    <td>{formatCurrency(credit.amount)}</td>
                    <td>
                      {new Date(credit.date).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td>
                      <span className="category-badge">
                        {credit.category}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => openEdit(credit, "credit")}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteCredit(credit.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );

  return (
    <div className={`app ${darkMode ? "dark-mode" : ""}`}>
      <header className="header">
        <div className="header-content">
          <h1 className="header-title">Expense Tracker</h1>
          <button
            type="button"
            onClick={toggleDarkMode}
            className="dark-mode-toggle"
            aria-label="Toggle dark mode"
          >
            {darkMode ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </header>

      <nav className="nav-tabs">
        <button
          type="button"
          className={`tab-button ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          Dashboard
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === "budget" ? "active" : ""}`}
          onClick={() => setActiveTab("budget")}
        >
          Budget Goals
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === "analytics" ? "active" : ""}`}
          onClick={() => setActiveTab("analytics")}
        >
          Analytics
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === "automation" ? "active" : ""}`}
          onClick={() => setActiveTab("automation")}
        >
          Automation
        </button>
      </nav>

      <main className="main-content">
        <div className="tab-content">
          {activeTab === "dashboard" && renderDashboardContent()}
          {activeTab === "budget" && <BudgetGoals />}
          {activeTab === "analytics" && (
            <>
              <Analytics />
              <SpendingTrends />
            </>
          )}
          {activeTab === "automation" && <Automation />}
        </div>
      </main>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Spending by Category</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="modal-close"
                aria-label="Close chart modal"
              >
                ×
              </button>
            </div>
            <div className="chart-container">
              {filteredExpenses.length || filteredCredits.length ? (
                <canvas ref={chartCanvasRef} />
              ) : (
                <p className="chart-empty">
                  Add expenses or credits to view the category breakdown.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit {editTarget.type === "expense" ? "Expense" : "Income"}</h2>
              <button
                type="button"
                onClick={closeEdit}
                className="modal-close"
                aria-label="Close edit modal"
              >
                ×
              </button>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={saveEdit}>
                Save Changes
              </button>
              <button type="button" className="btn btn-ghost" onClick={closeEdit}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
