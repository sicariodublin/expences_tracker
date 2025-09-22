import { useState } from 'react';
import './ExpenseTemplates.css';

const ExpenseTemplates = ({ onAddExpense, categories }) => {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customTemplate, setCustomTemplate] = useState({
    name: '',
    amount: '',
    category: ''
  });

  // Predefined expense templates
  const expenseTemplates = [
    { name: 'Coffee', amount: 3.50, category: 'Eating Out', icon: '☕' },
    { name: 'Lunch', amount: 12.00, category: 'Eating Out', icon: '🍽️' },
    { name: 'Gas', amount: 60.00, category: 'Carro', icon: '⛽' },
    { name: 'Groceries', amount: 45.00, category: 'Groceries', icon: '🛒' },
    { name: 'Gym', amount: 35.00, category: 'Gym', icon: '💪' },
    { name: 'Netflix', amount: 15.99, category: 'Entertainment', icon: '📺' },
    { name: 'Uber', amount: 8.50, category: 'Transport', icon: '🚗' },
      { name: 'Pharmacy', amount: 25.00, category: 'Healthcare', icon: '💊' },
      { name: 'Pizza', amount: 17.00, category: 'Eating Out', icon: '🍕' },
  ];

  const handleTemplateClick = (template) => {
    const today = new Date().toISOString().split('T')[0];
    onAddExpense({
      name: template.name,
      amount: template.amount.toString(),
      date: today,
      category: template.category
    });
  };

  const handleCustomSubmit = () => {
    if (!customTemplate.name || !customTemplate.amount || !customTemplate.category) {
      alert('Please fill in all fields for custom template');
      return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    onAddExpense({
      name: customTemplate.name,
      amount: customTemplate.amount,
      date: today,
      category: customTemplate.category
    });
    
    setCustomTemplate({ name: '', amount: '', category: '' });
    setShowCustomForm(false);
  };

  return (
    <div className="expense-templates">
      <div className="templates-header">
        <h2>⚡ Quick Add Expenses</h2>
        <p>Click any template to instantly add a common expense</p>
      </div>
      
      <div className="templates-grid">
        {expenseTemplates.map((template, index) => (
          <button
            key={index}
            className="template-btn"
            onClick={() => handleTemplateClick(template)}
            title={`Add ${template.name} - €${template.amount}`}
          >
            <div className="template-icon">{template.icon}</div>
            <div className="template-info">
              <span className="template-name">{template.name}</span>
              <span className="template-amount">€{template.amount}</span>
              <span className="template-category">{template.category}</span>
            </div>
          </button>
        ))}
        
        {/* Custom Template Button */}
        <button
          className="template-btn custom-btn"
          onClick={() => setShowCustomForm(!showCustomForm)}
        >
          <div className="template-icon">➕</div>
          <div className="template-info">
            <span className="template-name">Custom</span>
            <span className="template-amount">Add Your Own</span>
          </div>
        </button>
      </div>

      {/* Custom Template Form */}
      {showCustomForm && (
        <div className="custom-template-form">
          <h3>Create Custom Expense</h3>
          <div className="custom-form-grid">
            <input
              type="text"
              placeholder="Expense name"
              value={customTemplate.name}
              onChange={(e) => setCustomTemplate({...customTemplate, name: e.target.value})}
              className="custom-input"
            />
            <input
              type="number"
              placeholder="Amount"
              value={customTemplate.amount}
              onChange={(e) => setCustomTemplate({...customTemplate, amount: e.target.value})}
              className="custom-input"
              step="0.01"
              min="0"
            />
            <select
              value={customTemplate.category}
              onChange={(e) => setCustomTemplate({...customTemplate, category: e.target.value})}
              className="custom-select"
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className="custom-form-actions">
            <button onClick={handleCustomSubmit} className="btn btn-primary">
              Add Custom Expense
            </button>
            <button 
              onClick={() => setShowCustomForm(false)} 
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseTemplates;