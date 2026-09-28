import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";

// All user-visible strings go through i18n (docs/CONTEXT.md §13, agent rule §16.7).
// English only at v1; the structure is ready for additional locale files (Hindi,
// Tamil, ...) to be added here without touching any component.
void i18next.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18next;
