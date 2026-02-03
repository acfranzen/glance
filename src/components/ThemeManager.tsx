"use client";

import { useEffect, useCallback } from "react";
import { useTheme } from "next-themes";

interface CustomTheme {
  name: string;
  lightCss: string;
  darkCss: string;
  createdAt: string;
  updatedAt: string;
}

const THEME_STYLE_ID = "custom-theme-styles";

export function useCustomTheme() {
  const { resolvedTheme } = useTheme();

  const applyTheme = useCallback(
    (theme: CustomTheme | null, currentTheme?: string) => {
      // Remove existing custom theme style
      const existingStyle = document.getElementById(THEME_STYLE_ID);
      if (existingStyle) {
        existingStyle.remove();
      }

      if (!theme) return;

      const isDark = currentTheme === "dark";
      const cssToApply = isDark ? theme.darkCss : theme.lightCss;

      if (!cssToApply) return;

      // Create and inject the style element
      const styleEl = document.createElement("style");
      styleEl.id = THEME_STYLE_ID;
      styleEl.textContent = cssToApply;
      document.head.appendChild(styleEl);
    },
    [],
  );

  const loadAndApplyTheme = useCallback(
    async (currentTheme?: string) => {
      try {
        const response = await fetch("/api/theme");
        if (!response.ok) return;

        const { theme } = await response.json();
        applyTheme(theme, currentTheme);
      } catch (error) {
        console.error("Failed to load custom theme:", error);
      }
    },
    [applyTheme],
  );

  const saveTheme = useCallback(
    async (name: string, lightCss: string, darkCss: string) => {
      try {
        const response = await fetch("/api/theme", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, lightCss, darkCss }),
        });

        if (!response.ok) {
          throw new Error("Failed to save theme");
        }

        const { theme } = await response.json();
        applyTheme(theme, resolvedTheme);
        return theme;
      } catch (error) {
        console.error("Failed to save theme:", error);
        throw error;
      }
    },
    [applyTheme, resolvedTheme],
  );

  const clearTheme = useCallback(async () => {
    try {
      await fetch("/api/theme", { method: "DELETE" });

      // Remove the style element
      const existingStyle = document.getElementById(THEME_STYLE_ID);
      if (existingStyle) {
        existingStyle.remove();
      }
    } catch (error) {
      console.error("Failed to clear theme:", error);
      throw error;
    }
  }, []);

  return { applyTheme, loadAndApplyTheme, saveTheme, clearTheme };
}

export function ThemeManager() {
  const { resolvedTheme } = useTheme();
  const { loadAndApplyTheme } = useCustomTheme();

  // Load theme on mount
  useEffect(() => {
    loadAndApplyTheme(resolvedTheme);
  }, [loadAndApplyTheme, resolvedTheme]);

  // Re-apply when theme mode changes
  useEffect(() => {
    if (resolvedTheme) {
      loadAndApplyTheme(resolvedTheme);
    }
  }, [resolvedTheme, loadAndApplyTheme]);

  return null;
}
