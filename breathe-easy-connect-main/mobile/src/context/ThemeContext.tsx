import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { storage } from '../utils/storage';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  activeColorMode: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setTheme] = useState<ThemeMode>('system');

  useEffect(() => {
    storage.getItem('themeMode').then((stored) => {
      if (stored && ['light', 'dark', 'system'].includes(stored)) {
        setTheme(stored as ThemeMode);
      }
    });
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setTheme(mode);
    storage.setItem('themeMode', mode);
  };

  const activeColorMode = theme === 'system' ? (systemColorScheme || 'dark') : theme;

  return (
    <ThemeContext.Provider value={{ theme, activeColorMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
