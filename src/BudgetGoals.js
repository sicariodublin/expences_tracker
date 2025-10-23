import { useCallback, useEffect, useMemo, useState } from "react";
import "./BudgetGoals.css";
import apiClient from "./api/apiClient";
import { EXPENSE_CATEGORIES } from "./constants/categories";
import { formatCurrency, formatPercentage } from "./utils/format";

const STATUS_CONFIG = [
  {
    threshold: 100,
    label: "Over Budget",
    icon: "⛔",
    color: "var(--color-danger)",
  },
  {
    threshold: 90,
    label: "Critical",
    icon: "⚠️",
    color: "var(--color-danger)",
  },
  {
    threshold: 75,
    label: "Watch",
    icon: "🟠",
    color: "var(--color-warning)",
  },
  {
    threshold: 0,
    label: "On Track",
    icon: "✅",
    color: "var(--color-success)",
  },
];

const normalizeBudgetRow = (row) => ({
  ...row,
  spent_amount: Number(row.spent_amount) || 0,
  monthly_limit: Number(row.monthly_limit) || 0,
  remaining_amount: Number(row.remaining_amount) || 0,
  percentage_used: Number(row.percentage_used) || 0,
});

const formatMonthDisplay = (month) => {
  const date = new Date(`${month}-01T00:00:00`);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });
};

const getStatusMeta = (percentage) =>
  STATUS_CONFIG.find((status) => percentage >= status.threshold) ||
  STATUS_CONFIG[STATUS_CONFIG.length - 1];

const BudgetGoals = () => {
  const [budgetProgress, setBudgetProgress] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [newGoal, setNewGoal] = useState({
    category: "",
    monthly_limit: "",
  });
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const categories = EXPENSE_CATEGORIES;

  const fetchBudgetProgress = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get("/budget-progress", {
        params: { month: selectedMonth },
      });
      const rows = response.data.map(normalizeBudgetRow);
      setBudgetProgress(rows);
      setNotifications(generateBudgetAlerts(rows, selectedMonth));
    } catch (error) {
      console.error("Error fetching budget progress:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchBudgetProgress();
  }, [fetchBudgetProgress]);

  const totalBudget = useMemo(
    () =>
      budgetProgress.reduce(
        (sum, goal) => sum + (goal.monthly_limit || 0),
        0
      ),
    [budgetProgress]
  );

  const totalSpent = useMemo(
    () =>
      budgetProgress.reduce((sum, goal) => sum + (goal.spent_amount || 0), 0),
    [budgetProgress]
  );

  const overallProgress = totalBudget
    ? Math.min((totalSpent / totalBudget) * 100, 999)
    : 0;

  const handleAddGoal = async (event) => {
    event.preventDefault();
    if (!newGoal.category || !newGoal.monthly_limit) {
      alert("Please choose a category and enter a monthly limit.");
      return;
    }

    try {
      await apiClient.post("/budget-goals", newGoal);
      setNewGoal({ category: "", monthly_limit: "" });
      setShowAddForm(false);
      fetchBudgetProgress();
    } catch (error) {
      console.error("Error adding budget goal:", error);
      alert("Could not add the budget goal. Please try again.");
    }
  };

  const handleEditGoal = async (event) => {
    event.preventDefault();
    if (!editingGoal) {
      return;
    }

    try {
      await apiClient.put(`/budget-goals/${editingGoal.id}`, {
        category: editingGoal.category,
        monthly_limit: editingGoal.monthly_limit,
      });
      setEditingGoal(null);
      fetchBudgetProgress();
    } catch (error) {
      console.error("Error updating budget goal:", error);
      alert("Could not update the budget goal. Please try again.");
    }
  };

  const handleDeleteGoal = async (id) => {
    if (!window.confirm("Delete this budget goal?")) {
      return;
    }

    try {
      await apiClient.delete(`/budget-goals/${id}`);
      fetchBudgetProgress();
    } catch (error) {
      console.error("Error deleting budget goal:", error);
      alert("Could not delete the budget goal. Please try again.");
    }
  };

  const dismissNotification = (notificationId) => {
    setNotifications((previous) =>
      previous.filter((notification) => notification.id !== notificationId)
    );
  };

  return (
    <section className="budget-goals-container">
      <header className="budget-header">
        <div>
          <h2>Budget Goals</h2>
          <p className="budget-subtitle">
            Track how each category performs against its monthly limit.
          </p>
        </div>
        <div className="budget-controls">
          <label className="form-label" htmlFor="budget-month">
            Month
          </label>
          <input
            id="budget-month"
            type="month"
            className="form-input month-input"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            max={new Date().toISOString().slice(0, 7)}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddForm((prev) => !prev)}
          >
            {showAddForm ? "Close Form" : "Add Budget Goal"}
          </button>
        </div>
      </header>

      {notifications.length > 0 && (
        <div className="notification-panel">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`notification-item notification-${notification.type}`}
            >
              <div>
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => dismissNotification(notification.id)}
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {showAddForm && (
        <form className="card add-budget-form" onSubmit={handleAddGoal}>
          <h3>Create a new budget goal</h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="new-goal-category">
                Category
              </label>
              <select
                id="new-goal-category"
                className="form-input"
                value={newGoal.category}
                onChange={(event) =>
                  setNewGoal((prev) => ({
                    ...prev,
                    category: event.target.value,
                  }))
                }
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
              <label className="form-label" htmlFor="new-goal-limit">
                Monthly limit
              </label>
              <input
                id="new-goal-limit"
                type="number"
                step="0.01"
                className="form-input"
                value={newGoal.monthly_limit}
                onChange={(event) =>
                  setNewGoal((prev) => ({
                    ...prev,
                    monthly_limit: event.target.value,
                  }))
                }
                required
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Save Goal
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="card budget-overview">
        <div className="overview-stat">
          <span className="overview-label">Total Budget</span>
          <span className="overview-value">{formatCurrency(totalBudget)}</span>
        </div>
        <div className="overview-stat">
          <span className="overview-label">Total Spent</span>
          <span className="overview-value">{formatCurrency(totalSpent)}</span>
        </div>
        <div className="overview-stat">
          <span className="overview-label">Overall Progress</span>
          <span className="overview-value">
            {formatPercentage(overallProgress, 1)}
          </span>
        </div>
      </section>

      {loading ? (
        <div className="loading-state">
          <p>Loading budget progress…</p>
        </div>
      ) : (
        <div className="budget-progress-grid">
          {budgetProgress.map((progress) =>
            editingGoal && editingGoal.id === progress.id ? (
              <form
                key={progress.id}
                onSubmit={handleEditGoal}
                className="budget-card edit-state"
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-category">
                    Category
                  </label>
                  <select
                    id="edit-category"
                    className="form-input"
                    value={editingGoal.category}
                    onChange={(event) =>
                      setEditingGoal((prev) => ({
                        ...prev,
                        category: event.target.value,
                      }))
                    }
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
                  <label className="form-label" htmlFor="edit-limit">
                    Monthly limit
                  </label>
                  <input
                    id="edit-limit"
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={editingGoal.monthly_limit}
                    onChange={(event) =>
                      setEditingGoal((prev) => ({
                        ...prev,
                        monthly_limit: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="button-group">
                  <button type="submit" className="btn btn-primary btn-sm">
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEditingGoal(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <article key={progress.id} className="budget-card">
                <div className="budget-card-header">
                  <h3>{progress.category}</h3>
                  <div className="status-container">
                    {(() => {
                      const status = getStatusMeta(progress.percentage_used);
                      return (
                        <>
                          <span className="status-icon" aria-hidden="true">
                            {status.icon}
                          </span>
                          <span
                            className="budget-status"
                            style={{ color: status.color }}
                          >
                            {status.label}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="budget-amounts">
                  <div className="amount-row">
                    <span>Spent</span>
                    <span className="amount spent">
                      {formatCurrency(progress.spent_amount)}
                    </span>
                  </div>
                  <div className="amount-row">
                    <span>Budget</span>
                    <span className="amount budget">
                      {formatCurrency(progress.monthly_limit)}
                    </span>
                  </div>
                  <div className="amount-row">
                    <span>Remaining</span>
                    <span
                      className={`amount remaining ${
                        progress.remaining_amount < 0 ? "negative" : "positive"
                      }`}
                    >
                      {formatCurrency(progress.remaining_amount)}
                    </span>
                  </div>
                </div>

                <div className="progress-bar-container">
                  <div
                    className="progress-bar"
                    style={{
                      width: `${Math.min(progress.percentage_used, 100)}%`,
                      backgroundColor: getStatusMeta(progress.percentage_used)
                        .color,
                    }}
                  />
                  <span className="progress-percentage">
                    {formatPercentage(progress.percentage_used)}
                  </span>
                </div>

                <div className="card-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      setEditingGoal({
                        id: progress.id,
                        category: progress.category,
                        monthly_limit: progress.monthly_limit,
                      })
                    }
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDeleteGoal(progress.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            )
          )}
        </div>
      )}

      {budgetProgress.length === 0 && !loading && (
        <div className="empty-state">
          <p>
            No budget goals for {formatMonthDisplay(selectedMonth)} yet. Add a
            goal to start tracking your spending.
          </p>
        </div>
      )}
    </section>
  );
};

const generateBudgetAlerts = (budgetData, selectedMonth) => {
  const alerts = [];
  const currentDate = new Date();
  const selectedDate = new Date(`${selectedMonth}-01T00:00:00`);
  const isCurrentMonth =
    currentDate.getMonth() === selectedDate.getMonth() &&
    currentDate.getFullYear() === selectedDate.getFullYear();

  if (!isCurrentMonth) {
    return alerts;
  }

  budgetData.forEach((budget) => {
    const status = getStatusMeta(budget.percentage_used);

    if (budget.percentage_used >= 100) {
      alerts.push({
        id: `over-${budget.id}`,
        type: "danger",
        title: `${status.icon} ${budget.category}`,
        message: `You exceeded the budget by ${formatCurrency(
          Math.abs(budget.remaining_amount)
        )}.`,
      });
    } else if (budget.percentage_used >= 90) {
      alerts.push({
        id: `warning-${budget.id}`,
        type: "warning",
        title: `${status.icon} ${budget.category}`,
        message: `${formatCurrency(
          budget.remaining_amount
        )} remaining (${formatPercentage(100 - budget.percentage_used, 1)} left).`,
      });
    } else if (budget.percentage_used >= 75) {
      alerts.push({
        id: `caution-${budget.id}`,
        type: "info",
        title: `${status.icon} ${budget.category}`,
        message: `${formatPercentage(
          budget.percentage_used,
          1
        )} of the budget used so far.`,
      });
    }
  });

  return alerts;
};

export default BudgetGoals;
