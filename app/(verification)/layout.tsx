import { Suspense } from "react"
import { SiteDocument, siteMetadata } from "@/components/site-document"
import { VerificationAnalytics } from "@/components/verification-analytics"

export const metadata = { ...siteMetadata, referrer: "no-referrer" as const }

// Separate ROOT layouts force document navigation across the analytics boundary.
// Keeping app/layout.tsx would retain ordinary Firebase/History listeners here.
export default function VerificationLayout({ children }: { children: React.ReactNode }) {
  return <SiteDocument analytics={<Suspense fallback={null}><VerificationAnalytics /></Suspense>}>{children}</SiteDocument>
}
