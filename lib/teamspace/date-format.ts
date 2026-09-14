// Some supported app languages have no date names in the browser's ICU data.
// Use numeric dates in that case instead of silently showing English month names.
export function teamspaceDateOptions(locale: string, includeTime = false): Intl.DateTimeFormatOptions {
  if (Intl.DateTimeFormat.supportedLocalesOf([locale]).length) {
    return { dateStyle: "medium", ...(includeTime ? { timeStyle: "medium" } : {}) };
  }
  return {
    year: "numeric", month: "2-digit", day: "2-digit",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" as const } : {}),
  };
}
