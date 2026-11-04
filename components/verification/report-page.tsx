import { headers } from "next/headers"
import type { Metadata } from "next"
import { getPhotoShareCopy } from "@/lib/photoShareI18n"
import type { VerificationReport } from "@/lib/verificationReport"
import VerificationReportPage from "./report"
import { captureDateAndTime } from "@/lib/verificationReportTime"

export type ReportSearch = Record<string, string | string[] | undefined>
export async function reportCopy(search: ReportSearch) {
  const request = await headers()
  return getPhotoShareCopy(typeof search.lang === "string" ? search.lang : request.get("accept-language") || "en")
}
export async function ReportPage({ report, search, sample = false }: { report: VerificationReport; search: ReportSearch; sample?: boolean }) {
  const { copy, locale, direction } = await reportCopy(search)
  // Format once on the server: WebKit and Node ICU can use different Arabic
  // digits/punctuation, which otherwise makes React discard the initial page.
  const formatTime = (timestamp: number, timezone: string, short = false) => {
    try { return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: short ? "short" : "medium", timeZone: timezone }).format(timestamp) }
    catch { return new Date(timestamp).toISOString() }
  }
  const capture = report.capture
  const captureTime = capture?.captureTime || (capture?.timestamp
    ? formatTime(capture.timestamp, capture.timezoneID || "UTC") + (capture.timezoneID ? "" : " UTC") : "—")
  const completedTime = report.completedAt ? formatTime(report.completedAt, "UTC", true) + " UTC" : ""
  const { date: captureDate, time: captureClock } = captureDateAndTime(capture, locale)
  return <VerificationReportPage report={report} copy={copy} locale={locale} direction={direction}
    captureTime={captureTime} captureDate={captureDate} captureClock={captureClock} completedTime={completedTime}
    embedded={search.embed === "1"} theme="light"
    sample={sample} legacy={search.legacy === "1"} />
}
export async function reportMetadata(report: VerificationReport, search: ReportSearch): Promise<Metadata> {
  const { copy } = await reportCopy(search)
  const title = copy.reportTitle
  const description = report.state === "passed" || (report.state === "record" && report.capture)
    ? `${copy.resultLabel}: ${copy.passedTitle}`
    : report.mode === "record" ? (report.state === "error" ? copy.serviceError : copy.recordNotFound)
    : report.state === "mismatch" ? copy.warningBody : copy.partialBody
  return { title: `${title} | Timeprint`, description, robots: { index: false, follow: false, nocache: true },
    openGraph: { title, description, type: "website", images: report.imageUrl ? [{ url: report.imageUrl }] : [] }, referrer: "no-referrer" }
}
