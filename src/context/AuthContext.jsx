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

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    sessionStorage.removeItem("auth_token");
    setIsAuthenticated(false);
    setAuthUsername("");
    setAuthPassword("");
    setAuthRepeat("");
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
