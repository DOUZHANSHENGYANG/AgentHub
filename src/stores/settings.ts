import { create } from "zustand";
import { emit } from "@tauri-apps/api/event";
import { api } from "@/lib/api";
import type { SettingsInfo } from "@/lib/types";

export type Theme = "light" | "dark";
export type Lang = "zh" | "en";

export function applyThemeDom(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("agenthub.theme", theme);
  } catch {
    /* ignore */
  }
}

interface SettingsState {
  ready: boolean;
  theme: Theme;
  language: Lang;
  info: SettingsInfo | null;
  boot: () => Promise<void>;
  refresh: () => Promise<void>;
  /** theme switch with radial expand (light→dark) / collapse (dark→light) */
  setTheme: (next: Theme, origin?: { x: number; y: number }) => Promise<void>;
  setLanguage: (lang: Lang) => Promise<void>;
  setDataDir: (path: string) => Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  ready: false,
  theme: "dark",
  language: "zh",
  info: null,

  boot: async () => {
    try {
      const info = await api.getSettings();
      const theme = (info.settings.theme === "light" ? "light" : "dark") as Theme;
      const lang = (info.settings.language === "en" ? "en" : "zh") as Lang;
      applyThemeDom(theme);
      try {
        localStorage.setItem("agenthub.lang", lang);
      } catch {
        /* ignore */
      }
      const { default: i18n } = await import("@/i18n");
      if (i18n.language !== lang) await i18n.changeLanguage(lang);
      set({ info, theme, language: lang, ready: true });
    } catch {
      applyThemeDom("dark");
      set({ ready: true });
    }
  },

  refresh: async () => {
    try {
      const info = await api.getSettings();
      set({ info });
    } catch {
      /* ignore */
    }
  },

  setTheme: async (next, origin) => {
    const cur = get().theme;
    if (cur === next) return;
    set({ theme: next });
    api.setPrefs(undefined, next).catch(() => undefined);
    void emit("agenthub:theme", next).catch(() => undefined);

    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> };
    };

    if (reduce || typeof doc.startViewTransition !== "function") {
      applyThemeDom(next);
      return;
    }

    if (origin) {
      const radius = Math.hypot(
        Math.max(origin.x, window.innerWidth - origin.x),
        Math.max(origin.y, window.innerHeight - origin.y),
      );
      root.style.setProperty("--vt-x", `${origin.x}px`);
      root.style.setProperty("--vt-y", `${origin.y}px`);
      root.style.setProperty("--vt-r", `${Math.ceil(radius)}px`);
    } else {
      root.style.setProperty("--vt-x", "50%");
      root.style.setProperty("--vt-y", "50%");
      root.style.setProperty("--vt-r", "150%");
    }

    // 明→暗：新（暗）从点击点扩散；暗→明：旧（暗）收拢回点击点
    root.dataset.vt = next === "dark" ? "expand" : "collapse";
    try {
      const vt = doc.startViewTransition(() => applyThemeDom(next));
      await vt.finished;
    } catch {
      applyThemeDom(next);
    } finally {
      delete root.dataset.vt;
    }
  },

  setLanguage: async (lang) => {
    set({ language: lang });
    try {
      localStorage.setItem("agenthub.lang", lang);
    } catch {
      /* ignore */
    }
    const { default: i18n } = await import("@/i18n");
    await i18n.changeLanguage(lang);
    api.setPrefs(lang, undefined).catch(() => undefined);
    void emit("agenthub:lang", lang).catch(() => undefined);
  },

  setDataDir: async (path) => {
    const info = await api.setDataDir(path);
    set({ info });
    void emit("agenthub:data-changed").catch(() => undefined);
  },
}));
