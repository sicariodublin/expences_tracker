-- Initial schema for expense-tracker
-- All tables created here so fresh deployments don't depend on ALTER TABLE shims in initAuthTables

CREATE TABLE IF NOT EXISTS users (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  username     VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id      INT PRIMARY KEY,
  first_name   VARCHAR(100),
  last_name    VARCHAR(100),
  date_of_birth DATE,
  currency     VARCHAR(10),
  bank         VARCHAR(100),
  avatar_url   VARCHAR(255),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_settings (
  user_id    INT PRIMARY KEY,
  provider   VARCHAR(50) NOT NULL,
  smtp_host  VARCHAR(150),
  smtp_port  INT,
  smtp_user  VARCHAR(150),
  smtp_pass  TEXT,
  api_key    TEXT,
  from_email VARCHAR(150),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_refresh_hash (token_hash),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at    TIMESTAMP NULL,
  UNIQUE KEY uq_reset_hash (token_hash),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS expenses (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  name     VARCHAR(120) NOT NULL,
  amount   DECIMAL(10,2) NOT NULL,
  date     DATE NOT NULL,
  category VARCHAR(100) NOT NULL,
  user_id  INT NULL
);

CREATE TABLE IF NOT EXISTS credits (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  name     VARCHAR(120) NOT NULL,
  amount   DECIMAL(10,2) NOT NULL,
  date     DATE NOT NULL,
  category VARCHAR(100) NOT NULL,
  user_id  INT NULL
);

CREATE TABLE IF NOT EXISTS budget_goals (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  category      VARCHAR(100) NOT NULL,
  monthly_limit DECIMAL(10,2) NOT NULL,
  created_date  DATE DEFAULT (CURRENT_DATE),
  is_active     BOOLEAN DEFAULT TRUE,
  user_id       INT NULL
);

CREATE TABLE IF NOT EXISTS expected_incomes (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  name               VARCHAR(120) NOT NULL,
  category           VARCHAR(100) NOT NULL,
  expected_amount    DECIMAL(10,2) NOT NULL,
  frequency          ENUM('daily','weekly','biweekly','monthly','quarterly','yearly') DEFAULT 'monthly',
  due_day            TINYINT NULL,
  notes              VARCHAR(255),
  last_received_date DATE NULL,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  user_id            INT NULL
);

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  type          ENUM('expense','credit') NOT NULL,
  name          VARCHAR(120) NOT NULL,
  category      VARCHAR(100) NOT NULL,
  amount        DECIMAL(10,2) NOT NULL,
  frequency     ENUM('daily','weekly','biweekly','monthly','quarterly','yearly') DEFAULT 'monthly',
  day_of_month  TINYINT NULL,
  weekday       TINYINT NULL,
  next_run_date DATE NOT NULL,
  last_run_date DATE NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  user_id       INT NULL
);

CREATE TABLE IF NOT EXISTS report_schedules (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  recipient_email        VARCHAR(160) NOT NULL,
  format                 ENUM('pdf','excel') DEFAULT 'pdf',
  frequency              ENUM('weekly','monthly') DEFAULT 'monthly',
  include_budget_overview BOOLEAN DEFAULT TRUE,
  include_trends         BOOLEAN DEFAULT TRUE,
  include_recurring      BOOLEAN DEFAULT TRUE,
  next_send_date         DATE NOT NULL,
  last_sent_at           DATETIME NULL,
  is_active              BOOLEAN DEFAULT TRUE,
  created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  user_id                INT NULL
);

CREATE INDEX idx_expenses_date      ON expenses(date);
CREATE INDEX idx_expenses_category  ON expenses(category);
CREATE INDEX idx_expenses_user      ON expenses(user_id);
CREATE INDEX idx_credits_date       ON credits(date);
CREATE INDEX idx_credits_category   ON credits(category);
CREATE INDEX idx_credits_user       ON credits(user_id);
CREATE INDEX idx_budget_goals_user  ON budget_goals(user_id);
CREATE INDEX idx_refresh_user       ON refresh_tokens(user_id);
