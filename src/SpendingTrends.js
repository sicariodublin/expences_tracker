import "chart.js/auto";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import apiClient from "./api/apiClient";
import { formatCurrency, formatPercentage } from "./utils/format";

const cardCls = "bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm";
const inputCls = "rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const labelCls = "block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1";

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
const roundToTwo = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

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

      return totals.map(roundToTwo);
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
    const currentExpenses = roundToTwo(
      currentYearExpenses.reduce((acc, val) => acc + val, 0)
    );
    const previousExpenses = roundToTwo(
      previousYearExpenses.reduce((acc, val) => acc + val, 0)
    );
    const currentIncome = roundToTwo(
      currentYearIncome.reduce((acc, val) => acc + val, 0)
    );
    const previousIncome = roundToTwo(
      previousYearIncome.reduce((acc, val) => acc + val, 0)
    );

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

    const currentBalance = roundToTwo(currentIncome - currentExpenses);
    const previousBalance = roundToTwo(previousIncome - previousExpenses);

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
      datasets: datasets.map((dataset) => ({
        ...dataset,
        data: dataset.data.map(roundToTwo),
      })),
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
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Spending Trends</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className={labelCls} htmlFor="trends-year">
              Year
            </label>
            <input
              id="trends-year"
              type="number"
              className={inputCls + " w-28"}
              value={selectedYear}
              onChange={(event) =>
                setSelectedYear(Number(event.target.value) || selectedYear)
              }
              min="2000"
              max={today.getFullYear()}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="trends-chart">
              Chart
            </label>
            <select
              id="trends-chart"
              className={inputCls + " w-28"}
              value={chartType}
              onChange={(event) => setChartType(event.target.value)}
            >
              <option value="line">Line</option>
              <option value="bar">Bar</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={cardCls + " p-5"}>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
            Current year expenses
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(totals.currentExpenses)}
          </p>
        </div>
        <div className={cardCls + " p-5"}>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
            Current year income
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(totals.currentIncome)}
          </p>
        </div>
        <div
          className={
            cardCls +
            " p-5 border-l-4 " +
            (totals.currentBalance >= 0 ? "border-l-green-500" : "border-l-red-500")
          }
        >
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
            Balance
          </p>
          <p
            className={
              "text-2xl font-bold " +
              (totals.currentBalance >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-500 dark:text-red-400")
            }
          >
            {formatCurrency(totals.currentBalance)}
          </p>
        </div>
      </div>

      <div className={cardCls + " p-6"}>
        {loading ? (
          <div className="animate-pulse flex flex-col gap-3 min-h-[300px] justify-center px-4">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
            <div className="h-52 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="flex gap-4">
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24" />
            </div>
          </div>
        ) : (
          <div className="h-72">
            <ChartComponent data={chartData} options={chartOptions} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={cardCls + " p-6"}>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
            Year-over-year growth
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Expenses</p>
              <p
                className={`text-lg font-bold ${
                  totals.expenseGrowth >= 0 ? "text-red-500" : "text-green-500"
                }`}
              >
                {formatPercentage(totals.expenseGrowth, 1)}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {formatCurrency(totals.currentExpenses)} vs{" "}
                {formatCurrency(totals.previousExpenses)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Income</p>
              <p
                className={`text-lg font-bold ${
                  totals.incomeGrowth >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {formatPercentage(totals.incomeGrowth, 1)}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {formatCurrency(totals.currentIncome)} vs{" "}
                {formatCurrency(totals.previousIncome)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Balance</p>
              <p
                className={`text-lg font-bold ${
                  totals.balanceGrowth >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {formatPercentage(totals.balanceGrowth, 1)}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {formatCurrency(totals.currentBalance)} vs{" "}
                {formatCurrency(totals.previousBalance)}
              </p>
            </div>
          </div>
        </div>

        <div className={cardCls + " p-6"}>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
            Highlights
          </h3>
          <ul className="space-y-3">
            {insights.map((insight) => (
              <li key={insight.label} className="flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {insight.label}
                </span>
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {insight.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default SpendingTrends;
