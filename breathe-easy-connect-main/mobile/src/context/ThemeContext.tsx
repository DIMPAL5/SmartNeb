import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useColorScheme } from "react-native";
import { storage } from "../utils/storage";

export type ThemeMode = "light" | "dark" | "system";

export interface ColorPalette {
  background: string;
  surface: string;
  card: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryHover: string;
  primaryLight: string;
  accent: string;
  border: string;
  inputBg: string;
  inputBorder: string;
  success: string;
  danger: string;
  warning: string;
  sidebarBg: string;
  sidebarBorder: string;
  headerBg: string;
  headerText: string;
  tabBarBg: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
  isDark: boolean;
}

export const darkPalette: ColorPalette = {
  background: "#0b132b",
  surface: "#111c3a",
  card: "#1e293b",
  cardBorder: "#334155",
  text: "#f8fafc",
  textSecondary: "#cbd5e1",
  textMuted: "#94a3b8",
  primary: "#16a34a", // SmartNeb green
  primaryHover: "#15803d",
  primaryLight: "#4ade80",
  accent: "#0284c7",
  border: "#334155",
  inputBg: "#0f172a",
  inputBorder: "#334155",
  success: "#22c55e",
  danger: "#ef4444",
  warning: "#f59e0b",
  sidebarBg: "#0f172a",
  sidebarBorder: "#1e293b",
  headerBg: "#0f172a",
  headerText: "#f8fafc",
  tabBarBg: "#0f172a",
  tabBarBorder: "#1e293b",
  tabBarActive: "#16a34a",
  tabBarInactive: "#64748b",
  isDark: true,
};

export const lightPalette: ColorPalette = {
  background: "#f8fafc",
  surface: "#ffffff",
  card: "#ffffff",
  cardBorder: "#e2e8f0",
  text: "#0f172a",
  textSecondary: "#334155",
  textMuted: "#64748b",
  primary: "#16a34a", // SmartNeb green
  primaryHover: "#15803d",
  primaryLight: "#22c55e",
  accent: "#0284c7",
  border: "#e2e8f0",
  inputBg: "#f1f5f9",
  inputBorder: "#cbd5e1",
  success: "#16a34a",
  danger: "#dc2626",
  warning: "#d97706",
  sidebarBg: "#ffffff",
  sidebarBorder: "#e2e8f0",
  headerBg: "#ffffff",
  headerText: "#0f172a",
  tabBarBg: "#ffffff",
  tabBarBorder: "#e2e8f0",
  tabBarActive: "#16a34a",
  tabBarInactive: "#94a3b8",
  isDark: false,
};

interface ThemeContextType {
  theme: ThemeMode;
  activeColorMode: "light" | "dark";
  isDark: boolean;
  colors: ColorPalette;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  activeColorMode: "dark",
  isDark: true,
  colors: darkPalette,
  setThemeMode: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    storage.getItem("themeMode").then((stored) => {
      if (stored && ["light", "dark", "system"].includes(stored)) {
        setTheme(stored as ThemeMode);
      }
    });
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setTheme(mode);
    storage.setItem("themeMode", mode);
  };

  const isDark = useMemo(() => {
    if (theme === "system") {
      return systemColorScheme === "dark";
    }
    return theme === "dark";
  }, [theme, systemColorScheme]);

  const activeColorMode: "light" | "dark" = isDark ? "dark" : "light";
  const colors = isDark ? darkPalette : lightPalette;

  return (
    <ThemeContext.Provider value={{ theme, activeColorMode, isDark, colors, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
