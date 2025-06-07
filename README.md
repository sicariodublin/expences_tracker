# Expense Tracker
A full-stack application to track your personal finances, visualize spending and income trends, and manage budgets. Built with a React front-end and an Express/MySQL back-end.

## Features
* Add / Delete expenses and credits (income), categorized by type

* CSV import to bulk-upload transactions

* Date & Name filters, search by category or transaction name

* Sortable tables (by name, amount, date)

* Balance Modal with doughnut chart and category breakdown

* Analytics View:

  * Monthly bar chart for expenses vs. credits

  * Category pie/doughnut chart

  * Data labels and tooltips formatted as currency

* Dark Mode toggle, persisted in localStorage

## Tech Stack
* Front-End: React, Axios, Chart.js (+ plugins), CSS

* Back-End: Node.js, Express, MySQL2, Multer, csv-parser, CORS

* Database: MySQL

## Project Structure
![Screenshot 2025-06-07 190343](https://github.com/user-attachments/assets/668c4bc0-63c8-46b4-a53c-b929fcca2ddf)

## Prerequisites
* Node.js (v14+ recommended)

* MySQL server

## Environment Variables
Create a .env file in the backend folder:
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASS=your_mysql_password
DB_NAME=your_database_name

## Make sure your MySQL database has two tables:
SQL
![Screenshot 2025-06-07 190949](https://github.com/user-attachments/assets/1f548d76-396d-4e83-a2f4-d9a47d01835b)


## Getting Started

# Back-End
1 - Navigate into the backend folder:
* cd backend

2 - Install dependencies:
npm install express mysql2 cors multer csv-parser dotenv

3 - Start the server:
node server.js
The API will be available at http://localhost:5000/api/...


# Front-End
1 - Navigate into the frontend folder:
* cd frontend

2 - Install dependencies:
* npm install

3 - Start the React development server:
* npm start
The app will open at http://localhost:3000


## Available Scripts
From within the frontend directory:
* npm start
  Starts React in development mode on http://localhost:3000
* npm run build
  Bundles the app into static files for production (outputs to build/)
  
From within the backend directory:
* node server.js
  Starts the Express API server on port 5000


## Usage
1 - Add expenses or credits via the form.

2 - Filter by date range or search by name/category.

3 - Click Show Balance to view your overall balance and a category doughnut chart.

4 - When “Show Analytics” is enabled, view monthly bar charts comparing expenses vs. income.

5 - Toggle between light and dark themes using the 🌓 button.


## Folder Breakdown
backend/
* server.js — defines routes for /api/expenses and /api/credits, handles CSV upload
* .env — database credentials

frontend/src/
* App.js — main component managing state, fetch/post API calls, UI layout
* Analytics.js — reusable chart component for monthly trends (uses react-chartjs-2)
* App.css — styling for forms, tables, modals, and dark mode
* Other assets and components (e.g. modal, form-group styles)

##License
This project is open-source and available under the [MIT License](./LICENSE).
