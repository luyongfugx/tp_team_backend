import { createVerificationVisitTracker, verificationPageParameters } from "./verification-analytics"

type Gtag = (...args: unknown[]) => void
type AnalyticsWindow = Window & {
  dataLayer?: unknown[]
  gtag?: Gtag
  timeprintVerificationAnalytics?: ReturnType<typeof createClient>
}

function createClient(win: AnalyticsWindow, measurementId: string) {
  const visits = createVerificationVisitTracker()
  let initialized = false

  function visit() {
    if ((win as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] === true) return
    const parameters = visits.visit(win.location.pathname, win.location.search)
    if (!parameters) return
    win.dataLayer ||= []
    win.gtag ||= function () { win.dataLayer!.push(arguments) }
    const gtag = win.gtag
    // Set BEFORE js/config/script loading. Overrides persist for automatic events too.
    // Never read document.title/referrer or pass arbitrary search/campaign parameters.
    gtag("set", { ...parameters, send_page_view: false,
      allow_google_signals: false, allow_ad_personalization_signals: false })
    if (!initialized) {
      initialized = true
      gtag("js", new Date())
    }
    gtag("config", measurementId, { ...parameters, send_page_view: false,
      allow_google_signals: false, allow_ad_personalization_signals: false })
    gtag("event", "page_view", { ...parameters, send_to: measurementId })

    if (!win.document.getElementById("timeprint-verification-google-tag")) {
      const script = win.document.createElement("script")
      script.id = "timeprint-verification-google-tag"
      script.async = true
      script.referrerPolicy = "no-referrer"
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
      // A blocked SDK must never reject a promise or affect the report UI.
      script.onerror = () => {}
      win.document.head.appendChild(script)
    }
  }
  return { measurementId, visit, leave: visits.leave }
}

export function resetVerificationVisit(win: AnalyticsWindow) {
  win.timeprintVerificationAnalytics?.leave()
}

export function stopVerificationAnalytics(win: AnalyticsWindow) {
  const client = win.timeprintVerificationAnalytics
  if (client) {
    (win as unknown as Record<string, unknown>)[`ga-disable-${client.measurementId}`] = true
    client.leave()
  }
}

export function trackVerificationVisit(win: AnalyticsWindow, measurementId: string) {
  // The root-layout boundary guarantees the ordinary site's SDK is never here.
  // Do not mix destinations if runtime configuration changes mid-document.
  if (win.timeprintVerificationAnalytics?.measurementId !== measurementId && win.timeprintVerificationAnalytics) return
  win.timeprintVerificationAnalytics ||= createClient(win, measurementId)
  if (!verificationPageParameters(win.location.pathname, win.location.search)) {
    win.timeprintVerificationAnalytics.leave()
    return
  }
  win.timeprintVerificationAnalytics.visit()
}
