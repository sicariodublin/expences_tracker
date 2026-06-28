import Chart from "chart.js/auto";
import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Sun,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Toaster, toast } from "react-hot-toast";
import Analytics from "./Analytics";
import "./App.css";
import Automation from "./Automation";
import BudgetGoals from "./BudgetGoals";
import ExpenseTemplates from "./ExpenseTemplates";
import SpendingTrends from "./SpendingTrends";
import apiClient from "./api/apiClient";
import { EXPENSE_CATEGORIES } from "./constants/categories";
import { formatCurrency } from "./utils/format";

const CHART_COLORS = [
  "#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#6366f1",
  "#14b8a6", "#eab308",
];

const TODAY = new Date().toISOString().split("T")[0];

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "budget",    label: "Budget Goals", Icon: Target },
  { id: "analytics", label: "Analytics",    Icon: BarChart3 },
  { id: "automation", label: "Automation",  Icon: Zap },
];

const parseByType = (value, type) => {
  if (type === "number") return parseFloat(value) || 0;
  if (type === "date")   return new Date(value).getTime();
  return (value || "").toString().toLowerCase();
};

const sortByColumn = (collection, column, type, order) =>
  [...collection].sort((a, b) => {
    const aVal = parseByType(a[column], type);
    const bVal = parseByType(b[column], type);
    if (aVal === bVal) return 0;
    return order === "asc" ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });

/* ── Reusable primitives ─────────────────────────────────────────────────── */

const inputCls =
  "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400 dark:placeholder-slate-500";

const labelCls = "block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1";

const cardCls =
  "bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm";

const btnPrimary =
  "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const btnSecondary =
  "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium transition-colors";

const btnGhost =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium transition-colors";

const btnDanger =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-medium transition-colors";

/* ── App ─────────────────────────────────────────────────────────────────── */

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!(localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token"))
  );
  const [showAuthDialog, setShowAuthDialog] = useState(
    () => !((localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token")))
  );
  const [authMode, setAuthMode]       = useState("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authRepeat, setAuthRepeat]   = useState("");
  const [rememberMe, setRememberMe]   = useState(true);
  const [authBusy, setAuthBusy]       = useState(false);
  const [darkMode, setDarkMode]       = useState(() => localStorage.getItem("darkMode") === "true");
  const [activeTab, setActiveTab]     = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [expenses, setExpenses]           = useState([]);
  const [credits, setCredits]             = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]);
  const [filteredCredits, setFilteredCredits]   = useState([]);
  const [showExpenses, setShowExpenses]   = useState(false);

  const [name, setName]         = useState("");
  const [amount, setAmount]     = useState("");
  const [date, setDate]         = useState("");
  const [category, setCategory] = useState("");

  const [creditName, setCreditName]         = useState("");
  const [creditAmount, setCreditAmount]     = useState("");
  const [creditDate, setCreditDate]         = useState(TODAY);
  const [creditCategory, setCreditCategory] = useState("");

  const [filterName, setFilterName] = useState("");
  const [startDate, setStartDate]   = useState("");
  const [endDate, setEndDate]       = useState("");
  const [sortColumn, setSortColumn] = useState(null);
  const [sortOrder, setSortOrder]   = useState("asc");
  const [loading, setLoading]       = useState(false);
  const [file, setFile]             = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editTarget, setEditTarget]   = useState(null);
  const [editName, setEditName]       = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editAmount, setEditAmount]   = useState("");
  const [editDate, setEditDate]       = useState("");

  const chartCanvasRef   = useRef(null);
  const chartInstanceRef = useRef(null);
  const fileInputRef     = useRef(null);

  const categories = EXPENSE_CATEGORIES;

  /* dark mode ---------------------------------------------------------------- */
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((p) => !p);

  /* auth --------------------------------------------------------------------- */
  const storeToken = (token) => {
    if (rememberMe) {
      localStorage.setItem("auth_token", token);
      sessionStorage.removeItem("auth_token");
    } else {
      sessionStorage.setItem("auth_token", token);
      localStorage.removeItem("auth_token");
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthBusy(true);
    try {
      if (authMode === "register") {
        if (!authUsername || !authPassword || authPassword !== authRepeat) {
          toast.error("Fill in all fields and ensure passwords match.");
          return;
        }
        const { data } = await apiClient.post("/auth/register", { username: authUsername, password: authPassword });
        storeToken(data.token);
        setIsAuthenticated(true);
        setShowAuthDialog(false);
      } else {
        const { data } = await apiClient.post("/auth/login", { username: authUsername, password: authPassword });
        storeToken(data.token);
        setIsAuthenticated(true);
        setShowAuthDialog(false);
      }
    } catch (error) {
      console.error("Auth error", error);
      toast.error(error.response?.data?.error || "Authentication failed. Check your connection and try again.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    sessionStorage.removeItem("auth_token");
    setIsAuthenticated(false);
    setShowAuthDialog(true);
  };

  /* data --------------------------------------------------------------------- */
  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/expenses");
      setExpenses(response.data);
    } catch (error) {
      console.error("Error fetching expenses:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCredits = useCallback(async () => {
    try {
      const response = await apiClient.get("/credits");
      setCredits(response.data);
    } catch (error) {
      console.error("Error fetching credits:", error);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchExpenses();
    fetchCredits();
  }, [isAuthenticated, fetchExpenses, fetchCredits]);

  /* filtering ---------------------------------------------------------------- */
  useEffect(() => {
    const q = filterName.trim().toLowerCase();
    const matchQ = (r) => !q || r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
    const matchS = (d) => !startDate || d >= startDate;
    const matchE = (d) => !endDate   || d <= endDate;
    const norm   = (r) => r.date?.slice(0, 10);
    setFilteredExpenses(expenses.filter((r) => matchQ(r) && matchS(norm(r)) && matchE(norm(r))));
    setFilteredCredits(credits.filter((r)  => matchQ(r) && matchS(norm(r)) && matchE(norm(r))));
  }, [expenses, credits, filterName, startDate, endDate]);

  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0),
    [filteredExpenses]
  );
  const totalIncome = useMemo(
    () => filteredCredits.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0),
    [filteredCredits]
  );
  const balance = useMemo(() => totalIncome - totalExpenses, [totalIncome, totalExpenses]);

  /* chart -------------------------------------------------------------------- */
  useEffect(() => {
    if (!isModalOpen) {
      chartInstanceRef.current?.destroy();
      chartInstanceRef.current = null;
      return;
    }
    if (!chartCanvasRef.current) return;

    const totals = {};
    filteredExpenses.forEach((e) => {
      totals[e.category] = (totals[e.category] || 0) + (parseFloat(e.amount) || 0);
    });
    filteredCredits.forEach((c) => {
      totals[c.category] = (totals[c.category] || 0) + (parseFloat(c.amount) || 0);
    });

    const labels = Object.keys(totals);
    if (!labels.length) {
      chartInstanceRef.current?.destroy();
      chartInstanceRef.current = null;
      return;
    }

    chartInstanceRef.current?.destroy();
    chartInstanceRef.current = new Chart(chartCanvasRef.current, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{ data: labels.map((l) => Math.round((totals[l] || 0) * 100) / 100), backgroundColor: CHART_COLORS }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
          tooltip: { callbacks: { label: (c) => `${c.label}: ${formatCurrency(c.raw)}` } },
        },
      },
    });
    return () => { chartInstanceRef.current?.destroy(); chartInstanceRef.current = null; };
  }, [filteredCredits, filteredExpenses, isModalOpen]);

  /* CRUD --------------------------------------------------------------------- */
  const handleAddExpense = async () => {
    if (!name || !amount || !date || !category) {
      toast.error("Please fill in all expense fields.");
      return;
    }
    try {
      setLoading(true);
      await apiClient.post("/expenses", { name, amount, date, category });
      await fetchExpenses();
      setShowExpenses(true);
      setName(""); setAmount(""); setDate(""); setCategory("");
      toast.success("Expense added.");
    } catch {
      toast.error("Could not add the expense. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const addExpenseFromTemplate = async (template) => {
    try {
      setLoading(true);
      await apiClient.post("/expenses", template);
      await fetchExpenses();
      setShowExpenses(true);
      toast.success(`Added ${template.name} (${formatCurrency(template.amount)})`);
    } catch {
      toast.error("Could not add the expense template. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCredit = async () => {
    if (!creditName || !creditAmount || !creditDate || !creditCategory) {
      toast.error("Please fill in all income fields.");
      return;
    }
    try {
      await apiClient.post("/credits", { name: creditName, amount: creditAmount, date: creditDate, category: creditCategory });
      await fetchCredits();
      setShowExpenses(true);
      setCreditName(""); setCreditAmount(""); setCreditDate(TODAY); setCreditCategory("");
      toast.success("Income entry added.");
    } catch {
      toast.error("Could not add the income entry. Please try again.");
    }
  };

  const applyFilters = () => {
    setShowExpenses(true);
  };

  const resetFilters = () => {
    setFilterName(""); setStartDate(""); setEndDate("");
    setFilteredExpenses(expenses); setFilteredCredits(credits);
    setShowExpenses(false); setSortColumn(null); setSortOrder("asc");
  };

  const uploadCSV = async () => {
    if (!file) { toast.error("Please select a CSV file to upload."); return; }
    const formData = new FormData();
    formData.append("file", file);
    try {
      setLoading(true);
      await apiClient.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      await Promise.all([fetchExpenses(), fetchCredits()]);
      setShowExpenses(true);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("CSV imported successfully.");
    } catch {
      toast.error("Could not import the CSV file. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const deleteExpense = async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await apiClient.delete(`/expenses/${id}`);
      await fetchExpenses();
      toast.success("Expense deleted.");
    } catch {
      toast.error("Could not delete the expense.");
    }
  };

  const deleteCredit = async (id) => {
    if (!window.confirm("Delete this income entry?")) return;
    try {
      await apiClient.delete(`/credits/${id}`);
      await fetchCredits();
      toast.success("Income entry deleted.");
    } catch {
      toast.error("Could not delete the income entry.");
    }
  };

  const openEdit  = (record, type) => {
    setEditTarget({ type, record });
    setEditName(record.name || "");
    setEditCategory(record.category || "");
    setEditAmount(String(record.amount || ""));
    setEditDate(record.date?.slice(0, 10) || "");
  };
  const closeEdit = () => {
    setEditTarget(null); setEditName(""); setEditCategory(""); setEditAmount(""); setEditDate("");
  };
  const saveEdit  = async () => {
    if (!editTarget) return;
    const { type, record } = editTarget;
    try {
      const payload = {};
      if (editName     && editName     !== record.name)             payload.name     = editName;
      if (editCategory && editCategory !== record.category)         payload.category = editCategory;
      if (editAmount   && String(editAmount) !== String(record.amount)) payload.amount = editAmount;
      if (editDate     && editDate !== record.date?.slice(0, 10))   payload.date     = editDate;
      if (!Object.keys(payload).length) { closeEdit(); return; }
      if (type === "expense") { await apiClient.put(`/expenses/${record.id}`, payload); await fetchExpenses(); }
      else                    { await apiClient.put(`/credits/${record.id}`,  payload); await fetchCredits(); }
      toast.success("Changes saved.");
    } catch {
      toast.error("Could not save changes.");
    } finally {
      closeEdit();
    }
  };

  const handleSortExpenses = (column, type) => {
    const next = sortColumn === column && sortOrder === "asc" ? "desc" : "asc";
    setSortColumn(column); setSortOrder(next);
    setFilteredExpenses(sortByColumn(filteredExpenses, column, type, next));
  };
  const handleSortCredits = (column, type) => {
    const next = sortColumn === column && sortOrder === "asc" ? "desc" : "asc";
    setSortColumn(column); setSortOrder(next);
    setFilteredCredits(sortByColumn(filteredCredits, column, type, next));
  };

  const renderSortIcon = (col) =>
    sortColumn === col ? <span className="sort-icon">{sortOrder === "asc" ? "↑" : "↓"}</span> : null;

  /* ── Dashboard content ───────────────────────────────────────────────────── */
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={cardCls + " p-5"}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Expenses</p>
            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalExpenses)}</p>
        </div>

        <div className={cardCls + " p-5"}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Income</p>
            <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalIncome)}</p>
        </div>

        <div className={cardCls + " p-5 " + (balance >= 0 ? "border-l-4 border-l-green-500" : "border-l-4 border-l-red-500")}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Balance</p>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${balance >= 0 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"}`}>
              <Wallet className={`w-4 h-4 ${balance >= 0 ? "text-green-500" : "text-red-500"}`} />
            </div>
          </div>
          <p className={`text-2xl font-bold ${balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {formatCurrency(balance)}
          </p>
        </div>
      </div>

      {/* Add forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add Expense */}
        <div className={cardCls + " p-6"}>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Add Expense</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Expense Name</label>
              <input type="text" className={inputCls} placeholder="e.g. Groceries" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Amount</label>
              <input type="number" className={inputCls} placeholder="0.00" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" className={inputCls} value={date} max={TODAY} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Category</label>
              <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Select a category</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button className={btnPrimary} onClick={handleAddExpense} disabled={loading}>Add Expense</button>
          </div>
        </div>

        {/* Add Income */}
        <div className={cardCls + " p-6"}>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Add Income</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Income Source</label>
              <input type="text" className={inputCls} placeholder="e.g. Salary" value={creditName} onChange={(e) => setCreditName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Amount</label>
              <input type="number" className={inputCls} placeholder="0.00" step="0.01" min="0" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" className={inputCls} value={creditDate} max={TODAY} onChange={(e) => setCreditDate(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Category</label>
              <select className={inputCls} value={creditCategory} onChange={(e) => setCreditCategory(e.target.value)}>
                <option value="">Select a category</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button className={btnSecondary} onClick={handleAddCredit}>Add Income</button>
          </div>
        </div>
      </div>

      {/* Templates */}
      <ExpenseTemplates onAddExpense={addExpenseFromTemplate} categories={categories} />

      {/* Filters */}
      <div className={cardCls + " p-6"}>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Filters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Search</label>
            <input type="text" className={inputCls} placeholder="Name or category" value={filterName} onChange={(e) => setFilterName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Start Date</label>
            <input type="date" className={inputCls} value={startDate} max={TODAY} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>End Date</label>
            <input type="date" className={inputCls} value={endDate} max={TODAY} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button className={btnPrimary} onClick={applyFilters}>Apply Filters</button>
          <button className={btnSecondary} onClick={resetFilters}>Reset</button>
          <button className={btnSecondary} onClick={() => setShowExpenses((p) => !p)}>
            {showExpenses ? "Hide Tables" : "Show Tables"}
          </button>
          <button
            className={btnSecondary + " ml-auto"}
            disabled={!filteredExpenses.length && !filteredCredits.length}
            onClick={() => setIsModalOpen(true)}
          >
            Category Breakdown
          </button>
        </div>
      </div>

      {/* Import CSV */}
      <div className={cardCls + " p-6"}>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Import Transactions</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="flex-1 text-sm text-slate-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 dark:file:bg-slate-700 dark:file:text-slate-200 hover:file:bg-slate-200 dark:hover:file:bg-slate-600 cursor-pointer"
          />
          <button className={btnSecondary} onClick={uploadCSV} disabled={loading}>Upload CSV</button>
        </div>
      </div>

      {/* Transaction tables */}
      {showExpenses && (
        <div className="space-y-4">
          {/* Expenses table */}
          <div className={cardCls + " overflow-hidden"}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Expenses</h2>
              <span className="text-xs text-slate-400">{filteredExpenses.length} item{filteredExpenses.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400 cursor-pointer select-none" onClick={() => handleSortExpenses("name", "string")}>Name {renderSortIcon("name")}</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-500 dark:text-slate-400 cursor-pointer select-none" onClick={() => handleSortExpenses("amount", "number")}>Amount {renderSortIcon("amount")}</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400 cursor-pointer select-none" onClick={() => handleSortExpenses("date", "date")}>Date {renderSortIcon("date")}</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Category</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">{exp.name}</td>
                      <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-200 tabular-nums">{formatCurrency(exp.amount)}</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {new Date(exp.date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      <td className="py-3 px-4"><span className="category-badge">{exp.category}</span></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 justify-end">
                          <button className={btnGhost} onClick={() => openEdit(exp, "expense")}>Edit</button>
                          <button className={btnDanger} onClick={() => deleteExpense(exp.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredExpenses.length && <p className="text-center text-slate-400 py-8 text-sm">No expenses to show.</p>}
            </div>
          </div>

          {/* Income table */}
          <div className={cardCls + " overflow-hidden"}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Income</h2>
              <span className="text-xs text-slate-400">{filteredCredits.length} item{filteredCredits.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400 cursor-pointer select-none" onClick={() => handleSortCredits("name", "string")}>Source {renderSortIcon("name")}</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-500 dark:text-slate-400 cursor-pointer select-none" onClick={() => handleSortCredits("amount", "number")}>Amount {renderSortIcon("amount")}</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400 cursor-pointer select-none" onClick={() => handleSortCredits("date", "date")}>Date {renderSortIcon("date")}</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Category</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {filteredCredits.map((credit) => (
                    <tr key={credit.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">{credit.name}</td>
                      <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-200 tabular-nums">{formatCurrency(credit.amount)}</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {new Date(credit.date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      <td className="py-3 px-4"><span className="category-badge">{credit.category}</span></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 justify-end">
                          <button className={btnGhost} onClick={() => openEdit(credit, "credit")}>Edit</button>
                          <button className={btnDanger} onClick={() => deleteCredit(credit.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredCredits.length && <p className="text-center text-slate-400 py-8 text-sm">No income entries to show.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "text-sm font-medium",
          style: { borderRadius: "10px", padding: "12px 16px" },
        }}
      />

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:relative md:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 h-16 px-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Expense<br />Tracker</span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === id
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-4 border-t border-slate-200 dark:border-slate-800 space-y-0.5 shrink-0">
          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {darkMode ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
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

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="h-16 flex items-center gap-4 px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {NAV_ITEMS.find((n) => n.id === activeTab)?.label}
          </h2>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          {isAuthenticated && (
            <>
              {activeTab === "dashboard" && renderDashboard()}
              {activeTab === "budget"    && <BudgetGoals />}
              {activeTab === "analytics" && <><Analytics /><SpendingTrends /></>}
              {activeTab === "automation" && <Automation />}
            </>
          )}
        </main>
      </div>

      {/* ── Chart modal ──────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white">Spending by Category</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="chart-container">
              {filteredExpenses.length || filteredCredits.length
                ? <canvas ref={chartCanvasRef} />
                : <p className="text-center text-slate-400 text-sm">Add transactions to view the breakdown.</p>
              }
            </div>
          </div>
        </div>
      )}

      {/* ── Edit modal ───────────────────────────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60" onClick={closeEdit}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Edit {editTarget.type === "expense" ? "Expense" : "Income"}
              </h3>
              <button onClick={closeEdit} className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div>
                <label className={labelCls}>Name</label>
                <input type="text" className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Amount</label>
                  <input type="number" step="0.01" min="0" className={inputCls} value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Date</label>
                  <input type="date" className={inputCls} value={editDate} max={TODAY} onChange={(e) => setEditDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <select className={inputCls} value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                  <option value="">Select a category</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 px-6 pb-5">
              <button className={btnPrimary} onClick={saveEdit}>Save Changes</button>
              <button className={btnSecondary} onClick={closeEdit}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Auth modal ───────────────────────────────────────────────────── */}
      {showAuthDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700">
            {/* Header */}
            <div className="px-6 pt-8 pb-2 text-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {authMode === "register" ? "Create account" : "Welcome back"}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {authMode === "register" ? "Sign up to start tracking" : "Sign in to your account"}
              </p>
            </div>

            {/* Form */}
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
              <div className="flex items-center justify-between pt-1">
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
              <button type="submit" className={btnPrimary + " w-full justify-center py-2.5 mt-1"} disabled={authBusy}>
                {authBusy ? "Please wait…" : authMode === "register" ? "Create Account" : "Sign In"}
              </button>
            </form>

            {/* Toggle */}
            <div className="px-6 pb-6 text-center text-sm text-slate-500 dark:text-slate-400">
              {authMode === "register" ? (
                <>Already have an account?{" "}
                  <button className="text-blue-600 dark:text-blue-400 font-medium hover:underline" onClick={() => setAuthMode("login")}>Sign in</button>
                </>
              ) : (
                <>No account yet?{" "}
                  <button className="text-blue-600 dark:text-blue-400 font-medium hover:underline" onClick={() => setAuthMode("register")}>Create one</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
