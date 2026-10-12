import { storage } from "../utils/storage";

/**
 * Centralized API & Environment Configuration for SmartNeb Mobile
 *
 * Handles:
 * - Environment detection (Production, Preview, Development)
 * - Safe cloud production default (Permanent live cloud backend)
 * - Environment variable overrides (EXPO_PUBLIC_API_URL / EXPO_PUBLIC_DEV_API_URL)
 * - User runtime overrides via AsyncStorage ("customApiUrl")
 * - Sanitization, validation, and health endpoint resolution
 */

export const STORAGE_KEY_CUSTOM_API_URL = "customApiUrl";

// Live active backend HTTPS endpoint (Works immediately out-of-the-box on every phone)
export const LIVE_BACKEND_API_URL = "https://fitted-countries-calculate-travesti.trycloudflare.com/api/v1";

// Permanent Render Cloud Blueprint endpoint
export const RENDER_PRODUCTION_API_URL = "https://smartneb-backend-api.onrender.com/api/v1";

// Permanent Railway Cloud deployment endpoint
export const RAILWAY_PRODUCTION_API_URL = "https://smartneb-backend-api.up.railway.app/api/v1";

// Default Production Target
export const PRODUCTION_API_URL = LIVE_BACKEND_API_URL;
export const DEVELOPMENT_DEFAULT_API_URL = LIVE_BACKEND_API_URL;
export const API_BASE_URL = LIVE_BACKEND_API_URL;

/**
 * Detects whether the current bundle is a production release build.
 */
export const isProductionEnvironment = (): boolean => {
  const nodeEnv = process.env.NODE_ENV;
  const easProfile = process.env.EAS_BUILD_PROFILE;
  return easProfile === "production" || (!__DEV__ && nodeEnv === "production");
};

/**
 * Gets the current build environment name.
 */
export const getEnvironmentName = (): "production" | "preview" | "development" => {
  const easProfile = process.env.EAS_BUILD_PROFILE;
  if (easProfile === "production") return "production";
  if (easProfile === "preview") return "preview";
  if (isProductionEnvironment()) return "production";
  return "development";
};

/**
 * Returns the default API URL based on build profile and environment variables.
 */
export const getDefaultApiUrl = (): string => {
  let envUrl: string | undefined;
  try {
    envUrl = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_DEV_API_URL;
  } catch {
    envUrl = undefined;
  }

  if (envUrl && typeof envUrl === "string" && envUrl.trim().length > 0) {
    return formatApiUrl(envUrl.trim());
  }

  return PRODUCTION_API_URL;
};

/**
 * Sanitizes and normalizes an API URL to ensure valid protocol and standard "/api/v1" path.
 */
export const formatApiUrl = (url: string): string => {
  if (!url) return "";
  let formatted = url.trim();

  // Strip trailing slashes
  while (formatted.endsWith("/")) {
    formatted = formatted.slice(0, -1);
  }

  // Auto-append protocol if omitted
  if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
    formatted = `http://${formatted}`;
  }

  // Ensure /api/v1 endpoint suffix
  if (!formatted.endsWith("/api/v1")) {
    formatted = `${formatted}/api/v1`;
  }

  return formatted;
};

/**
 * Validates whether a given URL string is a syntactically valid HTTP/HTTPS endpoint.
 */
export const isValidApiUrl = (url: string): boolean => {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `http://${trimmed}`);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Computes the health-check probe URL for a given API base URL.
 * Supports both /api/v1/health and root /health.
 */
export const getHealthEndpoint = (baseUrl?: string): string => {
  const target = baseUrl ? formatApiUrl(baseUrl) : getActiveApiUrl();
  return `${target}/health`;
};

// In-memory cached active URL initialized from environment default
let activeApiUrl: string = getDefaultApiUrl();

// Asynchronously load any persisted user override from AsyncStorage
export const initApiConfig = async (): Promise<string> => {
  try {
    const saved = await storage.getItem(STORAGE_KEY_CUSTOM_API_URL);
    if (saved && saved.trim()) {
      activeApiUrl = formatApiUrl(saved.trim());
    } else {
      activeApiUrl = getDefaultApiUrl();
    }
  } catch {
    activeApiUrl = getDefaultApiUrl();
  }
  return activeApiUrl;
};

// Initialize immediately on module load
initApiConfig().catch(() => {});

/**
 * Returns the currently active API base URL.
 */
export const getActiveApiUrl = (): string => {
  return activeApiUrl;
};

/**
 * Sets and persists a user custom API URL override.
 */
export const setCustomApiUrl = async (url: string): Promise<string> => {
  const formatted = formatApiUrl(url);
  activeApiUrl = formatted;
  await storage.setItem(STORAGE_KEY_CUSTOM_API_URL, formatted);
  return formatted;
};

/**
 * Resets the active API URL back to the default cloud/environment URL and removes the override.
 */
export const resetCustomApiUrl = async (): Promise<string> => {
  await storage.removeItem(STORAGE_KEY_CUSTOM_API_URL);
  activeApiUrl = getDefaultApiUrl();
  return activeApiUrl;
};
