import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import { Wallet } from "lucide-react";
import apiClient from "../api/apiClient";

const inputCls =
  "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400 dark:placeholder-slate-500";
const labelCls =
  "block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1";
const btnPrimary =
  "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [busy, setBusy]           = useState(false);
  const [done, setDone]           = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await apiClient.post("/auth/reset-password", { token, password });
      setDone(true);
      toast.success("Password updated! Redirecting to sign in…");
      setTimeout(() => navigate("/"), 2500);
    } catch (err) {
      toast.error(
        err.response?.data?.error || "Reset failed. The link may have expired."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "text-sm font-medium",
          style: { borderRadius: "10px", padding: "12px 16px" },
        }}
      />

      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700">
        <div className="px-6 pt-8 pb-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {done ? "Password updated" : "Set new password"}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {done
              ? "You'll be redirected to sign in shortly."
              : token
              ? "Choose a new password for your account."
              : "This reset link is invalid or has expired."}
          </p>
        </div>

        {!token || done ? (
          <div className="px-6 py-5 text-center">
            <button
              className={btnPrimary + " w-full justify-center py-2.5"}
              onClick={() => navigate("/")}
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3">
            <div>
              <label className={labelCls}>New Password</label>
              <input
                type="password"
                className={inputCls}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label className={labelCls}>Confirm Password</label>
              <input
                type="password"
                className={inputCls}
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <button
              type="submit"
              className={btnPrimary + " w-full justify-center py-2.5 mt-1"}
              disabled={busy}
            >
              {busy ? "Updating…" : "Reset Password"}
            </button>
          </form>
        )}

        <div className="px-6 pb-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <button
            className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
            onClick={() => navigate("/")}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
