import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import './BudgetGoals.css';

const BudgetGoals = () => {
  const [budgetProgress, setBudgetProgress] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newGoal, setNewGoal] = useState({ category: '', monthly_limit: '' });
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);

 const fetchBudgetProgress = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`http://localhost:5000/api/budget-progress?month=${selectedMonth}`);
      const processedData = response.data.map(item => ({
        ...item,
        spent_amount: parseFloat(item.spent_amount) || 0,
        monthly_limit: parseFloat(item.monthly_limit) || 0,
        remaining_amount: parseFloat(item.remaining_amount) || 0,
        percentage_used: parseFloat(item.percentage_used) || 0
      }));
      setBudgetProgress(processedData);
    } catch (error) {
      console.error('Error fetching budget progress:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchBudgetProgress();
  }, [fetchBudgetProgress]);

  const handleAddGoal = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/budget-goals', newGoal);
      setNewGoal({ category: '', monthly_limit: '' });
      setShowAddForm(false);
      fetchBudgetProgress();
    } catch (error) {
      console.error('Error adding budget goal:', error);
    }
  };

  const handleDeleteGoal = async (id) => {
    if (window.confirm('Are you sure you want to delete this budget goal?')) {
    try {
      await axios.delete(`http://localhost:5000/api/budget-goals/${id}`);
      fetchBudgetProgress();
    } catch (error) {
      console.error('Error deleting budget goal:', error);
    }
    }
  };

  const getProgressColor = (percentage) => {
    if (percentage <= 50) return 'var(--success-color)';
    if (percentage <= 80) return 'var(--warning-color)';
    return 'var(--danger-color)';
  };

  const getProgressStatus = (percentage) => {
    if (percentage <= 50) return 'On Track';
    if (percentage <= 80) return 'Warning';
    if (percentage <= 100) return 'Near Limit';
    return 'Over Budget';
  };
    
  const formatMonthDisplay = (monthString) => {
    const date = new Date(monthString + '-01');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const getTotalSpent = () => {
    return budgetProgress.reduce((total, item) => total + item.spent_amount, 0);
  };

  const getTotalBudget = () => {
    return budgetProgress.reduce((total, item) => total + item.monthly_limit, 0);
  };

  const getOverallProgress = () => {
    const totalBudget = getTotalBudget();
    if (totalBudget === 0) return 0;
    return (getTotalSpent() / totalBudget) * 100;
  };

  return (
    <div className="budget-goals-container">
      <div className="budget-header">
        <h2>🎯 Budget Goals</h2>
        <div className="budget-controls">
          <div className="month-selector">
            <label className="form-label">Select Month:</label>
            <input
              type="month"
              className="form-input month-input"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              max={new Date().toISOString().slice(0, 7)}
            />
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Cancel' : 'Add Goal'}
          </button>
        </div>
      </div>

      {/* Overall Progress Summary */}
      {budgetProgress.length > 0 && (
        <div className="overall-progress">
          <h3>📊 {formatMonthDisplay(selectedMonth)} Overview</h3>
          <div className="summary-stats">
            <div className="stat-item">
              <span className="stat-label">Total Spent:</span>
              <span className="stat-value spent">€{getTotalSpent().toFixed(2)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Budget:</span>
              <span className="stat-value budget">€{getTotalBudget().toFixed(2)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Overall Progress:</span>
              <span 
                className="stat-value progress"
                style={{ color: getProgressColor(getOverallProgress()) }}
              >
                {getOverallProgress().toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="add-goal-form">
          <form onSubmit={handleAddGoal}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Category</label>
                <input
                  type="text"
                  className="form-input"
                  value={newGoal.category}
                  onChange={(e) => setNewGoal({...newGoal, category: e.target.value})}
                  placeholder="e.g., Food, Transport"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Monthly Limit (€)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={newGoal.monthly_limit}
                  onChange={(e) => setNewGoal({...newGoal, monthly_limit: e.target.value})}
                  placeholder="500.00"
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn btn-success">Add Budget Goal</button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <p>Loading budget progress...</p>
        </div>
      ) : (
        <div className="budget-progress-grid">
          {budgetProgress.map((progress) => (
            <div key={progress.id} className="budget-card">
              <div className="budget-card-header">
                <h3>{progress.category}</h3>
                <span 
                  className="budget-status"
                  style={{ color: getProgressColor(progress.percentage_used) }}
                >
                  {getProgressStatus(progress.percentage_used)}
                </span>
              </div>
              
              <div className="budget-amounts">
                <div className="amount-row">
                  <span>Spent:</span>
                  <span className="amount spent">€{progress.spent_amount.toFixed(2)}</span>
                </div>
                <div className="amount-row">
                  <span>Budget:</span>
                  <span className="amount budget">€{progress.monthly_limit.toFixed(2)}</span>
                </div>
                <div className="amount-row">
                  <span>Remaining:</span>
                  <span 
                    className={`amount remaining ${progress.remaining_amount < 0 ? 'negative' : 'positive'}`}
                  >
                    €{progress.remaining_amount.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="progress-bar-container">
                <div 
                  className="progress-bar"
                  style={{
                    width: `${Math.min(progress.percentage_used, 100)}%`,
                    backgroundColor: getProgressColor(progress.percentage_used)
                  }}
                ></div>
                <span className="progress-percentage">
                  {progress.percentage_used.toFixed(1)}%
                </span>
              </div>

              <button 
                className="btn btn-danger btn-sm"
                onClick={() => handleDeleteGoal(progress.id)}
              >
                Delete Goal
              </button>
            </div>
          ))}
        </div>
      )}

      {budgetProgress.length === 0 && !loading && (
        <div className="empty-state">
          <p>No budget goals set yet for {formatMonthDisplay(selectedMonth)}. Add your first budget goal to start tracking your spending!</p>
        </div>
      )}
    </div>
  );
};

export default BudgetGoals;