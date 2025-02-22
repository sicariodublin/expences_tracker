import axios from "axios";
import Chart from "chart.js/auto";
import React, { useEffect, useState } from "react";
import Analytics from "./Analytics";
import "./App.css";

function App() {
    // Dark Mode State
    const [darkMode, setDarkMode] = useState(() => {
      return localStorage.getItem("darkMode") === "true";
    });
  
    // Use a single effect to add/remove dark-mode and persist the state
    useEffect(() => {
      if (darkMode) {
        document.body.classList.add("dark-mode");
      } else {
        document.body.classList.remove("dark-mode");
      }
      localStorage.setItem("darkMode", darkMode);
    }, [darkMode]);
  
    const toggleDarkMode = () => setDarkMode((prevMode) => !prevMode);

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
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);
  const [credits, setCredits] = useState([]); // Store multiple credit entries
  const [creditName, setCreditName] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDate, setCreditDate] = useState("");
  const [filteredCredits, setFilteredCredits] = useState([]); // Store filtered credits
  const [creditCategory, setCreditCategory] = useState("");
  const [sortColumn, setSortColumn] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");

  const categories = [
    "Groceries",
    "Credit",
    "Gym",
    "Holidays",
    "Car",
    "Entertainment",
    "Eating Out",
    "Fee",
    "Self Care",
    "Loan/CreditCard",
    "Utilities",
    "Transport",
    "Healthcare",
    "Insurance",
    "Education",
    "Refunds",
    "Licenses",
    "Gifts",
    "Family",
    "Others",
  ];

  // Fetch expenses from the backend
  const fetchExpenses = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/expenses");
      setExpenses(res.data);
      setFilteredExpenses(res.data);
    } catch (err) {
      console.error("Error fetching expenses:", err);
    }
  };

  const fetchCredits = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/credits");
      console.log("Fetched Credits:", res.data);
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
    const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const totalCredits = filteredCredits.reduce((sum, cred) => sum + parseFloat(cred.amount), 0);
    setBalance(totalCredits - totalExpenses);
  }, [filteredExpenses, filteredCredits]);

  useEffect(() => {
    if (isModalOpen) {
      setTimeout(() => {
        const ctx = document.getElementById("categoryChart");
        if (ctx) {
          const categoryTotals = {};

          // Sum amounts for each expense category
          filteredExpenses.forEach((exp) => {
            categoryTotals[exp.category] =
              (categoryTotals[exp.category] || 0) + parseFloat(exp.amount);
          });

          // Sum amounts for each credit category
          filteredCredits.forEach((cred) => {
            categoryTotals[cred.category] =
              (categoryTotals[cred.category] || 0) + parseFloat(cred.amount);
          });

          new Chart(ctx, {
            type: "doughnut",
            data: {
              labels: Object.keys(categoryTotals),
              datasets: [
                {
                  data: Object.values(categoryTotals),
                  backgroundColor: [
                    "#FF6384",
                    "#36A2EB",
                    "#FFCE56",
                    "#4BC0C0",
                    "#9966FF",
                    "#FF9F40",
                    "#E7E9ED",
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
                    label: function (tooltipItem) {
                      return `€${tooltipItem.raw.toFixed(2)}`;
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

  useEffect(() => {
    if (isBreakdownModalOpen) {
      setTimeout(() => {
        const ctx = document.getElementById("categoryBreakdownChart");
        if (ctx) {
          const categoryTotals = {};
          filteredExpenses.forEach((exp) => {
            categoryTotals[exp.category] =
              (categoryTotals[exp.category] || 0) + parseFloat(exp.amount);
          });

          new Chart(ctx, {
            type: "doughnut",
            data: {
              labels: Object.keys(categoryTotals),
              datasets: [
                {
                  data: Object.values(categoryTotals),
                  backgroundColor: [
                    "#ff6384",
                    "#36a2eb",
                    "#ffcd56",
                    "#4bc0c0",
                    "#9966ff",
                    "#c9cbcf",
                  ],
                },
              ],
            },
          });
        }
      }, 500);
    }
  }, [isBreakdownModalOpen, filteredExpenses]);

  // Add a new expense
  const addExpense = async () => {
    if (!name || !amount || !date || !category) {
      alert("Please fill in all fields");
      return;
    }

    try {
      await axios.post("http://localhost:5000/api/expenses", {
        name,
        amount,
        date,
        category,
      });
      fetchExpenses();
      setShowExpenses(true); // Show expenses after adding
      setName("");
      setAmount("");
      setDate("");
      setCategory("");
    } catch (err) {
      console.error("Error adding expense:", err);
    }
  };

  const addCredit = async () => {
    if (!creditName || !creditAmount || !creditDate || !creditCategory) {
      alert("Please fill in all credit fields");
      return;
    }

    try {
      await axios.post("http://localhost:5000/api/credits", {
        name: creditName,
        amount: creditAmount,
        date: creditDate,
        category: creditCategory,
      });
      fetchCredits(); // Refresh credit list
      setCreditName("");
      setCreditAmount("");
      setCreditDate("");
      setCreditCategory("");
    } catch (err) {
      console.error("Error adding credit:", err);
    }
  };
    
  const handleSortExpenses = (column, dataType) => {
    setSortColumn(column);
    // Flip sorting order each time user clicks
    const newOrder = sortOrder === "asc" ? "desc" : "asc";
    setSortOrder(newOrder);
  
    // Make a copy of your filteredExpenses
    const sorted = [...filteredExpenses];
  
    sorted.sort((a, b) => {
      if (dataType === "number") {
        return newOrder === "asc"
          ? parseFloat(a[column]) - parseFloat(b[column])
          : parseFloat(b[column]) - parseFloat(a[column]);
      } else if (dataType === "date") {
        return newOrder === "asc"
          ? new Date(a[column]) - new Date(b[column])
          : new Date(b[column]) - new Date(a[column]);
      } else {
        // string sort
        return newOrder === "asc"
          ? a[column].localeCompare(b[column])
          : b[column].localeCompare(a[column]);
      }
    });
  
    setFilteredExpenses(sorted);
  };
  
  const handleSortCredits = (column, dataType) => {
    setSortColumn(column);
    const newOrder = sortOrder === "asc" ? "desc" : "asc";
    setSortOrder(newOrder);
  
    const sorted = [...filteredCredits];
  
    sorted.sort((a, b) => {
      if (dataType === "number") {
        return newOrder === "asc"
          ? parseFloat(a[column]) - parseFloat(b[column])
          : parseFloat(b[column]) - parseFloat(a[column]);
      } else if (dataType === "date") {
        return newOrder === "asc"
          ? new Date(a[column]) - new Date(b[column])
          : new Date(b[column]) - new Date(a[column]);
      } else {
        return newOrder === "asc"
          ? a[column].localeCompare(b[column])
          : b[column].localeCompare(a[column]);
      }
    });
  
    setFilteredCredits(sorted);
  };

  // Upload CSV file
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const uploadCSV = async () => {
    if (!file) {
      alert("Please select a CSV file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(
        "http://localhost:5000/api/upload",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      alert(res.data.message);
      fetchExpenses();
    } catch (err) {
      console.error("Error uploading CSV:", err);
    }
  };

  // Filter expenses
  const applyFilters = () => {
    let filteredExp = expenses;
    let filteredCred = credits;

    if (startDate && endDate) {
      filteredExp = filteredExp.filter((exp) => {
        const expDate = new Date(exp.date).toISOString().split("T")[0];
        return expDate >= startDate && expDate <= endDate;
      });

      filteredCred = filteredCred.filter((cred) => {
        const credDate = new Date(cred.date).toISOString().split("T")[0];
        return credDate >= startDate && credDate <= endDate;
      });
    }

    if (filterName) {
      filteredExp = filteredExp.filter(
        (exp) =>
          exp.name.toLowerCase().includes(filterName.toLowerCase()) ||
          exp.category.toLowerCase().includes(filterName.toLowerCase()) // 👈 Now searches in category
      );

      filteredCred = filteredCred.filter(
        (cred) =>
          cred.name.toLowerCase().includes(filterName.toLowerCase()) ||
          cred.category.toLowerCase().includes(filterName.toLowerCase()) // 👈 Now searches in category
      );
    }

    console.log("Filtered Expenses:", filteredExp); // 👈 Debugging log
    console.log("Filtered Credits:", filteredCred); // 👈 Debugging log

    setFilteredExpenses(filteredExp);
    setFilteredCredits(filteredCred);
    setShowExpenses(true);

    // Calculate total amount for filtered results
    const totalAmount = filteredExp.reduce(
      (sum, exp) => sum + parseFloat(exp.amount),
      0
    );
    setTotal(totalAmount);
  };

  // Clear filters
  const clearFilters = () => {
    setFilterName("");
    setStartDate("");
    setEndDate("");
    setFilteredExpenses(expenses); // Reset to all expenses
    setShowExpenses(false);
    setTotal(0); // Reset total amount

    // Calculate total for all expenses
    const totalAmount = expenses.reduce(
      (sum, exp) => sum + parseFloat(exp.amount),
      0
    );
    setTotal(totalAmount);
  };

  const categorizedExpenses = {};
  filteredExpenses.forEach((exp) => {
    if (!categorizedExpenses[exp.category])
      categorizedExpenses[exp.category] = [];
    categorizedExpenses[exp.category].push(exp);
  });

  const categorizedCredits = {};
  filteredCredits.forEach((cred) => {
    if (!categorizedCredits[cred.category])
      categorizedCredits[cred.category] = [];
    categorizedCredits[cred.category].push(cred);
  });

  return (
      <div className={`app-container ${darkMode ? "dark" : ""}`}>
        <h1>Expense Tracker</h1>
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="dark-mode-toggle"
          aria-label={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>
          
      {/* Form to add expenses manually */}
      <div style={{ marginBottom: "20px" }}>
        <h2>Add Expense</h2>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ marginRight: "10px" }}
        />
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ marginRight: "10px" }}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ marginRight: "10px" }}
        />
        <div className="form-group">
          <select
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
          <button onClick={addExpense}>Add Expense</button>
        </div>
      </div>

      {/* Form to add credit manually */}
      <div style={{ marginBottom: "20px" }}>
        <h2>Add Credit (Income)</h2>
        <input
          type="text"
          placeholder="Name"
          value={creditName}
          onChange={(e) => setCreditName(e.target.value)}
          style={{ marginRight: "10px" }}
        />
        <input
          type="number"
          placeholder="Amount"
          value={creditAmount}
          onChange={(e) => setCreditAmount(e.target.value)}
          style={{ marginRight: "10px" }}
        />
        <input
          type="date"
          value={creditDate}
          onChange={(e) => setCreditDate(e.target.value)}
          style={{ marginRight: "10px" }}
        />
        <div className="form-group">
          <select
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
          <button className="btn" onClick={addCredit}>
            Add Credit
          </button>
          <button className="btn" onClick={() => setIsModalOpen(true)}>
            Show Balance
          </button>
        </div>
      </div>

      {/* Form to upload CSV */}
      <div style={{ marginBottom: "20px" }}>
        <h2>Import File (CSV)</h2>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          style={{ marginRight: "10px" }}
        />
        <button onClick={uploadCSV}>Upload CSV</button>
      </div>

      <div>
        {/* Show analytics when desired, for example: */}
        {showExpenses && (
          <Analytics
            filteredExpenses={filteredExpenses}
            filteredCredits={filteredCredits}
          />
        )}
      </div>

      {/* Filters */}
      <div style={{ marginBottom: "20px" }}>
        <h2>Filters</h2>
        <input
          type="date"
          placeholder="Start Date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          style={{ marginRight: "10px" }}
        />
        <input
          type="date"
          placeholder="End Date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          style={{ marginRight: "10px" }}
        />
        <input
          type="text"
          placeholder="Filter by Name"
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          style={{ marginRight: "10px" }}
        />
        <button onClick={applyFilters} style={{ marginRight: "10px" }}>
          Apply Filters
        </button>
        <button onClick={clearFilters}>Clear</button>
      </div>

      {/* Display Total */}
      {showExpenses && (
        <div style={{ marginBottom: "20px" }}>
          <h3>Total Expenses: €{total.toFixed(2)}</h3>
          <h3>
            Total Credits: €
            {filteredCredits
              .reduce((sum, cred) => sum + parseFloat(cred.amount), 0)
              .toFixed(2)}
          </h3>
        </div>
      )}

        {showExpenses && (
        <div>
            <h2>💸 Expenses</h2>
            <table className="styled-table">
            <thead>
                <tr>
                <th onClick={() => handleSortExpenses("name", "string")}>Name</th>
                <th onClick={() => handleSortExpenses("amount", "number")}>Amount</th>
                <th onClick={() => handleSortExpenses("date", "date")}>Date</th>
                </tr>
            </thead>
            <tbody>
                {filteredExpenses.map((exp) => (
                <tr key={exp.id}>
                    <td>{exp.name}</td>
                    <td>€{exp.amount}</td>
                    <td>{new Date(exp.date).toISOString().split("T")[0]}</td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
        )}

        {showExpenses && (
        <div>
            <h2>💰 Credits</h2>
            <table className="styled-table">
            <thead>
                <tr>
                <th onClick={() => handleSortCredits("name", "string")}>Name</th>
                <th onClick={() => handleSortCredits("amount", "number")}>Amount</th>
                <th onClick={() => handleSortCredits("date", "date")}>Date</th>
                </tr>
            </thead>
            <tbody>
                {filteredCredits.map((cred) => (
                <tr key={cred.id}>
                    <td>{cred.name}</td>
                    <td>€{cred.amount}</td>
                    <td>{new Date(cred.date).toISOString().split("T")[0]}</td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
        )}


      {/* Balance Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>
              <strong>Balance Summary</strong>
            </h2>
            <p>
              <strong>Total Credit:</strong> €
              {filteredCredits
                .reduce((sum, cred) => sum + parseFloat(cred.amount), 0)
                .toFixed(2)}
            </p>
            <p>
              <strong>Total Expenses:</strong> €
              {filteredExpenses
                .reduce((sum, exp) => sum + parseFloat(exp.amount), 0)
                .toFixed(2)}
            </p>
            <p>
              <strong>Balance:</strong> €{balance.toFixed(2)}
            </p>

            {/* Chart Breakdown of Expenses and Credits by Category */}
            <h3>📊 Category Breakdown</h3>
            <canvas id="categoryChart"></canvas>

            <button onClick={() => setIsModalOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
