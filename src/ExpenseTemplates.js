import { useMemo, useState } from "react";
import "./ExpenseTemplates.css";
import { formatCurrency } from "./utils/format";

const DEFAULT_TEMPLATES = [
  { name: "Coffee", amount: 3.5, category: "Eating Out", icon: "☕" },
  { name: "Lunch", amount: 12, category: "Eating Out", icon: "🥗" },
  { name: "Fuel", amount: 60, category: "Carro", icon: "⛽" },
  { name: "Groceries", amount: 45, category: "Groceries", icon: "🛒" },
  { name: "Gym Membership", amount: 35, category: "Gym", icon: "🏋️" },
  { name: "Streaming", amount: 15.99, category: "Entertainment", icon: "🎬" },
  { name: "Ride Share", amount: 8.5, category: "Transport", icon: "🚗" },
  { name: "Healthcare", amount: 25, category: "Healthcare", icon: "💊" },
  { name: "Pizza Night", amount: 17, category: "Eating Out", icon: "🍕" },
];

const today = () => new Date().toISOString().split("T")[0];

const ExpenseTemplates = ({ onAddExpense, categories }) => {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customTemplate, setCustomTemplate] = useState({
    name: "",
    amount: "",
    category: "",
  });

  const templates = useMemo(() => DEFAULT_TEMPLATES, []);

  const handleTemplateClick = (template) => {
    if (!onAddExpense) {
      return;
    }

    onAddExpense({
      name: template.name,
      amount: template.amount.toString(),
      date: today(),
      category: template.category,
    });
  };

  const handleCustomSubmit = () => {
    if (
      !customTemplate.name ||
      !customTemplate.amount ||
      !customTemplate.category
    ) {
      alert("Please complete all fields to save the custom expense.");
      return;
    }

    onAddExpense({
      name: customTemplate.name,
      amount: customTemplate.amount,
      date: today(),
      category: customTemplate.category,
    });

    setCustomTemplate({ name: "", amount: "", category: "" });
    setShowCustomForm(false);
  };

  return (
    <section className="expense-templates card">
      <div className="templates-header">
        <div>
          <h2>Quick Add Expenses</h2>
          <p>Select a template to instantly add a frequent purchase.</p>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setShowCustomForm((prev) => !prev)}
        >
          {showCustomForm ? "Close Custom Form" : "Create Custom Template"}
        </button>
      </div>

      <div className="templates-grid">
        {templates.map((template) => (
          <button
            type="button"
            key={template.name}
            className="template-btn"
            onClick={() => handleTemplateClick(template)}
          >
            <span className="template-icon" aria-hidden="true">
              {template.icon}
            </span>
            <span className="template-info">
              <span className="template-name">{template.name}</span>
              <span className="template-category">{template.category}</span>
              <span className="template-amount">
                {formatCurrency(template.amount)}
              </span>
            </span>
          </button>
        ))}
      </div>

      {showCustomForm && (
        <div className="custom-template-form">
          <h3>Create custom expense</h3>
          <div className="custom-form-grid">
            <input
              type="text"
              placeholder="Expense name"
              value={customTemplate.name}
              onChange={(event) =>
                setCustomTemplate((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              className="custom-input"
            />
            <input
              type="number"
              placeholder="Amount"
              value={customTemplate.amount}
              onChange={(event) =>
                setCustomTemplate((prev) => ({
                  ...prev,
                  amount: event.target.value,
                }))
              }
              className="custom-input"
              step="0.01"
              min="0"
            />
            <select
              value={customTemplate.category}
              onChange={(event) =>
                setCustomTemplate((prev) => ({
                  ...prev,
                  category: event.target.value,
                }))
              }
              className="custom-select"
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="custom-form-actions">
            <button
              type="button"
              onClick={handleCustomSubmit}
              className="btn btn-primary"
            >
              Add Custom Expense
            </button>
            <button
              type="button"
              onClick={() => setShowCustomForm(false)}
              className="btn btn-ghost"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default ExpenseTemplates;
