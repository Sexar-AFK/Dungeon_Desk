import type { Theme } from "./theme";
import { Icon } from "../../lib/Icon";

type ThemeToggleProps = {
  theme: Theme;
  onToggle: () => void;
};

/** Accessible toggle for switching between the light and dark color schemes. */
export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const nextThemeLabel = theme === "dark" ? "claro" : "oscuro";

  return (
    <button
      className="icon-button theme-toggle"
      type="button"
      aria-label={`Cambiar a modo ${nextThemeLabel}`}
      aria-pressed={theme === "dark"}
      title={`Cambiar a modo ${nextThemeLabel}`}
      onClick={onToggle}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
    </button>
  );
}
