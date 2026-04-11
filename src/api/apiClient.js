import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api",
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hadToken = !!(localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token"));
      localStorage.removeItem("auth_token");
      sessionStorage.removeItem("auth_token");
      // Only reload if a token existed but was rejected (expired/invalid).
      // If there was no token, 401 is expected — don't trigger a reload loop.
      if (hadToken) {
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
