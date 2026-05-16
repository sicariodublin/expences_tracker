@echo off
setlocal

set "ROOT=%~dp0"

echo Starting backend (API)...
start "Expense Tracker - Backend" cmd /k "cd /d ""%ROOT%"" && npm run dev"

echo Starting frontend (React)...
start "Expense Tracker - Frontend" cmd /k "cd /d ""%ROOT%frontend"" && npm start"

echo Opening app in browser...
timeout /t 3 >nul
start "" "http://localhost:3000"

endlocal