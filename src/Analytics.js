// Analytics.js
import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";
import React from "react";
import { Bar } from "react-chartjs-2";
import "./Analytics.css";

Chart.register(ChartDataLabels);

const Analytics = ({ filteredExpenses, filteredCredits }) => {
  // Group monthly expenses
  const monthlyExpenses = filteredExpenses.reduce((acc, exp) => {
    const month = exp.date.split("-")[1];
    if (!acc[month]) acc[month] = 0;
    acc[month] += parseFloat(exp.amount);
    return acc;
  }, {});

  // Group monthly credits
  const monthlyCredits = filteredCredits.reduce((acc, cred) => {
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
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: "Amount (€)" },
      },
      x: {
        title: { display: true, text: "Month" },
      },
    },
    plugins: {
        legend: { position: "bottom" },
        datalabels: {
          anchor: "end",
          align: "end",
          formatter: (value) => `€${value.toFixed(2)}`,
        },
        tooltip: {
          callbacks: {
            label: (tooltipItem) => `€${tooltipItem.raw.toFixed(2)}`,
          },
        },
      },
    };      

  return (
    <div className="analytics-container">
        <Bar data={data} options={options} />
    </div>
  );
};

export default Analytics;
