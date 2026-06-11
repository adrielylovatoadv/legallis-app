"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "dark" | "light" | "auto";

interface ThemeCtx {
  theme: ThemeMode;
  effectiveTheme: "dark" | "light";
  setTheme: (t: ThemeMode) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({
  theme: "dark",
  effectiveTheme: "dark",
  setTheme: () => {},
  toggle: () => {},
});

function getSystemPreference(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyEffective(eff: "dark" | "light") {
  if (eff === "light") {
    document.documentElement.classList.add("light");
  } else {
    document.documentElement.classList.remove("light");
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [effectiveTheme, setEffectiveTheme] = useState<"dark" | "light">("dark");

  function applyMode(t: ThemeMode) {
    const eff = t === "auto" ? getSystemPreference() : t;
    setThemeState(t);
    setEffectiveTheme(eff);
    applyEffective(eff);
    localStorage.setItem("legallis-theme", t);
  }

  useEffect(() => {
    const saved = (localStorage.getItem("legallis-theme") as ThemeMode) ?? "dark";
    applyMode(saved);

    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => {
      const current = (localStorage.getItem("legallis-theme") as ThemeMode) ?? "dark";
      if (current === "auto") {
        const eff = mq.matches ? "light" : "dark";
        setEffectiveTheme(eff);
        applyEffective(eff);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = (t: ThemeMode) => applyMode(t);
  const toggle = () => applyMode(theme === "dark" ? "light" : "dark");

  return (
    <Ctx.Provider value={{ theme, effectiveTheme, setTheme, toggle }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
