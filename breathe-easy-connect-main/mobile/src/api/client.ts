import axios from "axios";
import { storage } from "../utils/storage";

import {
  getActiveApiUrl,
  setCustomApiUrl,
  resetCustomApiUrl,
  PRODUCTION_API_URL,
  API_BASE_URL,
  getHealthEndpoint,
} from "../config";

// Backward-compatible exports
export {
  getActiveApiUrl,
  setCustomApiUrl,
  resetCustomApiUrl,
  PRODUCTION_API_URL,
  API_BASE_URL,
  getHealthEndpoint,
};
export const DEFAULT_API_URL = PRODUCTION_API_URL;


export const apiClient = axios.create({
  baseURL: getActiveApiUrl(),
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 12000,
});

apiClient.interceptors.request.use(
  async (config) => {
    config.baseURL = getActiveApiUrl();
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
          const res = await axios.post(`${getActiveApiUrl()}/auth/refresh`, { refreshToken });
          if (res.data.accessToken) {
            await storage.setItem("accessToken", res.data.accessToken);
            apiClient.defaults.headers.common.Authorization = `Bearer ${res.data.accessToken}`;
            originalRequest.headers.Authorization = `Bearer ${res.data.accessToken}`;
            return apiClient(originalRequest);
          }
        }
      } catch (_err) {
        await storage.removeItem("accessToken");
        await storage.removeItem("refreshToken");
      }
    }
    return Promise.reject(error);
  },
);

/**
 * Executes an API call with exponential backoff retry for network errors or 5xx server failures.
 */
export async function fetchWithBackoffRetry<T>(
  apiFn: () => Promise<T>,
  retries = 2,
  delayMs = 1000,
): Promise<T> {
  try {
    return await apiFn();
  } catch (err: any) {
    const isNetworkOrServerError = !err.response || (err.response.status >= 500 && err.response.status < 600);
    if (retries > 0 && isNetworkOrServerError) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return fetchWithBackoffRetry(apiFn, retries - 1, delayMs * 2);
    }
    throw err;
  }
}
