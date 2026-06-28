import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api",
  timeout: 10000,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;
const failedQueue = [];

function drainQueue(error, token) {
  failedQueue.splice(0).forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token)
  );
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    const isAuthEndpoint =
      original.url?.endsWith("/auth/refresh") ||
      original.url?.endsWith("/auth/login") ||
      original.url?.endsWith("/auth/register");

    if (error.response?.status !== 401 || original._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    // If a refresh is already in flight, queue this request
    if (refreshPromise) {
      return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
        .then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          original._retry = true;
          return apiClient(original);
        });
    }

    original._retry = true;
    const inLocal = localStorage.getItem("auth_token") !== null;

    refreshPromise = apiClient
      .post("/auth/refresh")
      .then(({ data }) => {
        const { token } = data;
        if (inLocal) {
          localStorage.setItem("auth_token", token);
        } else {
          sessionStorage.setItem("auth_token", token);
        }
        drainQueue(null, token);
        return token;
      })
      .catch((err) => {
        drainQueue(err, null);
        localStorage.removeItem("auth_token");
        sessionStorage.removeItem("auth_token");
        window.location.reload();
        return Promise.reject(err);
      })
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise.then((token) => {
      original.headers.Authorization = `Bearer ${token}`;
      return apiClient(original);
    });
  }
);

export default apiClient;
