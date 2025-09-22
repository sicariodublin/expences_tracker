import axios from "axios";
import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import "./Analytics.css";

Chart.register(ChartDataLabels);

const Analytics = () => {
  const [expenses, setExpenses] = useState([]);
  const [credits, setCredits] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString()
  );
  const [viewType, setViewType] = useState("monthly"); // monthly, yearly, category
  const [chartType, setChartType] = useState("bar"); // bar, line, doughnut
  const [selectedCategory, setSelectedCategory] = useState("");
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

   const getFilteredExpenses = useCallback(() => {
    let filtered = expenses;

    if (selectedCategory) {
      filtered = filtered.filter(exp => exp.category === selectedCategory);
    }
    if (viewType === "monthly" && selectedMonth) {
      filtered = filtered.filter(exp => {
        const expenseMonth = exp.date.split('-')[1];
        const expenseYear = exp.date.split('-')[0];
        return expenseMonth === selectedMonth.padStart(2, '0') && expenseYear === selectedYear;
      });
    } else if (viewType === "yearly") {
      filtered = filtered.filter(exp => {
        const expenseYear = exp.date.split('-')[0];
        return expenseYear === selectedYear;
      });
    }
    return filtered;
  }, [expenses, viewType, selectedMonth, selectedYear, selectedCategory]);

  const getFilteredCredits = useCallback(() => {
    let filtered = credits;

    if (selectedCategory) {
      filtered = filtered.filter(cred => cred.category === selectedCategory);
    }
    if (viewType === "monthly" && selectedMonth) {
      filtered = filtered.filter(cred => {
        const creditMonth = cred.date.split('-')[1];
        const creditYear = cred.date.split('-')[0];
        return creditMonth === selectedMonth.padStart(2, '0') && creditYear === selectedYear;
      });
    } else if (viewType === "yearly") {
      filtered = filtered.filter(cred => {
        const creditYear = cred.date.split('-')[0];
        return creditYear === selectedYear;
      });
    }
    return filtered;
  }, [credits, viewType, selectedMonth, selectedYear, selectedCategory]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let startDate, endDate;

      if (viewType === "monthly" && selectedMonth) {
        // Fetch data for specific month
        startDate = `${selectedYear}-${selectedMonth.padStart(2, "0")}-01`;
        const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
        endDate = `${selectedYear}-${selectedMonth.padStart(
          2,
          "0"
        )}-${lastDay}`;
      } else if (viewType === "yearly") {
        // Fetch data for entire year
        startDate = `${selectedYear}-01-01`;
        endDate = `${selectedYear}-12-31`;
      } else if (viewType === "category") {
        // Fetch data for selected category
        startDate = `${selectedYear}-01-01`;
        endDate = `${selectedYear}-12-31`;
       } else if (viewType === "monthly") {
        // Fetch data for selected month
        startDate = `${selectedYear}-01-01`;
        endDate = `${selectedYear}-12-31`;
      }

      const params =
        startDate && endDate ? { start: startDate, end: endDate } : {};

      const [expensesRes, creditsRes] = await Promise.all([
        axios.get("http://localhost:5000/api/expenses", { params }),
        axios.get("http://localhost:5000/api/credits", { params }),
      ]);

      setExpenses(expensesRes.data);
      setCredits(creditsRes.data);
    } catch (error) {
      console.error("Error fetching analytics data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear, viewType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getMonthlyData = useCallback(() => {
    const filteredExpenses = getFilteredExpenses();
    const filteredCredits = getFilteredCredits();

    if (selectedMonth) {
      // Show daily data for selected month
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const days = Array.from({ length: daysInMonth }, (_, i) =>
        (i + 1).toString().padStart(2, "0")
      );

      const dailyExpenses = {};
      const dailyCredits = {};

      filteredExpenses.forEach((exp) => {
        const day = exp.date.split("-")[2];
        dailyExpenses[day] = (dailyExpenses[day] || 0) + parseFloat(exp.amount);
      });

      filteredCredits.forEach((cred) => {
        const day = cred.date.split("-")[2];
        dailyCredits[day] = (dailyCredits[day] || 0) + parseFloat(cred.amount);
      });

      return {
        labels: days,
        datasets: [
          {
            label: "Expenses",
            data: days.map((day) => dailyExpenses[day] || 0),
            backgroundColor: "rgba(255, 99, 132, 0.6)",
            borderColor: "rgba(255, 99, 132, 1)",
            borderWidth: 2,
          },
          {
            label: "Credits",
            data: days.map((day) => dailyCredits[day] || 0),
            backgroundColor: "rgba(54, 162, 235, 0.6)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 2,
          },
        ],
      };
    } else {
      // Show monthly overview for the year
    const months = [
      "01", "02", "03", "04", "05", "06",
      "07", "08", "09", "10", "11", "12",
    ];
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

      const monthlyExpenses = {};
      const monthlyCredits = {};

      filteredExpenses.forEach((exp) => {
        const month = exp.date.split("-")[1];
        monthlyExpenses[month] =
          (monthlyExpenses[month] || 0) + parseFloat(exp.amount);
      });

      filteredCredits.forEach((cred) => {
        const month = cred.date.split("-")[1];
        monthlyCredits[month] =
          (monthlyCredits[month] || 0) + parseFloat(cred.amount);
      });

      return {
        labels: monthNames,
        datasets: [
          {
            label: "Expenses",
            data: months.map((month) => monthlyExpenses[month] || 0),
            backgroundColor: "rgba(255, 99, 132, 0.6)",
            borderColor: "rgba(255, 99, 132, 1)",
            borderWidth: 2,
          },
          {
            label: "Credits",
            data: months.map((month) => monthlyCredits[month] || 0),
            backgroundColor: "rgba(54, 162, 235, 0.6)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 2,
          },
        ],
      };
    }
  }, [getFilteredExpenses, getFilteredCredits, selectedMonth, selectedYear]);

  const getYearlyData = useCallback(() => {
    const filteredExpenses = getFilteredExpenses();
    const filteredCredits = getFilteredCredits();

    const currentYear = parseInt(selectedYear);
    const years = [currentYear - 2, currentYear - 1, currentYear].map((y) =>
      y.toString()
    );

    const yearlyExpenses = {};
    const yearlyCredits = {};

    filteredExpenses.forEach((exp) => {
      const year = exp.date.split("-")[0];
      yearlyExpenses[year] =
        (yearlyExpenses[year] || 0) + parseFloat(exp.amount);
    });

    filteredCredits.forEach((cred) => {
      const year = cred.date.split("-")[0];
      yearlyCredits[year] =
        (yearlyCredits[year] || 0) + parseFloat(cred.amount);
    });

    return {
      labels: years,
      datasets: [
        {
          label: "Expenses",
          data: years.map((year) => yearlyExpenses[year] || 0),
          backgroundColor: "rgba(255, 99, 132, 0.6)",
          borderColor: "rgba(255, 99, 132, 1)",
          borderWidth: 2,
        },
        {
          label: "Credits",
          data: years.map((year) => yearlyCredits[year] || 0),
          backgroundColor: "rgba(54, 162, 235, 0.6)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 2,
        },
      ],
    };
  }, [getFilteredExpenses, getFilteredCredits, selectedYear]);

  const getCategoryData = useCallback(() => {
    const filteredExpenses = getFilteredExpenses();
    const filteredCredits = getFilteredCredits();

    const categoryExpenses = {};
    const categoryCredits = {};

    filteredExpenses.forEach((exp) => {
      categoryExpenses[exp.category] =
        (categoryExpenses[exp.category] || 0) + parseFloat(exp.amount);
    });

    filteredCredits.forEach((cred) => {
      categoryCredits[cred.category] =
        (categoryCredits[cred.category] || 0) + parseFloat(cred.amount);
    });

    const allCategories = [
      ...new Set([
        ...Object.keys(categoryExpenses),
        ...Object.keys(categoryCredits),
      ]),
    ];

    const colors = [
      "rgba(255, 99, 132, 0.6)",
      "rgba(54, 162, 235, 0.6)",
      "rgba(255, 205, 86, 0.6)",
      "rgba(75, 192, 192, 0.6)",
      "rgba(153, 102, 255, 0.6)",
      "rgba(255, 159, 64, 0.6)",
      "rgba(199, 199, 199, 0.6)",
      "rgba(83, 102, 255, 0.6)",
    ];

    return {
      labels: allCategories,
      datasets: [
        {
          label: "Expenses",
          data: allCategories.map((cat) => categoryExpenses[cat] || 0),
          backgroundColor: colors,
          borderColor: colors.map((color) => color.replace("0.6", "1")),
          borderWidth: 2,
        },
      ],
    };
  }, [getFilteredExpenses, getFilteredCredits]);

  const getChartTitle = useCallback(() => {
    const categoryText = selectedCategory ? ` - ${selectedCategory}` : "";
    
    if (viewType === "monthly" && selectedMonth) {
      const monthName = new Date(
        selectedYear,
        selectedMonth - 1
      ).toLocaleDateString("en-US", { month: "long" });
      return `Daily ${monthName} ${selectedYear}${categoryText} - Expenses vs Credits`;
    } else if (viewType === "monthly") {
      return `Monthly ${selectedYear}${categoryText} - Expenses vs Credits`;
    } else if (viewType === "yearly") {
      return `Yearly Comparison${categoryText} - Expenses vs Credits`;
    } else {
      return `Category Breakdown${categoryText} - Expenses`;
    }
  }, [viewType, selectedMonth, selectedYear, selectedCategory]);

  const chartData = useMemo(() => {
    if (viewType === "monthly") {
      return getMonthlyData();
    } else if (viewType === "yearly") {
      return getYearlyData();
    } else {
      return getCategoryData();
    } 
  }, [viewType, getMonthlyData, getYearlyData, getCategoryData]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: "top",
        },
        title: {
          display: true,
          text: getChartTitle(),
        },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: 'white',
          bodyColor: 'white',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: 1,
          cornerRadius: 6,
          displayColors: true,
          callbacks: {
            label: function(context) {
              const label = context.dataset.label || '';
              const value = context.parsed.y;
              return `${label}: €${value.toFixed(2)}`;
            },
            title: function(tooltipItems) {
              return tooltipItems[0].label;
            }
          }
        },
        datalabels: {
          display: chartType === "doughnut",
          color: "white",
          font: {
            weight: "bold",
          },
          formatter: (value, context) => {
            if (value === 0) return "";
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${percentage}%`;
          },
        },
      },
      scales:
        chartType !== "doughnut"
          ? {
              x: {
                display: true,
                grid: {
                  display: false,
                },
              },
              y: {
                beginAtZero: true,
                grid: {
                  color: 'rgba(0, 0, 0, 0.1)',
                },
                ticks: {
                  callback: function (value) {
                    return "€" + value.toFixed(2);
                  },
                },
              },
            }
          : {},
    }),
    [chartType, getChartTitle]
  );

  const renderChart = () => {
    const props = { data: chartData, options: chartOptions };

    switch (chartType) {
      case "line":
        return <Line {...props} />;
      case "doughnut":
        return <Doughnut {...props} />;
      default:
        return <Bar {...props} />;
    }
  };


  const getTotalExpenses = useCallback(() => {
    return getFilteredExpenses().reduce((total, exp) => total + parseFloat(exp.amount), 0);
  }, [getFilteredExpenses]);

  const getTotalCredits = useCallback(() => {
    return getFilteredCredits().reduce((total, cred) => total + parseFloat(cred.amount), 0);
  }, [getFilteredCredits]);

  const getNetAmount = useCallback(() => {
    return getTotalCredits() - getTotalExpenses();
  }, [getTotalCredits, getTotalExpenses]);

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <h2>📊 Analytics</h2>

        <div className="analytics-controls">
          <div className="control-group">
            <label className="form-label">View:</label>
            <select
              className="form-input"
              value={viewType}
              onChange={(e) => setViewType(e.target.value)}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="category">By Category</option>
            </select>
          </div>

          <div className="control-group">
            <label className="form-label">Category:</label>
            <select
              className="form-input"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label className="form-label">Chart Type:</label>
            <select
              className="form-input"
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
            >
              <option value="bar">Bar Chart</option>
              <option value="line">Line Chart</option>
              {viewType === "category" && (
                <option value="doughnut">Doughnut Chart</option>
              )}
            </select>
          </div>

          <div className="control-group">
            <label className="form-label">Year:</label>
            <select
              className="form-input"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - i;
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>
          </div>

          {viewType === "monthly" && (
            <div className="control-group">
              <label className="form-label">Month:</label>
              <select
                className="form-input"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="">All Months</option>
                {Array.from({ length: 12 }, (_, i) => {
                  const month = (i + 1).toString();
                  const monthName = new Date(2024, i).toLocaleDateString(
                    "en-US",
                    { month: "long" }
                  );
                  return (
                    <option key={month} value={month}>
                      {monthName}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="analytics-summary">
        <div className="summary-card expenses">
          <h3>Total Expenses</h3>
          <span className="amount">€{getTotalExpenses().toFixed(2)}</span>
        </div>
        <div className="summary-card credits">
          <h3>Total Credits</h3>
          <span className="amount">€{getTotalCredits().toFixed(2)}</span>
        </div>
        <div
          className={`summary-card net ${
            getNetAmount() >= 0 ? "positive" : "negative"
          }`}
        >
          <h3>Net Amount</h3>
          <span className="amount">€{getNetAmount().toFixed(2)}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="chart-container">
        {loading ? (
          <div className="loading-state">
            <p>Loading analytics data...</p>
          </div>
        ) : chartData.labels && chartData.labels.length > 0 ? (
          renderChart()
        ) : (
          <div className="no-data">
            <p>
              No data available for the selected period. Add some expenses and
              income to see charts!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
