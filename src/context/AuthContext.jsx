import { createContext, useContext, useState } from "react";
import { toast } from "react-hot-toast";
import apiClient from "../api/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!(localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token"))
  );
  const [authMode, setAuthMode]         = useState("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authRepeat, setAuthRepeat]     = useState("");
  const [rememberMe, setRememberMe]     = useState(true);
  const [authBusy, setAuthBusy]         = useState(false);

  // Forgot-password flow
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent]   = useState(false);

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
        const { data } = await apiClient.post("/auth/register", {
          username: authUsername,
          password: authPassword,
        });
        storeToken(data.token);
        setIsAuthenticated(true);
      } else {
        const { data } = await apiClient.post("/auth/login", {
          username: authUsername,
          password: authPassword,
        });
        storeToken(data.token);
        setIsAuthenticated(true);
      }
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
          "Authentication failed. Check your connection and try again."
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch (_) {
      // Always clear local state even if the server call fails
    } finally {
      localStorage.removeItem("auth_token");
      sessionStorage.removeItem("auth_token");
      setIsAuthenticated(false);
      setAuthUsername("");
      setAuthPassword("");
      setAuthRepeat("");
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setAuthBusy(true);
    try {
      await apiClient.post("/auth/forgot-password", { email: forgotEmail });
    } catch (_) {
      // Show success regardless to prevent email enumeration
    } finally {
      setForgotSent(true);
      setAuthBusy(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        authMode, setAuthMode,
        authUsername, setAuthUsername,
        authPassword, setAuthPassword,
        authRepeat, setAuthRepeat,
        rememberMe, setRememberMe,
        authBusy,
        handleAuthSubmit,
        handleLogout,
        forgotEmail, setForgotEmail,
        forgotSent, setForgotSent,
        handleForgotSubmit,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
