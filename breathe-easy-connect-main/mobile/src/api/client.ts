import axios from "axios";
import { storage } from "../utils/storage";

// Base API URL pointing to Hosted Production Backend or local dev environment
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000/api/v1"
    : "http://localhost:5000/api/v1");

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await storage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await storage.getItem("refreshToken");
        if (refreshToken) {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          if (res.data.accessToken) {
            await storage.setItem("accessToken", res.data.accessToken);
            apiClient.defaults.headers.common.Authorization = `Bearer ${res.data.accessToken}`;
            originalRequest.headers.Authorization = `Bearer ${res.data.accessToken}`;
            return apiClient(originalRequest);
          }
        }
      } catch (err) {
        await storage.removeItem("accessToken");
        await storage.removeItem("refreshToken");
      }
    }
    return Promise.reject(error);
  },
);
