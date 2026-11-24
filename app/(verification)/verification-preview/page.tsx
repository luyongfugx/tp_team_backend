import { notFound } from "next/navigation"
import { ReportPage, type ReportSearch } from "@/components/verification/report-page"
import { verificationReportFixture } from "@/lib/verificationReportFixtures"
import ViewportPreview from "./viewport-preview"
export const dynamic = "force-dynamic"
export const metadata = { robots: { index: false, follow: false } }
export default async function Page({ searchParams }: { searchParams: Promise<ReportSearch> }) {
  if (process.env.NODE_ENV !== "development" || process.env.TP_VERIFICATION_PREVIEW !== "1") notFound()
  const search = await searchParams
  // Same-origin frames exercise real CSS breakpoints without changing a user's browser settings.
  const viewport = Number(search.viewport)
  if ([320, 360, 390, 402, 414, 768, 1024, 1440, 1920].includes(viewport)) {
    const requestedHeight = Number(search.height)
    const height = [568, 700, 760, 900].includes(requestedHeight) ? requestedHeight : 760
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(search)) if (!["viewport", "reportPath"].includes(key) && typeof value === "string") params.set(key, value)
    const reportPath = typeof search.reportPath === "string" && /^\/(verify\/[0-9a-f-]{36}|record\/[A-Z0-9]{12})$/.test(search.reportPath) ? search.reportPath : "/verification-preview"
    return <ViewportPreview width={viewport} height={height} src={`${reportPath}?${params}`} />
  }
  return <ReportPage report={verificationReportFixture(typeof search.state === "string" ? search.state : "passed")} search={search} sample />
}

export const viewport = { themeColor: "#1d5789", colorScheme: "light" }
