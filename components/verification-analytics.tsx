"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { resetVerificationVisit, stopVerificationAnalytics, trackVerificationVisit } from "@/lib/verification-analytics-client"
import { VERIFICATION_ANALYTICS_ORIGIN, verificationPage } from "@/lib/verification-analytics"

export function VerificationAnalytics() {
  const pathname = usePathname()
  const search = useSearchParams()
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || window.location.origin !== VERIFICATION_ANALYTICS_ORIGIN) return
    let mounted = true
    // Fetch on each navigation, so disabling the runtime flag stops new page views.
    // No build-time NEXT_PUBLIC override can silently enable preview deployments.
    function visit() {
      if (!verificationPage(window.location.pathname)) { resetVerificationVisit(window); return }
      void fetch("/api/config/verification-analytics", { cache: "no-store", referrerPolicy: "no-referrer" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (mounted && payload?.enabled === true && /^G-[A-Z0-9]+$/.test(payload.measurementId)) {
          trackVerificationVisit(window, payload.measurementId)
        } else if (mounted) stopVerificationAnalytics(window)
      })
      .catch(() => { /* Analytics is optional; report rendering/retries are independent. */ })
    }
    function restore(event: PageTransitionEvent) {
      if (event.persisted) { resetVerificationVisit(window); visit() }
    }
    // Next may commit a redirect/rewrite's history entry after React's effects.
    // Read the visible URL on the next frame so /r keeps its entry identity and
    // a redirect-only /s document never masks the final rendered route.
    const frame = window.requestAnimationFrame(visit)
    window.addEventListener("pageshow", restore)
    return () => { mounted = false; window.cancelAnimationFrame(frame); window.removeEventListener("pageshow", restore) }
  }, [pathname, search])
  return null
}
