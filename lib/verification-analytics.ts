/** Only these constants may leave the browser. Real identifiers stay in memory. */
export const VERIFICATION_ANALYTICS_ORIGIN = "https://h5.timeprint.net"
export const VERIFICATION_PAGE_TITLES = {
  share_record: "Timeprint Shared Photo Record",
  photo_record: "Timeprint Photo Record",
  verification_report: "Timeprint Verification Report",
} as const
export type VerificationPage = keyof typeof VERIFICATION_PAGE_TITLES
export type VerificationContext = "browser" | "embedded"

export function verificationPage(pathname: string): VerificationPage | null {
  // Invalid/missing records still render a functional error page and count as a visit.
  // Redirect-only /s, examples, preview pages and deeper/unknown routes never count.
  const route = /^\/(r|record|verify)\/[^/]+\/?$/.exec(pathname)?.[1]
  return route === "r" ? "share_record" : route === "record" ? "photo_record"
    : route === "verify" ? "verification_report" : null
}

export function verificationPageParameters(pathname: string, search: string) {
  const page = verificationPage(pathname)
  if (!page) return null
  const context: VerificationContext = new URLSearchParams(search).get("embed") === "1" ? "embedded" : "browser"
  return {
    page_location: `${VERIFICATION_ANALYTICS_ORIGIN}/_analytics/${page}/${context}`,
    page_title: VERIFICATION_PAGE_TITLES[page],
    page_referrer: "",
  }
}

export function verificationAnalyticsConfig(env: Record<string, string | undefined>) {
  const measurementId = env.VERIFICATION_ANALYTICS_MEASUREMENT_ID?.trim() || ""
  const streamId = env.VERIFICATION_ANALYTICS_STREAM_ID?.trim() || ""
  if (env.VERIFICATION_ANALYTICS_ENABLED !== "1"
    || env.VERIFICATION_ANALYTICS_ENHANCED_MEASUREMENT_DISABLED !== "1"
    || !/^G-[A-Z0-9]+$/.test(measurementId) || !/^\d+$/.test(streamId)
    || measurementId === "G-Z9HJ16FDTS" || streamId === "15325751892"
    || measurementId === env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim()) return null
  return { measurementId, streamId }
}

/** One tracker per document, not per React mount. Query/hash changes are not visits. */
export function createVerificationVisitTracker() {
  let previousPath: string | null = null
  return {
    visit(pathname: string, search: string) {
      const parameters = verificationPageParameters(pathname, search)
      const key = parameters ? pathname.replace(/\/$/, "") : null
      if (key === previousPath) return null
      previousPath = key
      return parameters
    },
    leave() { previousPath = null },
  }
}
