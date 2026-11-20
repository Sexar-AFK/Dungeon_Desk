/** Visual themes supported by the application. */
export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "dungeon-desk-theme";

/** Returns the user's explicit theme choice, if one has been saved. */
export function readThemePreference(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    // Storage may be unavailable in private browsing or restricted contexts.
    return null;
  }
}

/** Uses the operating-system preference when the user has not chosen a theme. */
export function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Saves an explicit choice so it is preserved between visits. */
export function saveThemePreference(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Keep the current session usable even if the preference cannot be saved.
  }
}
