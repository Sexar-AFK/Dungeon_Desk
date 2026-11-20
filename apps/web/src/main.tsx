import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.tsx";
import { getSystemTheme, readThemePreference } from "./features/theme/theme";

// Set the theme before React mounts so the page does not briefly flash light.
const savedTheme = readThemePreference();
const initialTheme = savedTheme ?? getSystemTheme();
document.documentElement.dataset.theme = initialTheme;

// One shared cache keeps the dashboard and campaign pages in sync after writes.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App initialTheme={initialTheme} hasSavedTheme={savedTheme !== null} />
    </QueryClientProvider>
  </StrictMode>,
);
