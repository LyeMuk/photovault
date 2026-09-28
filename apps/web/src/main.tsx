import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@tabler/core/dist/css/tabler.min.css";
import "./styles/overrides.scss";
import "./i18n";
import App from "./App";

// Dark mode follows the OS by default (docs/CONTEXT.md §11.1 rule 2), driven by
// Tabler's data-bs-theme attribute. A manual override is stored per-viewer in
// localStorage by the Settings screen (Phase 1+); this only sets the initial value.
function applyInitialTheme() {
  try {
    const stored = localStorage.getItem("pv-theme");
    const theme =
      stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-bs-theme", theme);
  } catch {
    document.documentElement.setAttribute("data-bs-theme", "light");
  }
}
applyInitialTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
