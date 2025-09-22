import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import './SpendingTrends.css';

const SpendingTrends = () => {
  const [expenses, setExpenses] = useState([]);
  const [credits, setCredits] = useState([]);
  const [viewType, setViewType] = useState('monthly'); // monthly, yearly, comparison
  const [chartType, setChartType] = useState('line'); // line, bar
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [expensesRes, creditsRes] = await Promise.all([
        axios.get('http://localhost:5000/api/expenses'),
        axios.get('http://localhost:5000/api/credits')
      ]);
      setExpenses(expensesRes.data);
      setCredits(creditsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Monthly trends data
  const getMonthlyTrendsData = useCallback(() => {
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    
    const currentYear = selectedYear;
    const previousYear = selectedYear - 1;
    
    const currentYearExpenses = {};
    const previousYearExpenses = {};
    const currentYearCredits = {};
    const previousYearCredits = {};
    
    // Process expenses
    expenses.forEach(exp => {
      const expDate = new Date(exp.date);
      const expYear = expDate.getFullYear();
      const expMonth = expDate.getMonth() + 1;
      
      if (expYear === currentYear) {
        currentYearExpenses[expMonth] = (currentYearExpenses[expMonth] || 0) + parseFloat(exp.amount);
      } else if (expYear === previousYear) {
        previousYearExpenses[expMonth] = (previousYearExpenses[expMonth] || 0) + parseFloat(exp.amount);
      }
    });
    
    // Process credits
    credits.forEach(cred => {
      const credDate = new Date(cred.date);
      const credYear = credDate.getFullYear();
      const credMonth = credDate.getMonth() + 1;
      
      if (credYear === currentYear) {
        currentYearCredits[credMonth] = (currentYearCredits[credMonth] || 0) + parseFloat(cred.amount);
      } else if (credYear === previousYear) {
        previousYearCredits[credMonth] = (previousYearCredits[credMonth] || 0) + parseFloat(cred.amount);
      }
    });
    
    return {
      labels: monthNames,
      datasets: [
        {
          label: `${currentYear} Expenses`,
          data: monthNames.map((_, index) => currentYearExpenses[index + 1] || 0),
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          tension: 0.4,
          fill: false
        },
        {
          label: `${previousYear} Expenses`,
          data: monthNames.map((_, index) => previousYearExpenses[index + 1] || 0),
          borderColor: 'rgba(255, 99, 132, 0.5)',
          backgroundColor: 'rgba(255, 99, 132, 0.05)',
          tension: 0.4,
          fill: false,
          borderDash: [5, 5]
        },
        {
          label: `${currentYear} Income`,
          data: monthNames.map((_, index) => currentYearCredits[index + 1] || 0),
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.1)',
          tension: 0.4,
          fill: false
        },
        {
          label: `${previousYear} Income`,
          data: monthNames.map((_, index) => previousYearCredits[index + 1] || 0),
          borderColor: 'rgba(54, 162, 235, 0.5)',
          backgroundColor: 'rgba(54, 162, 235, 0.05)',
          tension: 0.4,
          fill: false,
          borderDash: [5, 5]
        }
      ]
    };
  }, [expenses, credits, selectedYear]);

  // Yearly trends data
  const getYearlyTrendsData = useCallback(() => {
    const currentYear = selectedYear;
    const years = Array.from({length: 5}, (_, i) => currentYear - 4 + i);
    
    const yearlyExpenses = {};
    const yearlyCredits = {};
    const yearlyBalance = {};
    
    expenses.forEach(exp => {
      const expYear = new Date(exp.date).getFullYear();
      if (years.includes(expYear)) {
        yearlyExpenses[expYear] = (yearlyExpenses[expYear] || 0) + parseFloat(exp.amount);
      }
    });
    
    credits.forEach(cred => {
      const credYear = new Date(cred.date).getFullYear();
      if (years.includes(credYear)) {
        yearlyCredits[credYear] = (yearlyCredits[credYear] || 0) + parseFloat(cred.amount);
      }
    });
    
    years.forEach(year => {
      const expenses = yearlyExpenses[year] || 0;
      const income = yearlyCredits[year] || 0;
      yearlyBalance[year] = income - expenses;
    });
    
    return {
      labels: years.map(year => year.toString()),
      datasets: [
        {
          label: 'Expenses',
          data: years.map(year => yearlyExpenses[year] || 0),
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          tension: 0.4
        },
        {
          label: 'Income',
          data: years.map(year => yearlyCredits[year] || 0),
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          tension: 0.4
        },
        {
          label: 'Balance',
          data: years.map(year => yearlyBalance[year] || 0),
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          tension: 0.4
        }
      ]
    };
  }, [expenses, credits, selectedYear]);

  // Growth analysis
  const getGrowthAnalysis = useCallback(() => {
    const currentYear = selectedYear;
    const previousYear = selectedYear - 1;
    
    const currentExpenses = expenses
      .filter(exp => new Date(exp.date).getFullYear() === currentYear)
      .reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    
    const previousExpenses = expenses
      .filter(exp => new Date(exp.date).getFullYear() === previousYear)
      .reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    
    const currentIncome = credits
      .filter(cred => new Date(cred.date).getFullYear() === currentYear)
      .reduce((sum, cred) => sum + parseFloat(cred.amount), 0);
    
    const previousIncome = credits
      .filter(cred => new Date(cred.date).getFullYear() === previousYear)
      .reduce((sum, cred) => sum + parseFloat(cred.amount), 0);
    
    const expenseGrowth = previousExpenses > 0 
      ? ((currentExpenses - previousExpenses) / previousExpenses * 100)
      : 0;
    
    const incomeGrowth = previousIncome > 0 
      ? ((currentIncome - previousIncome) / previousIncome * 100)
      : 0;
    
    return {
      currentExpenses,
      previousExpenses,
      currentIncome,
      previousIncome,
      expenseGrowth,
      incomeGrowth,
      currentBalance: currentIncome - currentExpenses,
      previousBalance: previousIncome - previousExpenses
    };
  }, [expenses, credits, selectedYear]);

  const chartData = viewType === 'monthly' ? getMonthlyTrendsData() : getYearlyTrendsData();
  const growthData = getGrowthAnalysis();

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20
        }
      },
      title: {
        display: true,
        text: viewType === 'monthly' 
          ? `Monthly Spending Trends (${selectedYear} vs ${selectedYear - 1})`
          : 'Yearly Financial Trends (5-Year View)',
        font: {
          size: 16,
          weight: 'bold'
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return '€' + value.toLocaleString();
          }
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

  return (
    <div className="spending-trends">
      <div className="trends-header">
        <h2>📈 Spending Trends Analysis</h2>
        <p>Track your financial patterns and identify spending trends over time</p>
      </div>

      {/* Controls */}
      <div className="trends-controls">
        <div className="control-group">
          <label>View Type:</label>
          <select 
            value={viewType} 
            onChange={(e) => setViewType(e.target.value)}
            className="control-select"
          >
            <option value="monthly">Monthly Comparison</option>
            <option value="yearly">Yearly Trends</option>
          </select>
        </div>
        
        <div className="control-group">
          <label>Chart Type:</label>
          <select 
            value={chartType} 
            onChange={(e) => setChartType(e.target.value)}
            className="control-select"
          >
            <option value="line">Line Chart</option>
            <option value="bar">Bar Chart</option>
          </select>
        </div>
        
        <div className="control-group">
          <label>Year:</label>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="control-select"
          >
            {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Growth Analysis Cards */}
      <div className="growth-analysis">
        <div className="growth-card">
          <div className="growth-icon">💸</div>
          <div className="growth-content">
            <h3>Expense Growth</h3>
            <p className={`growth-percentage ${growthData.expenseGrowth >= 0 ? 'negative' : 'positive'}`}>
              {growthData.expenseGrowth >= 0 ? '+' : ''}{growthData.expenseGrowth.toFixed(1)}%
            </p>
            <span className="growth-detail">
              €{growthData.currentExpenses.toFixed(2)} vs €{growthData.previousExpenses.toFixed(2)}
            </span>
          </div>
        </div>
        
        <div className="growth-card">
          <div className="growth-icon">💰</div>
          <div className="growth-content">
            <h3>Income Growth</h3>
            <p className={`growth-percentage ${growthData.incomeGrowth >= 0 ? 'positive' : 'negative'}`}>
              {growthData.incomeGrowth >= 0 ? '+' : ''}{growthData.incomeGrowth.toFixed(1)}%
            </p>
            <span className="growth-detail">
              €{growthData.currentIncome.toFixed(2)} vs €{growthData.previousIncome.toFixed(2)}
            </span>
          </div>
        </div>
        
        <div className="growth-card">
          <div className="growth-icon">📊</div>
          <div className="growth-content">
            <h3>Balance Trend</h3>
            <p className={`growth-percentage ${growthData.currentBalance >= growthData.previousBalance ? 'positive' : 'negative'}`}>
              {growthData.currentBalance >= growthData.previousBalance ? '↗️' : '↘️'}
            </p>
            <span className="growth-detail">
              €{growthData.currentBalance.toFixed(2)} vs €{growthData.previousBalance.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="trends-chart-container">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading trends data...</p>
          </div>
        ) : (
          <div className="chart-wrapper">
            {chartType === 'line' ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <Bar data={chartData} options={chartOptions} />
            )}
          </div>
        )}
      </div>

      {/* Insights */}
      <div className="trends-insights">
        <h3>💡 Key Insights</h3>
        <div className="insights-grid">
          <div className="insight-item">
            <strong>Spending Pattern:</strong>
            <span>
              {growthData.expenseGrowth > 10 
                ? "📈 Expenses increasing significantly" 
                : growthData.expenseGrowth > 0 
                ? "📊 Moderate expense growth" 
                : "📉 Expenses decreasing"}
            </span>
          </div>
          <div className="insight-item">
            <strong>Financial Health:</strong>
            <span>
              {growthData.currentBalance > growthData.previousBalance 
                ? "✅ Improving financial position" 
                : "⚠️ Consider reviewing spending"}
            </span>
          </div>
          <div className="insight-item">
            <strong>Recommendation:</strong>
            <span>
              {growthData.expenseGrowth > growthData.incomeGrowth 
                ? "💡 Focus on expense optimization" 
                : "🎯 Maintain current financial habits"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpendingTrends;