import "chart.js/auto";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import apiClient from "./api/apiClient";
import "./SpendingTrends.css";
import { formatCurrency, formatPercentage } from "./utils/format";

const MONTH_LABELS = [
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

const parseAmount = (value) => parseFloat(value) || 0;

const SpendingTrends = () => {
  const today = new Date();
  const [expenses, setExpenses] = useState([]);
  const [credits, setCredits] = useState([]);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [chartType, setChartType] = useState("line");
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [expenseRes, creditRes] = await Promise.all([
        apiClient.get("/expenses"),
        apiClient.get("/credits"),
      ]);
      setExpenses(expenseRes.data);
      setCredits(creditRes.data);
    } catch (error) {
      console.error("Error fetching spending trends:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const buildYearlyTotals = useCallback(
    (items, yearOffset = 0) => {
      const targetYear = selectedYear - yearOffset;
      const totals = Array(12).fill(0);

      items.forEach((item) => {
        const date = new Date(item.date);
        if (date.getFullYear() === targetYear) {
          const monthIndex = date.getMonth();
          totals[monthIndex] += parseAmount(item.amount);
        }
      });

      return totals;
    },
    [selectedYear]
  );

  const currentYearExpenses = useMemo(
    () => buildYearlyTotals(expenses, 0),
    [buildYearlyTotals, expenses]
  );

  const previousYearExpenses = useMemo(
    () => buildYearlyTotals(expenses, 1),
    [buildYearlyTotals, expenses]
  );

  const currentYearIncome = useMemo(
    () => buildYearlyTotals(credits, 0),
    [buildYearlyTotals, credits]
  );

  const previousYearIncome = useMemo(
    () => buildYearlyTotals(credits, 1),
    [buildYearlyTotals, credits]
  );

  const totals = useMemo(() => {
    const currentExpenses = currentYearExpenses.reduce((acc, val) => acc + val, 0);
    const previousExpenses = previousYearExpenses.reduce((acc, val) => acc + val, 0);
    const currentIncome = currentYearIncome.reduce((acc, val) => acc + val, 0);
    const previousIncome = previousYearIncome.reduce((acc, val) => acc + val, 0);

    const expenseGrowth =
      previousExpenses === 0
        ? currentExpenses > 0
          ? 100
          : 0
        : ((currentExpenses - previousExpenses) / previousExpenses) * 100;

    const incomeGrowth =
      previousIncome === 0
        ? currentIncome > 0
          ? 100
          : 0
        : ((currentIncome - previousIncome) / previousIncome) * 100;

    const currentBalance = currentIncome - currentExpenses;
    const previousBalance = previousIncome - previousExpenses;

    return {
      currentExpenses,
      previousExpenses,
      currentIncome,
      previousIncome,
      currentBalance,
      previousBalance,
      expenseGrowth,
      incomeGrowth,
      balanceGrowth:
        previousBalance === 0
          ? currentBalance > 0
            ? 100
            : 0
          : ((currentBalance - previousBalance) / Math.abs(previousBalance)) * 100,
    };
  }, [
    currentYearExpenses,
    currentYearIncome,
    previousYearExpenses,
    previousYearIncome,
  ]);

  const chartData = useMemo(() => {
    const datasets =
      chartType === "bar"
        ? [
            {
              label: `${selectedYear} Expenses`,
              data: currentYearExpenses,
              backgroundColor: "rgba(239, 68, 68, 0.7)",
            },
            {
              label: `${selectedYear - 1} Expenses`,
              data: previousYearExpenses,
              backgroundColor: "rgba(239, 68, 68, 0.3)",
            },
            {
              label: `${selectedYear} Income`,
              data: currentYearIncome,
              backgroundColor: "rgba(34, 197, 94, 0.7)",
            },
            {
              label: `${selectedYear - 1} Income`,
              data: previousYearIncome,
              backgroundColor: "rgba(34, 197, 94, 0.3)",
            },
          ]
        : [
            {
              label: `${selectedYear} Expenses`,
              data: currentYearExpenses,
              borderColor: "#ef4444",
              backgroundColor: "rgba(239, 68, 68, 0.2)",
              borderWidth: 2,
              tension: 0.4,
            },
            {
              label: `${selectedYear - 1} Expenses`,
              data: previousYearExpenses,
              borderColor: "#fca5a5",
              backgroundColor: "rgba(252, 165, 165, 0.2)",
              borderWidth: 2,
              borderDash: [6, 6],
              tension: 0.4,
            },
            {
              label: `${selectedYear} Income`,
              data: currentYearIncome,
              borderColor: "#22c55e",
              backgroundColor: "rgba(34, 197, 94, 0.2)",
              borderWidth: 2,
              tension: 0.4,
            },
            {
              label: `${selectedYear - 1} Income`,
              data: previousYearIncome,
              borderColor: "#86efac",
              backgroundColor: "rgba(134, 239, 172, 0.2)",
              borderWidth: 2,
              borderDash: [6, 6],
              tension: 0.4,
            },
          ];

    return {
      labels: MONTH_LABELS,
      datasets,
    };
  }, [
    chartType,
    currentYearExpenses,
    currentYearIncome,
    previousYearExpenses,
    previousYearIncome,
    selectedYear,
  ]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { usePointStyle: true },
        },
        tooltip: {
          backgroundColor: "rgba(30, 41, 59, 0.9)",
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
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(148, 163, 184, 0.2)",
          },
          ticks: {
            callback: (value) => formatCurrency(value),
          },
        },
        x: {
          grid: {
            display: false,
          },
        },
      },
    }),
    []
  );

  const ChartComponent = chartType === "bar" ? Bar : Line;

  const insights = useMemo(() => {
    const highestExpenseMonth = currentYearExpenses
      .map((value, index) => ({ value, index }))
      .sort((a, b) => b.value - a.value)[0];

    const highestIncomeMonth = currentYearIncome
      .map((value, index) => ({ value, index }))
      .sort((a, b) => b.value - a.value)[0];

    return [
      {
        label: "Highest expense month",
        value: highestExpenseMonth
          ? `${MONTH_LABELS[highestExpenseMonth.index]} (${formatCurrency(
              highestExpenseMonth.value
            )})`
          : "N/A",
      },
      {
        label: "Highest income month",
        value: highestIncomeMonth
          ? `${MONTH_LABELS[highestIncomeMonth.index]} (${formatCurrency(
              highestIncomeMonth.value
            )})`
          : "N/A",
      },
      {
        label: "Expense growth",
        value: formatPercentage(totals.expenseGrowth, 1),
      },
      {
        label: "Income growth",
        value: formatPercentage(totals.incomeGrowth, 1),
      },
    ];
  }, [currentYearExpenses, currentYearIncome, totals]);

  return (
    <section className="trends-container">
      <header className="trends-header">
        <h2>Spending Trends</h2>
        <div className="trends-controls">
          <div className="control-group">
            <label className="form-label" htmlFor="trends-year">
              Year
            </label>
            <input
              id="trends-year"
              type="number"
              className="form-input"
              value={selectedYear}
              onChange={(event) =>
                setSelectedYear(Number(event.target.value) || selectedYear)
              }
              min="2000"
              max={today.getFullYear()}
            />
          </div>
          <div className="control-group">
            <label className="form-label" htmlFor="trends-chart">
              Chart
            </label>
            <select
              id="trends-chart"
              className="form-input"
              value={chartType}
              onChange={(event) => setChartType(event.target.value)}
            >
              <option value="line">Line</option>
              <option value="bar">Bar</option>
            </select>
          </div>
        </div>
      </header>

      <section className="trends-summary">
        <article className="summary-card">
          <span className="summary-label">Current year expenses</span>
          <span className="summary-value">
            {formatCurrency(totals.currentExpenses)}
          </span>
        </article>
        <article className="summary-card">
          <span className="summary-label">Current year income</span>
          <span className="summary-value">
            {formatCurrency(totals.currentIncome)}
          </span>
        </article>
        <article
          className={`summary-card ${
            totals.currentBalance >= 0 ? "positive" : "negative"
          }`}
        >
          <span className="summary-label">Balance</span>
          <span className="summary-value">
            {formatCurrency(totals.currentBalance)}
          </span>
        </article>
      </section>

      <section className="card trends-chart">
        {loading ? (
          <div className="loading-state">
            <p>Loading spending trends…</p>
          </div>
        ) : (
          <div className="chart-wrapper">
            <ChartComponent data={chartData} options={chartOptions} />
          </div>
        )}
      </section>

      <section className="trends-grid">
        <article className="card growth-card">
          <h3>Year-over-year growth</h3>
          <div className="growth-metrics">
            <div className="growth-item">
              <span className="growth-label">Expenses</span>
              <span
                className={`growth-value ${
                  totals.expenseGrowth >= 0 ? "negative" : "positive"
                }`}
              >
                {formatPercentage(totals.expenseGrowth, 1)}
              </span>
              <p className="growth-detail">
                {formatCurrency(totals.currentExpenses)} vs{" "}
                {formatCurrency(totals.previousExpenses)}
              </p>
            </div>
            <div className="growth-item">
              <span className="growth-label">Income</span>
              <span
                className={`growth-value ${
                  totals.incomeGrowth >= 0 ? "positive" : "negative"
                }`}
              >
                {formatPercentage(totals.incomeGrowth, 1)}
              </span>
              <p className="growth-detail">
                {formatCurrency(totals.currentIncome)} vs{" "}
                {formatCurrency(totals.previousIncome)}
              </p>
            </div>
            <div className="growth-item">
              <span className="growth-label">Balance</span>
              <span
                className={`growth-value ${
                  totals.balanceGrowth >= 0 ? "positive" : "negative"
                }`}
              >
                {formatPercentage(totals.balanceGrowth, 1)}
              </span>
              <p className="growth-detail">
                {formatCurrency(totals.currentBalance)} vs{" "}
                {formatCurrency(totals.previousBalance)}
              </p>
            </div>
          </div>
        </article>

        <article className="card insight-card">
          <h3>Highlights</h3>
          <ul className="insight-list">
            {insights.map((insight) => (
              <li key={insight.label}>
                <span className="insight-label">{insight.label}</span>
                <span className="insight-value">{insight.value}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </section>
  );
};

export default SpendingTrends;
