import type { CaptureRecord } from "./verificationReport"

/** Prefer the recorded wall-clock text; never reinterpret it in the viewer's zone. */
export function captureDateAndTime(capture: CaptureRecord | null, locale: string) {
  const recorded = capture?.captureTime.match(/^(\d{4}[-/]\d{2}[-/]\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/)
  if (recorded) return { date: recorded[1], time: recorded[2] }
  if (capture?.captureTime) return { date: "—", time: capture.captureTime }
  if (capture?.timestamp && capture.timezoneID) {
    try {
      return {
        date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: capture.timezoneID }).format(capture.timestamp),
        time: new Intl.DateTimeFormat(locale, { timeStyle: "medium", timeZone: capture.timezoneID }).format(capture.timestamp),
      }
    } catch { /* Missing or invalid capture timezone must not become the viewer's timezone. */ }
  }
  return { date: "—", time: "—" }
}
