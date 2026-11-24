import { FirebaseAnalytics } from "@/components/firebase-analytics"
import { SiteDocument, siteMetadata } from "@/components/site-document"

export const metadata = siteMetadata

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteDocument analytics={<FirebaseAnalytics />}>{children}</SiteDocument>
}
