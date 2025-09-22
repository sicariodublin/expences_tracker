import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import './BudgetGoals.css';

const BudgetGoals = () => {
  const [budgetProgress, setBudgetProgress] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [newGoal, setNewGoal] = useState({ category: '', monthly_limit: '' });
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Predefined categories from the main app
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
      
      // Generate budget alerts
      generateBudgetAlerts(processedData);
    } catch (error) {
      console.error('Error fetching budget progress:', error);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  // Generate budget alerts based on spending
  const generateBudgetAlerts = (budgetData) => {
    const alerts = [];
    const currentDate = new Date();
    const selectedDate = new Date(selectedMonth + '-01');
    const isCurrentMonth = currentDate.getMonth() === selectedDate.getMonth() && 
                          currentDate.getFullYear() === selectedDate.getFullYear();
    
    if (isCurrentMonth) {
      budgetData.forEach(budget => {
        if (budget.percentage_used >= 100) {
          alerts.push({
            id: `over-${budget.id}`,
            type: 'danger',
            message: `🚨 ${budget.category}: Over budget by €${Math.abs(budget.remaining_amount).toFixed(2)}!`,
            category: budget.category
          });
        } else if (budget.percentage_used >= 90) {
          alerts.push({
            id: `warning-${budget.id}`,
            type: 'warning', 
            message: `⚠️ ${budget.category}: Only €${budget.remaining_amount.toFixed(2)} remaining (${(100 - budget.percentage_used).toFixed(1)}% left)`,
            category: budget.category
          });
        } else if (budget.percentage_used >= 75) {
          alerts.push({
            id: `caution-${budget.id}`,
            type: 'caution',
            message: `💡 ${budget.category}: ${budget.percentage_used.toFixed(1)}% of budget used`,
            category: budget.category
          });
        }
      });
    }
    setNotifications(alerts);
  };

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

  const handleEditGoal = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`http://localhost:5000/api/budget-goals/${editingGoal.id}`, {
        category: editingGoal.category,
        monthly_limit: editingGoal.monthly_limit
      });
      setEditingGoal(null);
      fetchBudgetProgress();
    } catch (error) {
      console.error('Error updating budget goal:', error);
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

  const dismissNotification = (notificationId) => {
    setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
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

  const getProgressIcon = (percentage) => {
    if (percentage <= 50) return '✅';
    if (percentage <= 80) return '⚠️';
    if (percentage <= 100) return '🔶';
    return '🚨';
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

      {/* Budget Alerts */}
      {notifications.length > 0 && (
        <div className="budget-alerts">
          <h3>🔔 Budget Alerts</h3>
          <div className="alerts-container">
            {notifications.map((notification) => (
              <div key={notification.id} className={`alert alert-${notification.type}`}>
                <span className="alert-message">{notification.message}</span>
                <button 
                  className="alert-dismiss"
                  onClick={() => dismissNotification(notification.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
                <select
                  className="form-input"
                  value={newGoal.category}
                  onChange={(e) => setNewGoal({...newGoal, category: e.target.value})}
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
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
              {editingGoal && editingGoal.id === progress.id ? (
                <form onSubmit={handleEditGoal} className="edit-form">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-input"
                      value={editingGoal.category}
                      onChange={(e) => setEditingGoal({...editingGoal, category: e.target.value})}
                      required
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Monthly Limit (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={editingGoal.monthly_limit}
                      onChange={(e) => setEditingGoal({...editingGoal, monthly_limit: e.target.value})}
                      required
                    />
                  </div>
                  <div className="button-group">
                    <button type="submit" className="btn btn-success btn-sm">Save</button>
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditingGoal(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="budget-card-header">
                    <h3>{progress.category}</h3>
                    <div className="status-container">
                      <span className="status-icon">{getProgressIcon(progress.percentage_used)}</span>
                      <span 
                        className="budget-status"
                        style={{ color: getProgressColor(progress.percentage_used) }}
                      >
                        {getProgressStatus(progress.percentage_used)}
                      </span>
                    </div>
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

                  <div className="card-actions">
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => setEditingGoal({
                        id: progress.id,
                        category: progress.category,
                        monthly_limit: progress.monthly_limit
                      })}
                    >
                      Edit
                    </button>
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteGoal(progress.id)}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
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