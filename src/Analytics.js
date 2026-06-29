import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
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

  // Listing option: toggle Income column
  const [includeIncome, setIncludeIncome] = useState(true);
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



  // Listing view matrix: monthly totals
  // - Expenses per category (excluding "Income"), shown as negative values
  // - Income single column per month (sum of all credits), shown positive
  const monthlyCategoryMatrix = useMemo(() => {
    const expenseCatsAll = categories.filter((c) => c !== "Income");
    const expenseCats =
      selectedCategory && selectedCategory !== "Income"
        ? [selectedCategory]
        : selectedCategory === "Income"
        ? []
        : expenseCatsAll;

    const makeRow = () =>
      Object.fromEntries(expenseCats.map((c) => [c, 0]));

    const expensesTotals = Array.from({ length: 12 }, makeRow);
    const incomeByMonth = Array(12).fill(0);

    expenses.forEach((exp) => {
      const amount = parseFloat(exp.amount) || 0;
      if (!amount) return;
      const { year, month } = getDateParts(exp.date);
      if (year !== selectedYear) return;
      const cat = exp.category;
      if (!expenseCats.includes(cat)) return;
      const idx = Number(month) - 1;
      expensesTotals[idx][cat] += amount;
    });

    credits.forEach((credit) => {
      const amount = parseFloat(credit.amount) || 0;
      if (!amount) return;
      const { year, month } = getDateParts(credit.date);
      if (year !== selectedYear) return;
      const idx = Number(month) - 1;
      incomeByMonth[idx] += amount;
    });



    return { expenseCats, expensesTotals, incomeByMonth };
  }, [expenses, credits, categories, selectedCategory, selectedYear]);
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

  const cardCls = "bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm";
  const inputCls = "rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  const labelCls = "block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1";
  const thCls = "px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-700/50";

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Analytics</h2>
        <div className="flex flex-wrap items-end gap-4">
          {/* View control */}
          <div>
            <label className={labelCls} htmlFor="analytics-view">View</label>
            <select
              id="analytics-view"
              className={inputCls + " w-36"}
              value={viewType}
              onChange={(event) => setViewType(event.target.value)}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="category">By Category</option>
            </select>
          </div>

          {/* Chart control */}
          <div>
            <label className={labelCls} htmlFor="analytics-chart">Chart</label>
            <select
              id="analytics-chart"
              className={inputCls + " w-36"}
              value={chartType}
              onChange={(event) => setChartType(event.target.value)}
            >
              <option value="bar">Bar</option>
              <option value="line">Line</option>
              <option value="doughnut">Doughnut</option>
              <option value="listing">Listing</option>
            </select>
          </div>

          {/* Listing options: include income checkbox */}
          {chartType === "listing" && (
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="include-income"
                checked={includeIncome}
                onChange={(e) => setIncludeIncome(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="include-income" className="text-sm text-slate-600 dark:text-slate-300">Include Income</label>
            </div>
          )}

          {/* Month control (monthly view only) */}
          {viewType === "monthly" && (
            <div>
              <label className={labelCls} htmlFor="analytics-month">Month</label>
              <select
                id="analytics-month"
                className={inputCls + " w-28"}
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
          )}

          {/* Year control (monthly view) */}
          {viewType === "monthly" && (
            <div>
              <label className={labelCls} htmlFor="analytics-year">Year</label>
              <input
                id="analytics-year"
                type="number"
                className={inputCls + " w-24"}
                value={selectedYear}
                onChange={(event) => setSelectedYear(event.target.value)}
                min="2000"
                max={today.getFullYear()}
              />
            </div>
          )}

          {/* Year control (non-monthly views) */}
          {viewType !== "monthly" && (
            <div>
              <label className={labelCls} htmlFor="analytics-year-general">Year</label>
              <input
                id="analytics-year-general"
                type="number"
                className={inputCls + " w-24"}
                value={selectedYear}
                onChange={(event) => setSelectedYear(event.target.value)}
                min="2000"
                max={today.getFullYear()}
              />
            </div>
          )}

          {/* Category control */}
          <div>
            <label className={labelCls} htmlFor="analytics-category">Category</label>
            <select
              id="analytics-category"
              className={inputCls + " w-40"}
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
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={cardCls + " p-5"}>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Expenses</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className={cardCls + " p-5"}>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Income</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalIncome)}</p>
        </div>
        <div className={cardCls + " p-5 " + (netAmount >= 0 ? "border-l-4 border-l-green-500" : "border-l-4 border-l-red-500")}>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Net</p>
          <p className={`text-2xl font-bold ${netAmount >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {formatCurrency(netAmount)}
          </p>
        </div>
      </div>

      {/* Chart card */}
      <div className={cardCls + " p-6"}>
        {loading ? (
          <div className="animate-pulse flex flex-col gap-3 min-h-[340px] justify-center px-4">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
            <div className="h-56 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="flex gap-4">
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20" />
            </div>
          </div>
        ) : activeDataset === 0 && chartType !== "listing" ? (
          <p className="text-center text-slate-400 dark:text-slate-500 py-16">No transactions available for the selected filters.</p>
        ) : chartType === "listing" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th rowSpan={2} className={thCls + " sticky left-0 bg-slate-50 dark:bg-slate-700/50"}>Month</th>
                  <th
                    colSpan={monthlyCategoryMatrix.expenseCats.length}
                    className="px-3 py-1.5 text-center text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-b border-slate-200 dark:border-slate-700"
                  >
                    Expenses
                  </th>
                  {includeIncome && (
                    <th
                      colSpan={1}
                      className="px-3 py-1.5 text-center text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-b border-slate-200 dark:border-slate-700"
                    >
                      Income
                    </th>
                  )}
                </tr>
                <tr>
                  {monthlyCategoryMatrix.expenseCats.map((cat) => (
                    <th key={`exp-${cat}`} className="px-2 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-red-50/50 dark:bg-red-900/10 whitespace-nowrap">{cat}</th>
                  ))}
                  {includeIncome && (
                    <th className="px-2 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-green-50/50 dark:bg-green-900/10">Income</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {MONTH_NAMES.map((name, idx) => (
                  <tr key={name} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-3 py-2 font-medium text-slate-600 dark:text-slate-300 sticky left-0 bg-white dark:bg-slate-800">{name}</td>
                    {monthlyCategoryMatrix.expenseCats.map((cat) => {
                      const raw = monthlyCategoryMatrix.expensesTotals[idx][cat] || 0;
                      const val = -raw;
                      return (
                        <td key={`exp-${idx}-${cat}`} className={`px-2 py-2 text-right tabular-nums ${
                          val < 0 ? "text-red-600 dark:text-red-400" :
                          val > 0 ? "text-green-600 dark:text-green-400" :
                          "text-slate-300 dark:text-slate-600"
                        }`}>
                          {formatCurrency(val)}
                        </td>
                      );
                    })}
                    {includeIncome && (
                      <td className={`px-2 py-2 text-right tabular-nums ${
                        (monthlyCategoryMatrix.incomeByMonth[idx] || 0) > 0 ? "text-green-600 dark:text-green-400" :
                        (monthlyCategoryMatrix.incomeByMonth[idx] || 0) < 0 ? "text-red-600 dark:text-red-400" :
                        "text-slate-300 dark:text-slate-600"
                      }`}>
                        {formatCurrency(monthlyCategoryMatrix.incomeByMonth[idx] || 0)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 font-semibold">
                  <th className="px-3 py-2 text-left text-xs text-slate-600 dark:text-slate-300 sticky left-0 bg-slate-50 dark:bg-slate-700/50">Total</th>
                  {monthlyCategoryMatrix.expenseCats.map((cat) => {
                    const totalRaw = monthlyCategoryMatrix.expensesTotals.reduce(
                      (sum, row) => sum + (row[cat] || 0),
                      0
                    );
                    const totalVal = -totalRaw;
                    return (
                      <th key={`exp-total-${cat}`} className={`px-2 py-2 text-right tabular-nums font-semibold ${
                        totalVal < 0 ? "text-red-600 dark:text-red-400" :
                        totalVal > 0 ? "text-green-600 dark:text-green-400" :
                        "text-slate-300 dark:text-slate-600"
                      }`}>
                        {formatCurrency(totalVal)}
                      </th>
                    );
                  })}
                  {includeIncome && (() => {
                    const incomeTotal = monthlyCategoryMatrix.incomeByMonth.reduce(
                      (sum, value) => sum + (value || 0),
                      0
                    );
                    return (
                      <th className={`px-2 py-2 text-right tabular-nums font-semibold ${
                        incomeTotal > 0 ? "text-green-600 dark:text-green-400" :
                        incomeTotal < 0 ? "text-red-600 dark:text-red-400" :
                        "text-slate-300 dark:text-slate-600"
                      }`}>
                        {formatCurrency(incomeTotal)}
                      </th>
                    );
                  })()}
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="h-72">
            <ChartComponent {...chartProps} />
          </div>
        )}
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Categories card */}
        <div className={cardCls + " p-6"}>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Top Categories</h3>
          <ul className="space-y-3">
            {topExpenseCategories.map((item) => (
              <li key={item.category} className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-300">{item.category}</span>
                <span className="text-sm font-medium text-slate-900 dark:text-white">{formatCurrency(item.expenses)}</span>
              </li>
            ))}
            {topExpenseCategories.length === 0 && (
              <li className="text-sm text-slate-400 dark:text-slate-500">No categories to display.</li>
            )}
          </ul>
        </div>

        {/* Category Insights card */}
        <div className={cardCls + " p-6"}>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Category Insights</h3>
          <ul className="space-y-3">
            <li className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-300">Highest spending</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">
                {topExpenseCategories.length
                  ? `${topExpenseCategories[0].category} (${formatCurrency(
                      topExpenseCategories[0].expenses
                    )})`
                  : "N/A"}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-300">Average expense</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">
                {filteredExpenses.length
                  ? formatCurrency(totalExpenses / filteredExpenses.length)
                  : formatCurrency(0)}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-300">Expense to income</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">
                {totalIncome
                  ? formatPercentage((totalExpenses / totalIncome) * 100)
                  : "N/A"}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
};

export default Analytics;
