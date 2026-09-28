// Human-formatted numbers and sizes (docs/CONTEXT.md §13 i18n row: "Indian digit
// grouping supported"). Locale is currently fixed to en-IN; once additional UI
// locales exist this should read from the active i18next language instead.
const NUMBER_LOCALE = "en-IN";

export function formatCount(n: number): string {
  return new Intl.NumberFormat(NUMBER_LOCALE).format(n);
}

const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export function formatBytes(bytes: number, fractionDigits = 1): string {
  if (bytes <= 0) return "0 B";
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  const formatted = new Intl.NumberFormat(NUMBER_LOCALE, {
    maximumFractionDigits: exponent === 0 ? 0 : fractionDigits,
  }).format(value);
  return `${formatted} ${UNITS[exponent]}`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(NUMBER_LOCALE, { dateStyle: "medium" }).format(new Date(iso));
}

export function formatMonthYear(iso: string): string {
  return new Intl.DateTimeFormat(NUMBER_LOCALE, { month: "long", year: "numeric" }).format(
    new Date(iso),
  );
}
