import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import "./Analytics.css";
import apiClient from "./api/apiClient";
import { EXPENSE_CATEGORIES } from "./constants/categories";
import { formatCurrency, formatPercentage } from "./utils/format";

Chart.register(ChartDataLabels);

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const getDateParts = (value) => {
  const date = new Date(value);
  const year = date.getFullYear().toString();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return { year, month, day };
};

const sumBy = (items, selector) =>
  items.reduce((total, item) => total + (selector(item) || 0), 0);

const Analytics = () => {
  const today = new Date();
  const [chartType, setChartType] = useState("bar");
  const [viewType, setViewType] = useState("monthly");
  const [selectedMonth, setSelectedMonth] = useState(
    String(today.getMonth() + 1).padStart(2, "0")
  );
  const [selectedYear, setSelectedYear] = useState(
    today.getFullYear().toString()
  );
  const [selectedCategory, setSelectedCategory] = useState("");
  const [expenses, setExpenses] = useState([]);
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(false);

  const categories = EXPENSE_CATEGORIES;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let start;
      let end;

      if (viewType === "monthly") {
        const monthIndex = Number(selectedMonth) - 1;
        const lastDay = new Date(
          Number(selectedYear),
          monthIndex + 1,
          0
        ).getDate();
        start = `${selectedYear}-${selectedMonth}-01`;
        end = `${selectedYear}-${selectedMonth}-${String(lastDay).padStart(
          2,
          "0"
        )}`;
      } else {
        start = `${selectedYear}-01-01`;
        end = `${selectedYear}-12-31`;
      }

      const params =
        start && end
          ? {
              start,
              end,
            }
          : {};

      const [expenseRes, creditRes] = await Promise.all([
        apiClient.get("/expenses", { params }),
        apiClient.get("/credits", { params }),
      ]);

      setExpenses(expenseRes.data);
      setCredits(creditRes.data);
    } catch (error) {
      console.error("Error fetching analytics data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear, viewType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const amount = parseFloat(exp.amount);
      if (!amount) {
        return false;
      }
      const { year, month } = getDateParts(exp.date);
      if (year !== selectedYear) {
        return false;
      }
      if (viewType === "monthly" && month !== selectedMonth) {
        return false;
      }
      if (selectedCategory && exp.category !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [expenses, selectedCategory, selectedMonth, selectedYear, viewType]);

  const filteredCredits = useMemo(() => {
    return credits.filter((credit) => {
      const amount = parseFloat(credit.amount);
      if (!amount) {
        return false;
      }
      const { year, month } = getDateParts(credit.date);
      if (year !== selectedYear) {
        return false;
      }
      if (viewType === "monthly" && month !== selectedMonth) {
        return false;
      }
      if (selectedCategory && credit.category !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [credits, selectedCategory, selectedMonth, selectedYear, viewType]);

  const totalExpenses = useMemo(
    () => sumBy(filteredExpenses, (exp) => parseFloat(exp.amount)),
    [filteredExpenses]
  );

  const totalIncome = useMemo(
    () => sumBy(filteredCredits, (credit) => parseFloat(credit.amount)),
    [filteredCredits]
  );

  const netAmount = useMemo(
    () => totalIncome - totalExpenses,
    [totalExpenses, totalIncome]
  );

  const categoryBreakdown = useMemo(() => {
    const breakdown = categories.map((category) => {
      const categoryExpenses = sumBy(
        filteredExpenses.filter((exp) => exp.category === category),
        (exp) => parseFloat(exp.amount)
      );
      const categoryCredits = sumBy(
        filteredCredits.filter((credit) => credit.category === category),
        (credit) => parseFloat(credit.amount)
      );
      return {
        category,
        expenses: categoryExpenses,
        credits: categoryCredits,
        net: categoryCredits - categoryExpenses,
      };
    });

    return breakdown.filter(
      (item) => item.expenses > 0 || item.credits > 0
    );
  }, [categories, filteredCredits, filteredExpenses]);

  const topExpenseCategories = useMemo(
    () =>
      [...categoryBreakdown]
        .sort((a, b) => b.expenses - a.expenses)
        .slice(0, 5),
    [categoryBreakdown]
  );

  const chartData = useMemo(() => {
    if (loading) {
      return { labels: [], datasets: [] };
    }

    if (viewType === "monthly") {
      const daysInMonth = new Date(
        Number(selectedYear),
        Number(selectedMonth),
        0
      ).getDate();
      const labels = Array.from({ length: daysInMonth }, (_, index) =>
        String(index + 1)
      );
      const expensesByDay = Array(daysInMonth).fill(0);
      const creditsByDay = Array(daysInMonth).fill(0);

      filteredExpenses.forEach((exp) => {
        const { month, day } = getDateParts(exp.date);
        if (month !== selectedMonth) {
          return;
        }
        const idx = Number(day) - 1;
        expensesByDay[idx] += parseFloat(exp.amount) || 0;
      });

      filteredCredits.forEach((credit) => {
        const { month, day } = getDateParts(credit.date);
        if (month !== selectedMonth) {
          return;
        }
        const idx = Number(day) - 1;
        creditsByDay[idx] += parseFloat(credit.amount) || 0;
      });

      if (chartType === "doughnut") {
        const expensesTotal = expensesByDay.reduce(
          (acc, value) => acc + value,
          0
        );
        const creditsTotal = creditsByDay.reduce(
          (acc, value) => acc + value,
          0
        );
        return {
          labels: ["Expenses", "Income"],
          datasets: [
            {
              data: [expensesTotal, creditsTotal],
              backgroundColor: ["#ef4444", "#22c55e"],
            },
          ],
        };
      }

      return {
        labels,
        datasets: [
          {
            label: "Expenses",
            data: expensesByDay,
            backgroundColor:
              chartType === "bar" ? "rgba(239, 68, 68, 0.6)" : "rgba(239, 68, 68, 0.3)",
            borderColor: "#ef4444",
            borderWidth: 2,
            tension: 0.4,
            fill: chartType !== "line",
          },
          {
            label: "Income",
            data: creditsByDay,
            backgroundColor:
              chartType === "bar" ? "rgba(34, 197, 94, 0.6)" : "rgba(34, 197, 94, 0.3)",
            borderColor: "#22c55e",
            borderWidth: 2,
            tension: 0.4,
            fill: chartType !== "line",
          },
        ],
      };
    }

    if (viewType === "yearly") {
      const labels = MONTH_NAMES;
      const expensesByMonth = Array(12).fill(0);
      const creditsByMonth = Array(12).fill(0);

      filteredExpenses.forEach((exp) => {
        const { month } = getDateParts(exp.date);
        const idx = Number(month) - 1;
        expensesByMonth[idx] += parseFloat(exp.amount) || 0;
      });

      filteredCredits.forEach((credit) => {
        const { month } = getDateParts(credit.date);
        const idx = Number(month) - 1;
        creditsByMonth[idx] += parseFloat(credit.amount) || 0;
      });

      if (chartType === "doughnut") {
        return {
          labels: ["Expenses", "Income"],
          datasets: [
            {
              data: [
                sumBy(expensesByMonth, (value) => value),
                sumBy(creditsByMonth, (value) => value),
              ],
              backgroundColor: ["#ef4444", "#22c55e"],
            },
          ],
        };
      }

      return {
        labels,
        datasets: [
          {
            label: "Expenses",
            data: expensesByMonth,
            backgroundColor:
              chartType === "bar" ? "rgba(239, 68, 68, 0.6)" : "rgba(239, 68, 68, 0.3)",
            borderColor: "#ef4444",
            borderWidth: 2,
            tension: 0.4,
            fill: chartType !== "line",
          },
          {
            label: "Income",
            data: creditsByMonth,
            backgroundColor:
              chartType === "bar" ? "rgba(34, 197, 94, 0.6)" : "rgba(34, 197, 94, 0.3)",
            borderColor: "#22c55e",
            borderWidth: 2,
            tension: 0.4,
            fill: chartType !== "line",
          },
        ],
      };
    }

    // category view
    const labels = categoryBreakdown.map((item) => item.category);
    const expenseTotals = categoryBreakdown.map((item) => item.expenses);
    const creditTotals = categoryBreakdown.map((item) => item.credits);

    if (chartType === "doughnut") {
      return {
        labels,
        datasets: [
          {
            data: expenseTotals,
            backgroundColor: [
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
            ],
          },
        ],
      };
    }

    return {
      labels,
      datasets: [
        {
          label: "Expenses",
          data: expenseTotals,
          backgroundColor:
            chartType === "bar" ? "rgba(239, 68, 68, 0.6)" : "rgba(239, 68, 68, 0.3)",
          borderColor: "#ef4444",
          borderWidth: 2,
          tension: 0.4,
          fill: chartType !== "line",
        },
        {
          label: "Income",
          data: creditTotals,
          backgroundColor:
            chartType === "bar" ? "rgba(34, 197, 94, 0.6)" : "rgba(34, 197, 94, 0.3)",
          borderColor: "#22c55e",
          borderWidth: 2,
          tension: 0.4,
          fill: chartType !== "line",
        },
      ],
    };
  }, [
    categoryBreakdown,
    chartType,
    filteredCredits,
    filteredExpenses,
    loading,
    selectedMonth,
    selectedYear,
    viewType,
  ]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          position: "top",
          labels: {
            usePointStyle: true,
          },
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.9)",
          borderColor: "rgba(255, 255, 255, 0.15)",
          borderWidth: 1,
          cornerRadius: 6,
          titleColor: "#fff",
          bodyColor: "#fff",
          callbacks: {
            label(context) {
              const label = context.dataset.label || "";
              const value = context.parsed?.y ?? context.parsed;
              if (typeof value !== "number") {
                return label;
              }
              return `${label}: ${formatCurrency(value)}`;
            },
          },
        },
        datalabels: {
          display: chartType === "doughnut",
          color: "#fff",
          font: {
            weight: "bold",
          },
          formatter: (value, context) => {
            if (!value) {
              return "";
            }
            const total = context.dataset.data.reduce(
              (acc, item) => acc + item,
              0
            );
            if (!total) {
              return "";
            }
            const percentage = ((value / total) * 100).toFixed(1);
            return `${percentage}%`;
          },
        },
      },
      scales:
        chartType === "doughnut"
          ? {}
          : {
              x: {
                grid: {
                  display: false,
                },
              },
              y: {
                beginAtZero: true,
                grid: {
                  color: "rgba(148, 163, 184, 0.2)",
                },
                ticks: {
                  callback: (value) => formatCurrency(value),
                },
              },
            },
    }),
    [chartType]
  );

  const chartProps = { data: chartData, options: chartOptions };

  const ChartComponent = useMemo(() => {
    if (chartType === "line") {
      return Line;
    }
    if (chartType === "doughnut") {
      return Doughnut;
    }
    return Bar;
  }, [chartType]);

  const activeDataset =
    chartData.datasets && chartData.datasets.length > 0
      ? chartData.datasets[0].data?.reduce?.(
          (total, value) => total + value,
          0
        ) ?? 0
      : 0;

  return (
    <section className="analytics-container">
      <header className="analytics-header">
        <h2>Analytics</h2>
        <div className="analytics-controls">
          <div className="control-group">
            <label className="form-label" htmlFor="analytics-view">
              View
            </label>
            <select
              id="analytics-view"
              className="form-input"
              value={viewType}
              onChange={(event) => setViewType(event.target.value)}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="category">By Category</option>
            </select>
          </div>

          <div className="control-group">
            <label className="form-label" htmlFor="analytics-chart">
              Chart
            </label>
            <select
              id="analytics-chart"
              className="form-input"
              value={chartType}
              onChange={(event) => setChartType(event.target.value)}
            >
              <option value="bar">Bar</option>
              <option value="line">Line</option>
              <option value="doughnut">Doughnut</option>
            </select>
          </div>

          {viewType === "monthly" && (
            <>
              <div className="control-group">
                <label className="form-label" htmlFor="analytics-month">
                  Month
                </label>
                <select
                  id="analytics-month"
                  className="form-input"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                >
                  {MONTH_NAMES.map((name, index) => {
                    const value = String(index + 1).padStart(2, "0");
                    return (
                      <option key={value} value={value}>
                        {name}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="control-group">
                <label className="form-label" htmlFor="analytics-year">
                  Year
                </label>
                <input
                  id="analytics-year"
                  type="number"
                  className="form-input"
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(event.target.value)}
                  min="2000"
                  max={today.getFullYear()}
                />
              </div>
            </>
          )}

          {viewType !== "monthly" && (
            <div className="control-group">
              <label className="form-label" htmlFor="analytics-year-general">
                Year
              </label>
              <input
                id="analytics-year-general"
                type="number"
                className="form-input"
                value={selectedYear}
                onChange={(event) => setSelectedYear(event.target.value)}
                min="2000"
                max={today.getFullYear()}
              />
            </div>
          )}

          <div className="control-group">
            <label className="form-label" htmlFor="analytics-category">
              Category
            </label>
            <select
              id="analytics-category"
              className="form-input"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <section className="analytics-summary">
        <article className="summary-card">
          <span className="summary-label">Expenses</span>
          <span className="summary-value">{formatCurrency(totalExpenses)}</span>
        </article>
        <article className="summary-card">
          <span className="summary-label">Income</span>
          <span className="summary-value">{formatCurrency(totalIncome)}</span>
        </article>
        <article
          className={`summary-card ${
            netAmount >= 0 ? "positive" : "negative"
          }`}
        >
          <span className="summary-label">Net</span>
          <span className="summary-value">{formatCurrency(netAmount)}</span>
        </article>
      </section>

      <section className="analytics-chart card">
        {loading ? (
          <div className="loading-state">
            <p>Loading analytics data…</p>
          </div>
        ) : activeDataset === 0 ? (
          <div className="empty-state">
            <p>No transactions available for the selected filters.</p>
          </div>
        ) : (
          <div className="chart-wrapper">
            <ChartComponent {...chartProps} />
          </div>
        )}
      </section>

      <section className="analytics-grid">
        <article className="card analytics-card">
          <h3>Top Categories</h3>
          <ul className="category-list">
            {topExpenseCategories.map((item) => (
              <li key={item.category}>
                <span className="category-name">{item.category}</span>
                <span className="category-amount">
                  {formatCurrency(item.expenses)}
                </span>
              </li>
            ))}
            {topExpenseCategories.length === 0 && (
              <li className="empty-item">No categories to display.</li>
            )}
          </ul>
        </article>

        <article className="card analytics-card">
          <h3>Category Insights</h3>
          <ul className="insight-list">
            <li>
              <span className="insight-label">Highest spending</span>
              <span className="insight-value">
                {topExpenseCategories.length
                  ? `${topExpenseCategories[0].category} (${formatCurrency(
                      topExpenseCategories[0].expenses
                    )})`
                  : "N/A"}
              </span>
            </li>
            <li>
              <span className="insight-label">Average expense</span>
              <span className="insight-value">
                {filteredExpenses.length
                  ? formatCurrency(totalExpenses / filteredExpenses.length)
                  : formatCurrency(0)}
              </span>
            </li>
            <li>
              <span className="insight-label">Expense to income</span>
              <span className="insight-value">
                {totalIncome
                  ? formatPercentage((totalExpenses / totalIncome) * 100)
                  : "N/A"}
              </span>
            </li>
          </ul>
        </article>
      </section>
    </section>
  );
};

export default Analytics;
