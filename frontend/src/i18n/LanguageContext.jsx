import { createContext, useContext, useState, useCallback, useEffect } from "react";
import en from "./en";
import km from "./km";

const translations = { en, km };

const LanguageContext = createContext();

/* helper – read stored language, default "en" */
const stored = () => {
  try {
    const s = JSON.parse(localStorage.getItem("settings") || "{}");
    return s.language || "en";
  } catch {
    return "en";
  }
};

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(stored);

  /* sync data-lang attribute on <html> so CSS can switch fonts */
  useEffect(() => {
    document.documentElement.setAttribute("data-lang", lang);
  }, [lang]);

  /* listen for settings-change events from Settings page */
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.key === "language") setLang(e.detail.value);
    };
    window.addEventListener("settings-change", handler);
    return () => window.removeEventListener("settings-change", handler);
  }, []);

  /* t("key") → translated string, falls back to English, then to raw key */
  const t = useCallback(
    (key) => translations[lang]?.[key] ?? translations.en?.[key] ?? key,
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
