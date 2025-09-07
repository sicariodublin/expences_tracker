// Analytics.js
import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Bar } from "react-chartjs-2";
import "./Analytics.css";

Chart.register(ChartDataLabels);

// Fix: Change prop names to match what App.js is passing
const Analytics = ({ expenses, credits }) => {
  // Add safety checks to prevent undefined errors
  const safeExpenses = expenses || [];
  const safeCredits = credits || [];

  // Group monthly expenses
  const monthlyExpenses = safeExpenses.reduce((acc, exp) => {
    const month = exp.date.split("-")[1];
    if (!acc[month]) acc[month] = 0;
    acc[month] += parseFloat(exp.amount);
    return acc;
  }, {});

  // Group monthly credits
  const monthlyCredits = safeCredits.reduce((acc, cred) => {
    const month = cred.date.split("-")[1];
    if (!acc[month]) acc[month] = 0;
    acc[month] += parseFloat(cred.amount);
    return acc;
  }, {});

  // Sort months numerically (e.g. ["01", "02", "03"...])
  const allMonths = Array.from(new Set([...Object.keys(monthlyExpenses), ...Object.keys(monthlyCredits)]))
    .sort((a, b) => parseInt(a) - parseInt(b));

  // Build chart data
  const data = {
    labels: allMonths,
    datasets: [
      {
        label: "Expenses",
        data: allMonths.map((m) => monthlyExpenses[m] || 0),
        backgroundColor: "rgba(255, 99, 132, 0.2)",
      },
      {
        label: "Credits",
        data: allMonths.map((m) => monthlyCredits[m] || 0),
        backgroundColor: "rgba(54, 162, 235, 0.2)",
      },
    ],
  };

  // Chart options
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Monthly Expenses vs Credits",
      },
      datalabels: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="analytics-container">
      <h2>📊 Analytics</h2>
      {allMonths.length > 0 ? (
        <Bar data={data} options={options} />
      ) : (
        <div className="no-data">
          <p>No data available for analytics. Add some expenses and income to see charts!</p>
        </div>
      )}
    </div>
  );
};

export default Analytics;
