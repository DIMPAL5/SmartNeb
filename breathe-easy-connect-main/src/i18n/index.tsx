import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { en_common } from "./locales/en/common";
import { en_auth } from "./locales/en/auth";
import { en_patient } from "./locales/en/patient";
import { en_doctor } from "./locales/en/doctor";
import { en_caregiver } from "./locales/en/caregiver";
import { en_admin } from "./locales/en/admin";

import { hi_common } from "./locales/hi/common";
import { hi_auth } from "./locales/hi/auth";
import { hi_patient } from "./locales/hi/patient";
import { hi_doctor } from "./locales/hi/doctor";
import { hi_caregiver } from "./locales/hi/caregiver";
import { hi_admin } from "./locales/hi/admin";

import { kn_common } from "./locales/kn/common";
import { kn_auth } from "./locales/kn/auth";
import { kn_patient } from "./locales/kn/patient";
import { kn_doctor } from "./locales/kn/doctor";
import { kn_caregiver } from "./locales/kn/caregiver";
import { kn_admin } from "./locales/kn/admin";

export const LANGUAGES = ["en", "hi", "kn"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  hi: "हिंदी",
  kn: "ಕನ್ನಡ",
};

type Dict = Record<string, string>;

const DICTIONARIES: Record<Language, Dict> = {
  en: { ...en_common, ...en_auth, ...en_patient, ...en_doctor, ...en_caregiver, ...en_admin },
  hi: { ...hi_common, ...hi_auth, ...hi_patient, ...hi_doctor, ...hi_caregiver, ...hi_admin },
  kn: { ...kn_common, ...kn_auth, ...kn_patient, ...kn_doctor, ...kn_caregiver, ...kn_admin },
};

const STORAGE_KEY = "smartneb.language";

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

function humanize(key: string) {
  const last = key.split(".").pop() ?? key;
  const spaced = last.replace(/[_-]/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function translate(
  language: Language,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const value = DICTIONARIES[language]?.[key] ?? DICTIONARIES.en[key];
  if (typeof value === "string") return interpolate(value, vars);
  if (import.meta.env.DEV) console.warn(`[i18n] missing translation key: ${key}`);
  return interpolate(humanize(key), vars);
}

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: TFunction;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    /* storage unavailable */
  }
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  // Hydrate from local storage after mount so SSR markup stays stable.
  useEffect(() => {
    const stored = readStoredLanguage();
    if (stored !== "en") setLanguageState(stored);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const t = useCallback<TFunction>((key, vars) => translate(language, key, vars), [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (ctx) return ctx;
  // Safe fallback if a component renders outside the provider.
  return {
    language: "en",
    setLanguage: () => undefined,
    t: (key, vars) => translate("en", key, vars),
  };
}

export function useT(): TFunction {
  return useLanguage().t;
}
