CREATE DATABASE expense_tracker;
USE expense_tracker;

DESCRIBE credits;
SELECT * FROM credits;

DESCRIBE expenses;
SELECT * FROM expenses;

UPDATE expenses
SET name = 'Diesel'
WHERE name = 'Applegreen Bal';

UPDATE expenses
   SET category = 'Carro'
 WHERE category = 'Car';

CREATE TABLE budget_goals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  monthly_limit DECIMAL(10, 2) NOT NULL,
  created_date DATE DEFAULT DATE,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS expected_incomes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(100) NOT NULL,
  expected_amount DECIMAL(10, 2) NOT NULL,
  frequency ENUM('monthly', 'quarterly', 'yearly', 'one-time') DEFAULT 'monthly',
  due_day TINYINT NULL,
  notes VARCHAR(255),
  last_received_date DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('expense', 'credit') NOT NULL,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  frequency ENUM('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly') DEFAULT 'monthly',
  day_of_month TINYINT NULL,
  weekday TINYINT NULL,
  next_run_date DATE NOT NULL,
  last_run_date DATE NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS report_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipient_email VARCHAR(160) NOT NULL,
  format ENUM('pdf', 'excel') DEFAULT 'pdf',
  frequency ENUM('weekly', 'monthly') DEFAULT 'monthly',
  include_budget_overview BOOLEAN DEFAULT TRUE,
  include_trends BOOLEAN DEFAULT TRUE,
  include_recurring BOOLEAN DEFAULT TRUE,
  next_send_date DATE NOT NULL,
  last_sent_at DATETIME NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
