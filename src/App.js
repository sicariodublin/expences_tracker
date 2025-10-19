import axios from "axios";
import Chart from "chart.js/auto";
import { useEffect, useState } from "react";
import Analytics from "./Analytics";
import "./App.css";
import BudgetGoals from "./BudgetGoals";
import ExpenseTemplates from './ExpenseTemplates';
import SpendingTrends from './SpendingTrends';

function App() {
  // Dark Mode State
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("darkMode") === "true";
  });

  // Navigation State
  const [activeTab, setActiveTab] = useState("dashboard");

  // Use a single effect to add/remove dark-mode and persist the state
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      document.body.classList.add("dark-mode");
    } else {
      root.classList.remove("dark");
      document.body.classList.remove("dark-mode");
    }
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prevMode) => !prevMode);

  // State Management - Updated to use string dates
  const [expenses, setExpenses] = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]);
  const [showExpenses, setShowExpenses] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState(null);
  const [filterName, setFilterName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [total, setTotal] = useState(0);
  const [balance, setBalance] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [credits, setCredits] = useState([]);
  const [creditName, setCreditName] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDate, setCreditDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [filteredCredits, setFilteredCredits] = useState([]);
  const [creditCategory, setCreditCategory] = useState("");
  const [sortColumn, setSortColumn] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");
  const [loading, setLoading] = useState(false);

  const categories = [
    "Carro",
    "Credit",
    "Eating Out",
    "Education",
    "Entertainment",
    "Family",
    "Fees",
    "Freelance",
    "Gifts",
    "Groceries",
    "Gym",
    "Healthcare",
    "Holidays",
    "Insurance",
    "Investment",
    "Licenses",
    "Loan/Credit Card",
    "Others",
    "Refunds",
    "Salary",
    "Self-Care",
    "Shopping",
    "Transport",
    "Utilities",
  ];

  // API Functions
  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const res = await axios.get("http://localhost:5000/api/expenses");
      setExpenses(res.data);
      setFilteredExpenses(res.data);
    } catch (err) {
      console.error("Error fetching expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCredits = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/credits");
      setCredits(res.data);
      setFilteredCredits(res.data);
    } catch (err) {
      console.error("Error fetching credits:", err);
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchCredits();
  }, []);

  useEffect(() => {
    const totalExpenses = filteredExpenses.reduce(
      (sum, exp) => sum + parseFloat(exp.amount),
      0
    );
    const totalCredits = filteredCredits.reduce(
      (sum, cred) => sum + parseFloat(cred.amount),
      0
    );
    setTotal(totalExpenses);
    setBalance(totalCredits - totalExpenses);
  }, [filteredExpenses, filteredCredits]);

  // Chart Effect for Modal
  useEffect(() => {
    if (isModalOpen) {
      setTimeout(() => {
        const ctx = document.getElementById("categoryChart");
        if (ctx) {
          const categoryTotals = {};

          // Sum amounts for each expense category
          filteredExpenses.forEach((exp) => {
            categoryTotals[exp.category] =
              Math.round((categoryTotals[exp.category] || 0) + parseFloat(exp.amount) * 100) / 100;
          });

          // Sum amounts for each credit category
          filteredCredits.forEach((cred) => {
            categoryTotals[cred.category] =
              Math.round((categoryTotals[cred.category] || 0) + parseFloat(cred.amount) * 100) / 100;
          });

          new Chart(ctx, {
            type: "doughnut",
            data: {
              labels: Object.keys(categoryTotals),
              datasets: [
                {
                  data: Object.values(categoryTotals),
                  backgroundColor: [
                    "#3b82f6",
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
                  ],
                },
              ],
            },
            options: {
              responsive: true,
              plugins: {
                legend: { position: "bottom" },
                tooltip: {
                  callbacks: {
                    label: function (context) {
                      return `€${context.parsed.toFixed(2)}`;
                    },
                  },
                },
              },
            },
          });
        }
      }, 500);
    }
  }, [isModalOpen, filteredExpenses, filteredCredits]);

  const addExpense = async () => {
    if (!name || !amount || !date || !category)
      return alert("Please fill in all fields");
    try {
      await axios.post("http://localhost:5000/api/expenses", {
        name,
        amount,
        date,
        category,
      });
      fetchExpenses();
      setShowExpenses(true);
      setName("");
      setAmount("");
      setDate("");
      setCategory("");
    } catch (err) {
      console.error("Error adding expense:", err);
    }
  };

  // Template-based expense addition
  const addExpenseFromTemplate = async (templateData) => {
    try {
      setLoading(true);
      await axios.post("http://localhost:5000/api/expenses", templateData);
      fetchExpenses();
      setShowExpenses(true);
      
      // Show success notification
      const notification = document.createElement('div');
      notification.className = 'template-notification';
      notification.textContent = `✅ Added ${templateData.name} (€${templateData.amount})`;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 3000);
    } catch (err) {
      console.error("Error adding expense from template:", err);
      alert("Error adding expense. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Add Credit
  const addCredit = async () => {
    if (!creditName || !creditAmount || !creditDate || !creditCategory)
      return alert("Please fill in all credit fields");
    try {
      await axios.post("http://localhost:5000/api/credits", {
        name: creditName,
        amount: creditAmount,
        date: creditDate,
        category: creditCategory,
      });
      fetchCredits();
      setCreditName("");
      setCreditAmount("");
      setCreditDate("");
      setCreditCategory("");
    } catch (err) {
      console.error("Error adding credit:", err);
    }
  };

  // Sorting Functions
  const handleSortExpenses = (column, type) => {
    const newOrder =
      sortColumn === column && sortOrder === "asc" ? "desc" : "asc";
    setSortColumn(column);
    setSortOrder(newOrder);

    const sorted = [...filteredExpenses].sort((a, b) => {
      let aVal = a[column];
      let bVal = b[column];

      if (type === "number") {
        aVal = parseFloat(aVal);
        bVal = parseFloat(bVal);
      } else if (type === "date") {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      if (newOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredExpenses(sorted);
  };

  const handleSortCredits = (column, type) => {
    const newOrder =
      sortColumn === column && sortOrder === "asc" ? "desc" : "asc";
    setSortColumn(column);
    setSortOrder(newOrder);

    const sorted = [...filteredCredits].sort((a, b) => {
      let aVal = a[column];
      let bVal = b[column];

      if (type === "number") {
        aVal = parseFloat(aVal);
        bVal = parseFloat(bVal);
      } else if (type === "date") {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      if (newOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredCredits(sorted);
  };

  // Filter Functions
  const applyFilters = () => {
    let filtered = expenses;

    if (filterName) {
      filtered = filtered.filter(
        (exp) =>
          exp.category.toLowerCase().includes(filterName.toLowerCase()) ||
          exp.name.toLowerCase().includes(filterName.toLowerCase())
      );
    }

    if (startDate) {
      filtered = filtered.filter((exp) => {
        const expDate = new Date(exp.date).toISOString().split("T")[0];
        return expDate >= startDate;
      });
    }

    if (endDate) {
      filtered = filtered.filter((exp) => {
        const expDate = new Date(exp.date).toISOString().split("T")[0];
        return expDate <= endDate;
      });
    }

    setFilteredExpenses(filtered);

    // Apply same filters to credits
    let filteredCreds = credits;

    if (filterName) {
      filteredCreds = filteredCreds.filter(
        (cred) =>
          cred.category.toLowerCase().includes(filterName.toLowerCase()) ||
          cred.name.toLowerCase().includes(filterName.toLowerCase())
      );
    }

    if (startDate) {
      filteredCreds = filteredCreds.filter((cred) => {
        const credDate = new Date(cred.date).toISOString().split("T")[0];
        return credDate >= startDate;
      });
    }

    if (endDate) {
      filteredCreds = filteredCreds.filter((cred) => {
        const credDate = new Date(cred.date).toISOString().split("T")[0];
        return credDate <= endDate;
      });
    }

    setFilteredCredits(filteredCreds);
    setShowExpenses(true);
  };

  const clearFilters = () => {
    setFilterName("");
    setStartDate("");
    setEndDate("");
    setFilteredExpenses(expenses);
    setFilteredCredits(credits);
    setShowExpenses(false);
    setTotal(0);
  };

  // File Upload Functions
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const uploadCSV = async () => {
    if (!file) {
      alert("Please select a file first");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      await axios.post("http://localhost:5000/api/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      alert("CSV uploaded successfully!");
      await fetchExpenses();
      setFile(null);
    } catch (err) {
      console.error("Error uploading CSV:", err);
      alert("Error uploading CSV. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Delete Functions
  const deleteExpense = async (id) => {
    if (window.confirm("Are you sure you want to delete this expense?")) {
      try {
        await axios.delete(`http://localhost:5000/api/expenses/${id}`);
        await fetchExpenses();
      } catch (err) {
        console.error("Error deleting expense:", err);
        alert("Error deleting expense. Please try again.");
      }
    }
  };

  const deleteCredit = async (id) => {
    if (window.confirm("Are you sure you want to delete this credit?")) {
      try {
        await axios.delete(`http://localhost:5000/api/credits/${id}`);
        await fetchCredits();
      } catch (err) {
        console.error("Error deleting credit:", err);
        alert("Error deleting credit. Please try again.");
      }
    }
  };

  // Render Functions
  const renderDashboardContent = () => (
    <>
      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card expenses">
          <div className="summary-icon">💸</div>
          <div className="summary-content">
            <h3>Total Expenses</h3>
            <p className="summary-amount">€{total.toFixed(2)}</p>
          </div>
        </div>
        <div className="summary-card income">
          <div className="summary-icon">💰</div>
          <div className="summary-content">
            <h3>Total Income</h3>
            <p className="summary-amount">
              €
              {filteredCredits
                .reduce((sum, cred) => sum + parseFloat(cred.amount), 0)
                .toFixed(2)}
            </p>
          </div>
        </div>
        <div
          className={`summary-card balance ${
            balance >= 0 ? "positive" : "negative"
          }`}
        >
          <div className="summary-icon">{balance >= 0 ? "📈" : "📉"}</div>
          <div className="summary-content">
            <h3>Balance</h3>
            <p className="summary-amount">€{balance.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Add Expense Form */}
      <div className="card">
        <div className="card-header">
          <h2>💸 Add Expense</h2>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Expense Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter expense name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Amount (€)</label>
            <input
              type="number"
              className="form-input"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
              min="0"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
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
        <button
          onClick={addExpense}
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? <span className="spinner"></span> : "Add Expense"}
        </button>
      </div>

      {/* Add Credit Form */}
      <div className="card">
        <div className="card-header">
          <h2>💰 Add Income</h2>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Income Source</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter income source"
              value={creditName}
              onChange={(e) => setCreditName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Amount (€)</label>
            <input
              type="number"
              className="form-input"
              placeholder="0.00"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              step="0.01"
              min="0"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-input"
              value={creditDate}
              onChange={(e) => setCreditDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-select"
              value={creditCategory}
              onChange={(e) => setCreditCategory(e.target.value)}
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
        <button
          onClick={addCredit}
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? <span className="spinner"></span> : "Add Income"}
        </button>
      </div>

      {/* CSV Upload */}
      <div className="card">
        <div className="card-header">
          <h2>📄 Upload CSV</h2>
        </div>
        <div className="form-group">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="form-input"
          />
          <button
            onClick={uploadCSV}
            className="btn btn-secondary"
            disabled={loading}
          >
            {loading ? <span className="spinner"></span> : "Upload CSV"}
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="card">
        <div className="card-header">
          <h2>🔍 Filter Transactions</h2>
        </div>
        <div className="form-grid">
          {/* Replace the DateInput components with simple date inputs  */}
          <div className="form-group">
            <label className="form-label">Search by Name or Category</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter name or category..."
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={endDate || new Date().toISOString().split("T")[0]}
            />
          </div>
          <div className="form-group">
            <label className="form-label">End Date</label>
            <input
              type="date"
              className="form-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              max={new Date().toISOString().split("T")[0]}
            />
          </div>
        </div>
        <div className="button-group">
          <button onClick={applyFilters} className="btn btn-primary">
            Apply Filters
          </button>
          <button onClick={clearFilters} className="btn btn-secondary">
            Clear Filters
          </button>
        </div>
      </div>

      {/* Expense Templates - Add this before the existing Add Expense Form */}
      <ExpenseTemplates 
        onAddExpense={addExpenseFromTemplate}
        categories={categories}
      />
      
      {/* Summary Cards */}
      {/* <div className="summary-grid">
        <div className="summary-card expenses">
          <div className="summary-icon">💸</div>
          <div className="summary-content">
            <h3>Total Expenses</h3>
            <p className="summary-amount">€{total.toFixed(2)}</p>
          </div>
        </div>
        <div className="summary-card income">
          <div className="summary-icon">💰</div>
          <div className="summary-content">
            <h3>Total Income</h3>
            <p className="summary-amount">
              €
              {filteredCredits
                .reduce((sum, cred) => sum + parseFloat(cred.amount), 0)
                .toFixed(2)}
            </p>
          </div>
        </div>
        <div
          className={`summary-card balance ${
            balance >= 0 ? "positive" : "negative"
          }`}
        >
          <div className="summary-icon">{balance >= 0 ? "📈" : "📉"}</div>
          <div className="summary-content">
            <h3>Balance</h3>
            <p className="summary-amount">€{balance.toFixed(2)}</p>
          </div>
        </div>
      </div> */}

      {/* Expenses Table */}
      {showExpenses && (
        <div className="table-container">
          <div className="card-header">
            <h2>💸 Expenses</h2>
            <span className="text-sm text-gray-600">
              {filteredExpenses.length} items
            </span>
          </div>
          <table className="styled-table">
            <thead>
              <tr>
                <th onClick={() => handleSortExpenses("name", "string")}>
                  Name{" "}
                  {sortColumn === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSortExpenses("amount", "number")}>
                  Amount{" "}
                  {sortColumn === "amount" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSortExpenses("date", "date")}>
                  Date{" "}
                  {sortColumn === "date" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th>Category</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{expense.name}</td>
                  <td>€{parseFloat(expense.amount).toFixed(2)}</td>
                  <td>{new Date(expense.date).toLocaleDateString()}</td>
                  <td>
                    <span className="category-badge">{expense.category}</span>
                  </td>
                  <td>
                    <button
                      onClick={() => deleteExpense(expense.id)}
                      className="btn btn-danger btn-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Credits Table */}
      {showExpenses && (
        <div className="table-container">
          <div className="card-header">
            <h2>💰 Income</h2>
            <span className="text-sm text-gray-600">
              {filteredCredits.length} items
            </span>
          </div>
          <table className="styled-table">
            <thead>
              <tr>
                <th onClick={() => handleSortCredits("name", "string")}>
                  Source{" "}
                  {sortColumn === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSortCredits("amount", "number")}>
                  Amount{" "}
                  {sortColumn === "amount" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSortCredits("date", "date")}>
                  Date{" "}
                  {sortColumn === "date" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th>Category</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCredits.map((credit) => (
                <tr key={credit.id}>
                  <td>{credit.name}</td>
                  <td>€{parseFloat(credit.amount).toFixed(2)}</td>
                  <td>{new Date(credit.date).toLocaleDateString()}</td>
                  <td>
                    <span className="category-badge">{credit.category}</span>
                  </td>
                  <td>
                    <button
                      onClick={() => deleteCredit(credit.id)}
                      className="btn btn-danger btn-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Chart Modal */}
      <div className="chart-section">
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
        >
          📊 View Category Chart
        </button>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📊 Spending by Category</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="modal-close"
              >
                ×
              </button>
            </div>
            <div className="chart-container">
              <canvas id="categoryChart"></canvas>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className={`app ${darkMode ? "dark-mode" : ""}`}>
      <header className="header">
        <div className="header-content">
          <h1 className="header-title">💰 Expense Tracker</h1>
          <button
            onClick={toggleDarkMode}
            className="dark-mode-toggle"
            aria-label="Toggle dark mode"
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      <nav className="nav-tabs">
        <button
          className={`tab-button ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          🏠 Dashboard
        </button>
        <button
          className={`tab-button ${activeTab === "budget" ? "active" : ""}`}
          onClick={() => setActiveTab("budget")}
        >
          🎯 Budget Goals
        </button>
        <button
          className={`tab-button ${activeTab === "analytics" ? "active" : ""}`}
          onClick={() => setActiveTab("analytics")}
        >
          📊 Analytics
        </button>
      </nav>

      <main className="main-content">
        <div className="tab-content">
          {activeTab === "dashboard" && renderDashboardContent()}
          {activeTab === "budget" && <BudgetGoals />}
          {activeTab === "analytics" && <Analytics />}
          {activeTab === "analytics" && <SpendingTrends />}
        </div>
      </main>
    </div>
  );
}

export default App;


  