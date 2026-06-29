import Chart from "chart.js/auto";
import { TrendingDown, TrendingUp, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import ExpenseTemplates from "../ExpenseTemplates";
import apiClient from "../api/apiClient";
import { EXPENSE_CATEGORIES } from "../constants/categories";
import { formatCurrency } from "../utils/format";

const CHART_COLORS = [
  "#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#6366f1",
  "#14b8a6", "#eab308",
];

const TODAY = new Date().toISOString().split("T")[0];

const inputCls =
  "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400 dark:placeholder-slate-500";
const labelCls =
  "block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1";
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

const parseByType = (value, type) => {
  if (type === "number") return parseFloat(value) || 0;
  if (type === "date")   return new Date(value).getTime();
  return (value || "").toString().toLowerCase();
};

const sortByColumn = (list, col, type, order) =>
  [...list].sort((a, b) => {
    const av = parseByType(a[col], type);
    const bv = parseByType(b[col], type);
    if (av === bv) return 0;
    return order === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

export default function Dashboard() {
  const queryClient = useQueryClient();

  /* ── Data queries ─────────────────────────────────────────── */
  const { data: expenses = [], isPending: expensesLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => apiClient.get("/expenses").then((r) => r.data),
    refetchOnWindowFocus: false,
  });
  const { data: credits = [] } = useQuery({
    queryKey: ["credits"],
    queryFn: () => apiClient.get("/credits").then((r) => r.data),
    refetchOnWindowFocus: false,
  });

  /* ── Mutations ────────────────────────────────────────────── */
  const addExpenseMut = useMutation({
    mutationFn: (data) => apiClient.post("/expenses", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
    onError: () => toast.error("Could not add the expense. Please try again."),
  });
  const addCreditMut = useMutation({
    mutationFn: (data) => apiClient.post("/credits", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["credits"] }),
    onError: () => toast.error("Could not add the income entry. Please try again."),
  });
  const deleteExpenseMut = useMutation({
    mutationFn: (id) => apiClient.delete(`/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense deleted.");
    },
    onError: () => toast.error("Could not delete the expense."),
  });
  const deleteCreditMut = useMutation({
    mutationFn: (id) => apiClient.delete(`/credits/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      toast.success("Income entry deleted.");
    },
    onError: () => toast.error("Could not delete the income entry."),
  });
  const editMut = useMutation({
    mutationFn: ({ type, id, payload }) =>
      type === "expense"
        ? apiClient.put(`/expenses/${id}`, payload)
        : apiClient.put(`/credits/${id}`, payload),
    onSuccess: (_, { type }) => {
      queryClient.invalidateQueries({
        queryKey: [type === "expense" ? "expenses" : "credits"],
      });
      toast.success("Changes saved.");
    },
    onError: () => toast.error("Could not save changes."),
  });
  const uploadCsvMut = useMutation({
    mutationFn: (formData) =>
      apiClient.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      toast.success("CSV imported successfully.");
    },
    onError: () => toast.error("Could not import the CSV file. Please try again."),
  });

  /* ── UI state ─────────────────────────────────────────────── */
  const [showExpenses, setShowExpenses] = useState(false);
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

  const [expSort, setExpSort]   = useState({ col: null, type: null, ord: "asc" });
  const [credSort, setCredSort] = useState({ col: null, type: null, ord: "asc" });

  const [file, setFile]             = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editTarget, setEditTarget]     = useState(null);
  const [editName, setEditName]         = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editAmount, setEditAmount]     = useState("");
  const [editDate, setEditDate]         = useState("");

  const chartCanvasRef   = useRef(null);
  const chartInstanceRef = useRef(null);
  const fileInputRef     = useRef(null);

  /* ── Filtering + sorting ──────────────────────────────────── */
  const filterFn = (list) => {
    const q = filterName.trim().toLowerCase();
    return list.filter((r) => {
      const d = r.date?.slice(0, 10);
      return (
        (!q || r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)) &&
        (!startDate || d >= startDate) &&
        (!endDate   || d <= endDate)
      );
    });
  };

  const displayExpenses = useMemo(() => {
    const f = filterFn(expenses);
    return expSort.col ? sortByColumn(f, expSort.col, expSort.type, expSort.ord) : f;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, filterName, startDate, endDate, expSort]);

  const displayCredits = useMemo(() => {
    const f = filterFn(credits);
    return credSort.col ? sortByColumn(f, credSort.col, credSort.type, credSort.ord) : f;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credits, filterName, startDate, endDate, credSort]);

  const totalExpenses = useMemo(
    () => displayExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0),
    [displayExpenses]
  );
  const totalIncome = useMemo(
    () => displayCredits.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0),
    [displayCredits]
  );
  const balance = totalIncome - totalExpenses;

  /* ── Chart ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!isModalOpen) {
      chartInstanceRef.current?.destroy();
      chartInstanceRef.current = null;
      return;
    }
    if (!chartCanvasRef.current) return;

    const totals = {};
    displayExpenses.forEach((e) => {
      totals[e.category] = (totals[e.category] || 0) + (parseFloat(e.amount) || 0);
    });
    displayCredits.forEach((c) => {
      totals[c.category] = (totals[c.category] || 0) + (parseFloat(c.amount) || 0);
    });
    const labels = Object.keys(totals);
    const data = labels.map((l) => Math.round((totals[l] || 0) * 100) / 100);

    if (!labels.length) {
      chartInstanceRef.current?.destroy();
      chartInstanceRef.current = null;
      return;
    }

    // Update in place instead of destroy+recreate to avoid replaying the animation
    if (chartInstanceRef.current) {
      chartInstanceRef.current.data.labels = labels;
      chartInstanceRef.current.data.datasets[0].data = data;
      chartInstanceRef.current.update("none");
      return;
    }

    chartInstanceRef.current = new Chart(chartCanvasRef.current, {
      type: "doughnut",
      data: { labels, datasets: [{ data, backgroundColor: CHART_COLORS }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          datalabels: { display: false },
          legend: { position: "bottom" },
          tooltip: {
            callbacks: { label: (c) => `${c.label}: ${formatCurrency(c.raw)}` },
          },
        },
      },
    });

    return () => {
      chartInstanceRef.current?.destroy();
      chartInstanceRef.current = null;
    };
  }, [displayCredits, displayExpenses, isModalOpen]);

  /* ── Handlers ─────────────────────────────────────────────── */
  const handleAddExpense = () => {
    if (!name || !amount || !date || !category) {
      toast.error("Please fill in all expense fields.");
      return;
    }
    addExpenseMut.mutate(
      { name, amount, date, category },
      {
        onSuccess: () => {
          setName(""); setAmount(""); setDate(""); setCategory("");
          setShowExpenses(true);
          toast.success("Expense added.");
        },
      }
    );
  };

  const addExpenseFromTemplate = (template) => {
    addExpenseMut.mutate(template, {
      onSuccess: () => {
        setShowExpenses(true);
        toast.success(`Added ${template.name} (${formatCurrency(template.amount)})`);
      },
    });
  };

  const handleAddCredit = () => {
    if (!creditName || !creditAmount || !creditDate || !creditCategory) {
      toast.error("Please fill in all income fields.");
      return;
    }
    addCreditMut.mutate(
      { name: creditName, amount: creditAmount, date: creditDate, category: creditCategory },
      {
        onSuccess: () => {
          setCreditName(""); setCreditAmount(""); setCreditDate(TODAY); setCreditCategory("");
          setShowExpenses(true);
          toast.success("Income entry added.");
        },
      }
    );
  };

  const deleteExpense = (id) => {
    if (!window.confirm("Delete this expense?")) return;
    deleteExpenseMut.mutate(id);
  };
  const deleteCredit = (id) => {
    if (!window.confirm("Delete this income entry?")) return;
    deleteCreditMut.mutate(id);
  };

  const openEdit = (record, type) => {
    setEditTarget({ type, record });
    setEditName(record.name || "");
    setEditCategory(record.category || "");
    setEditAmount(String(record.amount || ""));
    setEditDate(record.date?.slice(0, 10) || "");
  };
  const closeEdit = () => {
    setEditTarget(null);
    setEditName(""); setEditCategory(""); setEditAmount(""); setEditDate("");
  };
  const saveEdit = () => {
    if (!editTarget) return;
    const { type, record } = editTarget;
    const payload = {};
    if (editName     && editName     !== record.name)                  payload.name     = editName;
    if (editCategory && editCategory !== record.category)              payload.category = editCategory;
    if (editAmount   && String(editAmount) !== String(record.amount))  payload.amount   = editAmount;
    if (editDate     && editDate     !== record.date?.slice(0, 10))    payload.date     = editDate;
    if (!Object.keys(payload).length) { closeEdit(); return; }
    editMut.mutate({ type, id: record.id, payload }, { onSuccess: closeEdit, onError: closeEdit });
  };

  const handleSortExp = (col, type) => {
    const ord = expSort.col === col && expSort.ord === "asc" ? "desc" : "asc";
    setExpSort({ col, type, ord });
  };
  const handleSortCred = (col, type) => {
    const ord = credSort.col === col && credSort.ord === "asc" ? "desc" : "asc";
    setCredSort({ col, type, ord });
  };
  const expSortIcon  = (col) => expSort.col  === col ? <span className="sort-icon">{expSort.ord  === "asc" ? "↑" : "↓"}</span> : null;
  const credSortIcon = (col) => credSort.col === col ? <span className="sort-icon">{credSort.ord === "asc" ? "↑" : "↓"}</span> : null;

  const resetFilters = () => {
    setFilterName(""); setStartDate(""); setEndDate("");
    setShowExpenses(false);
    setExpSort({ col: null, type: null, ord: "asc" });
    setCredSort({ col: null, type: null, ord: "asc" });
  };

  const uploadCSV = () => {
    if (!file) { toast.error("Please select a CSV file to upload."); return; }
    const formData = new FormData();
    formData.append("file", file);
    uploadCsvMut.mutate(formData, {
      onSuccess: () => {
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setShowExpenses(true);
      },
    });
  };

  /* ── JSX ──────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={cardCls + " p-5"}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Total Expenses
            </p>
            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(totalExpenses)}
          </p>
        </div>

        <div className={cardCls + " p-5"}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Total Income
            </p>
            <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(totalIncome)}
          </p>
        </div>

        <div
          className={
            cardCls +
            " p-5 " +
            (balance >= 0 ? "border-l-4 border-l-green-500" : "border-l-4 border-l-red-500")
          }
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Balance
            </p>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                balance >= 0 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"
              }`}
            >
              <Wallet
                className={`w-4 h-4 ${balance >= 0 ? "text-green-500" : "text-red-500"}`}
              />
            </div>
          </div>
          <p
            className={`text-2xl font-bold ${
              balance >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {formatCurrency(balance)}
          </p>
        </div>
      </div>

      {/* Add forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={cardCls + " p-6"}>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
            Add Expense
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Expense Name</label>
              <input type="text" className={inputCls} placeholder="e.g. Groceries"
                value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Amount</label>
              <input type="number" className={inputCls} placeholder="0.00" step="0.01" min="0"
                value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" className={inputCls} value={date} max={TODAY}
                onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Category</label>
              <select className={inputCls} value={category}
                onChange={(e) => setCategory(e.target.value)}>
                <option value="">Select a category</option>
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button className={btnPrimary} onClick={handleAddExpense}
              disabled={addExpenseMut.isPending}>
              Add Expense
            </button>
          </div>
        </div>

        <div className={cardCls + " p-6"}>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
            Add Income
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Income Source</label>
              <input type="text" className={inputCls} placeholder="e.g. Salary"
                value={creditName} onChange={(e) => setCreditName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Amount</label>
              <input type="number" className={inputCls} placeholder="0.00" step="0.01" min="0"
                value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" className={inputCls} value={creditDate} max={TODAY}
                onChange={(e) => setCreditDate(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Category</label>
              <select className={inputCls} value={creditCategory}
                onChange={(e) => setCreditCategory(e.target.value)}>
                <option value="">Select a category</option>
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button className={btnSecondary} onClick={handleAddCredit}
              disabled={addCreditMut.isPending}>
              Add Income
            </button>
          </div>
        </div>
      </div>

      {/* Templates */}
      <ExpenseTemplates
        onAddExpense={addExpenseFromTemplate}
        categories={EXPENSE_CATEGORIES}
      />

      {/* Filters */}
      <div className={cardCls + " p-6"}>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Filters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Search</label>
            <input type="text" className={inputCls} placeholder="Name or category"
              value={filterName} onChange={(e) => setFilterName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Start Date</label>
            <input type="date" className={inputCls} value={startDate} max={TODAY}
              onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>End Date</label>
            <input type="date" className={inputCls} value={endDate} max={TODAY}
              onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button className={btnPrimary} onClick={() => setShowExpenses(true)}>
            Apply Filters
          </button>
          <button className={btnSecondary} onClick={resetFilters}>Reset</button>
          <button className={btnSecondary} onClick={() => setShowExpenses((p) => !p)}>
            {showExpenses ? "Hide Tables" : "Show Tables"}
          </button>
          <button
            className={btnSecondary + " ml-auto"}
            disabled={!displayExpenses.length && !displayCredits.length}
            onClick={() => setIsModalOpen(true)}
          >
            Category Breakdown
          </button>
        </div>
      </div>

      {/* Import CSV */}
      <div className={cardCls + " p-6"}>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
          Import Transactions
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="flex-1 text-sm text-slate-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 dark:file:bg-slate-700 dark:file:text-slate-200 hover:file:bg-slate-200 dark:hover:file:bg-slate-600 cursor-pointer"
          />
          <button className={btnSecondary} onClick={uploadCSV}
            disabled={uploadCsvMut.isPending}>
            Upload CSV
          </button>
        </div>
      </div>

      {/* Transaction tables */}
      {showExpenses && (
        <div className="space-y-4">
          {expensesLoading ? (
            <p className="text-center text-slate-400 py-8 text-sm">Loading transactions…</p>
          ) : (
            <>
              {/* Expenses */}
              <div className={cardCls + " overflow-hidden"}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Expenses</h2>
                  <span className="text-xs text-slate-400">
                    {displayExpenses.length} item{displayExpenses.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400 cursor-pointer select-none"
                          onClick={() => handleSortExp("name", "string")}>
                          Name {expSortIcon("name")}
                        </th>
                        <th className="text-right py-3 px-4 font-medium text-slate-500 dark:text-slate-400 cursor-pointer select-none"
                          onClick={() => handleSortExp("amount", "number")}>
                          Amount {expSortIcon("amount")}
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400 cursor-pointer select-none"
                          onClick={() => handleSortExp("date", "date")}>
                          Date {expSortIcon("date")}
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">
                          Category
                        </th>
                        <th className="py-3 px-4" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {displayExpenses.map((exp) => (
                        <tr key={exp.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">
                            {exp.name}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-200 tabular-nums">
                            {formatCurrency(exp.amount)}
                          </td>
                          <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {new Date(exp.date).toLocaleDateString(undefined, {
                              year: "numeric", month: "short", day: "numeric",
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <span className="category-badge">{exp.category}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1 justify-end">
                              <button className={btnGhost} onClick={() => openEdit(exp, "expense")}>
                                Edit
                              </button>
                              <button className={btnDanger} onClick={() => deleteExpense(exp.id)}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!displayExpenses.length && (
                    <p className="text-center text-slate-400 py-8 text-sm">No expenses to show.</p>
                  )}
                </div>
              </div>

              {/* Income */}
              <div className={cardCls + " overflow-hidden"}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Income</h2>
                  <span className="text-xs text-slate-400">
                    {displayCredits.length} item{displayCredits.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400 cursor-pointer select-none"
                          onClick={() => handleSortCred("name", "string")}>
                          Source {credSortIcon("name")}
                        </th>
                        <th className="text-right py-3 px-4 font-medium text-slate-500 dark:text-slate-400 cursor-pointer select-none"
                          onClick={() => handleSortCred("amount", "number")}>
                          Amount {credSortIcon("amount")}
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400 cursor-pointer select-none"
                          onClick={() => handleSortCred("date", "date")}>
                          Date {credSortIcon("date")}
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">
                          Category
                        </th>
                        <th className="py-3 px-4" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {displayCredits.map((credit) => (
                        <tr key={credit.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">
                            {credit.name}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-200 tabular-nums">
                            {formatCurrency(credit.amount)}
                          </td>
                          <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {new Date(credit.date).toLocaleDateString(undefined, {
                              year: "numeric", month: "short", day: "numeric",
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <span className="category-badge">{credit.category}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1 justify-end">
                              <button className={btnGhost} onClick={() => openEdit(credit, "credit")}>
                                Edit
                              </button>
                              <button className={btnDanger} onClick={() => deleteCredit(credit.id)}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!displayCredits.length && (
                    <p className="text-center text-slate-400 py-8 text-sm">
                      No income entries to show.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Chart modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Spending by Category
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              {displayExpenses.length || displayCredits.length ? (
                <div className="relative h-72">
                  <canvas ref={chartCanvasRef} />
                </div>
              ) : (
                <p className="text-center text-slate-400 text-sm py-16">
                  Add transactions to view the breakdown.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60"
          onClick={closeEdit}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Edit {editTarget.type === "expense" ? "Expense" : "Income"}
              </h3>
              <button
                onClick={closeEdit}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div>
                <label className={labelCls}>Name</label>
                <input type="text" className={inputCls} value={editName}
                  onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Amount</label>
                  <input type="number" step="0.01" min="0" className={inputCls}
                    value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Date</label>
                  <input type="date" className={inputCls} value={editDate} max={TODAY}
                    onChange={(e) => setEditDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <select className={inputCls} value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}>
                  <option value="">Select a category</option>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 px-6 pb-5">
              <button className={btnPrimary} onClick={saveEdit}
                disabled={editMut.isPending}>
                Save Changes
              </button>
              <button className={btnSecondary} onClick={closeEdit}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
