import { useMemo, useState } from "react";
import "./ExpenseTemplates.css";
import { formatCurrency } from "./utils/format";

const DEFAULT_TEMPLATES = [
  { name: "Coffee", amount: 3.5, category: "Eating Out", icon: "☕" },
  { name: "Lunch", amount: 12, category: "Eating Out", icon: "🥗" },
  { name: "Fuel", amount: 50, category: "Carro", icon: "⛽" },
  { name: "Groceries", amount: 45, category: "Groceries", icon: "🛒" },
  { name: "Gym Member", amount: 36, category: "Gym", icon: "🏋️" },
  { name: "Streaming", amount: 15.99, category: "Entertainment", icon: "🎬" },
  { name: "Train", amount: 13, category: "Transport", icon: "🚆" },
  { name: "Hair Cut", amount: 25, category: "Self-Care", icon: "💇‍♀️" },
  { name: "Pizza Night", amount: 17, category: "Eating Out", icon: "🍕" },
  { name: "Massage", amount: 60, category: "Self-Care", icon: "💆" },
];

const today = () => new Date().toISOString().split("T")[0];

const ExpenseTemplates = ({ onAddExpense, categories }) => {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customTemplate, setCustomTemplate] = useState({
    name: "",
    amount: "",
    category: "",
  });
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingAmount, setEditingAmount] = useState("");

  const templates = useMemo(() => DEFAULT_TEMPLATES, []);

  const openEdit = (template) => {
    setEditingTemplate(template);
    setEditingAmount(String(template.amount));
  };

  const confirmTemplateAdd = () => {
    if (!editingTemplate || !onAddExpense) return;
    const amt = parseFloat(editingAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    onAddExpense({
      name: editingTemplate.name,
      amount: String(amt),
      date: today(),
      category: editingTemplate.category,
    });
    setEditingTemplate(null);
    setEditingAmount("");
  };

  const cancelTemplateEdit = () => {
    setEditingTemplate(null);
    setEditingAmount("");
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
          <div
            key={template.name}
            className="template-btn"
          >
            <span className="template-icon" aria-hidden="true">
              {template.icon}
            </span>
            <span className="template-info">
              <span className="template-name">{template.name}</span>
              <span className="template-category">{template.category}</span>
              {editingTemplate && editingTemplate.name === template.name ? (
                <span className="template-amount">
                  <input
                    type="number"
                    value={editingAmount}
                    onChange={(e) => setEditingAmount(e.target.value)}
                    step="0.01"
                    min="0"
                    className="form-input"
                    style={{ maxWidth: 120 }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={confirmTemplateAdd}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={cancelTemplateEdit}
                    >
                      Cancel
                    </button>
                  </div>
                </span>
              ) : (
                <span className="template-amount">
                  {formatCurrency(template.amount)}
                </span>
              )}
            </span>
            {(!editingTemplate || editingTemplate.name !== template.name) && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ marginLeft: "auto" }}
                onClick={() => openEdit(template)}
                aria-label={`Edit amount for ${template.name}`}
              >
                ✏️
              </button>
            )}
          </div>
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
