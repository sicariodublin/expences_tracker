import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Sun,
  Target,
  Wallet,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Analytics from "../Analytics";
import Automation from "../Automation";
import BudgetGoals from "../BudgetGoals";
import SpendingTrends from "../SpendingTrends";
import Dashboard from "../pages/Dashboard";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/",           label: "Dashboard",    Icon: LayoutDashboard, end: true },
  { to: "/budgets",    label: "Budget Goals", Icon: Target },
  { to: "/analytics",  label: "Analytics",    Icon: BarChart3 },
  { to: "/automation", label: "Automation",   Icon: Zap },
];

const inputCls =
  "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400 dark:placeholder-slate-500";
const labelCls =
  "block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1";
const btnPrimary =
  "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

function AuthModal() {
  const {
    authMode, setAuthMode,
    authUsername, setAuthUsername,
    authPassword, setAuthPassword,
    authRepeat,   setAuthRepeat,
    rememberMe,   setRememberMe,
    authBusy,
    handleAuthSubmit,
  } = useAuth();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700">
        <div className="px-6 pt-8 pb-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {authMode === "register" ? "Create account" : "Welcome back"}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {authMode === "register"
              ? "Sign up to start tracking"
              : "Sign in to your account"}
          </p>
        </div>

        <form onSubmit={handleAuthSubmit} className="px-6 py-5 space-y-3">
          <div>
            <label className={labelCls}>Email</label>
            <input
              type="text"
              className={inputCls}
              placeholder="your@email.com"
              value={authUsername}
              onChange={(e) => setAuthUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <label className={labelCls}>Password</label>
            <input
              type="password"
              className={inputCls}
              placeholder="••••••••"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              autoComplete={authMode === "register" ? "new-password" : "current-password"}
            />
          </div>
          {authMode === "register" && (
            <div>
              <label className={labelCls}>Confirm Password</label>
              <input
                type="password"
                className={inputCls}
                placeholder="••••••••"
                value={authRepeat}
                onChange={(e) => setAuthRepeat(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          )}
          <div className="flex items-center pt-1">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Remember me
            </label>
          </div>
          <button
            type="submit"
            className={btnPrimary + " w-full justify-center py-2.5 mt-1"}
            disabled={authBusy}
          >
            {authBusy
              ? "Please wait…"
              : authMode === "register"
              ? "Create Account"
              : "Sign In"}
          </button>
        </form>

        <div className="px-6 pb-6 text-center text-sm text-slate-500 dark:text-slate-400">
          {authMode === "register" ? (
            <>
              Already have an account?{" "}
              <button
                className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
                onClick={() => setAuthMode("login")}
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              No account yet?{" "}
              <button
                className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
                onClick={() => setAuthMode("register")}
              >
                Create one
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { isAuthenticated, handleLogout } = useAuth();
  const [darkMode, setDarkMode]     = useState(() => localStorage.getItem("darkMode") === "true");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  const currentPage = NAV_ITEMS.find((n) =>
    n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)
  );

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "text-sm font-medium",
          style: { borderRadius: "10px", padding: "12px 16px" },
        }}
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:relative md:translate-x-0`}
      >
        <div className="flex items-center gap-3 h-16 px-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
            Expense<br />Tracker
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-slate-200 dark:border-slate-800 space-y-0.5 shrink-0">
          <button
            onClick={() => setDarkMode((p) => !p)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {darkMode ? (
              <Sun className="w-4 h-4 shrink-0" />
            ) : (
              <Moon className="w-4 h-4 shrink-0" />
            )}
            {darkMode ? "Light Mode" : "Dark Mode"}
          </button>
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Logout
            </button>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center gap-4 px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {currentPage?.label ?? "Expense Tracker"}
          </h2>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {isAuthenticated ? (
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/budgets" element={<BudgetGoals />} />
              <Route
                path="/analytics"
                element={
                  <>
                    <Analytics />
                    <SpendingTrends />
                  </>
                }
              />
              <Route path="/automation" element={<Automation />} />
            </Routes>
          ) : null}
        </main>
      </div>

      {!isAuthenticated && <AuthModal />}
    </div>
  );
}
