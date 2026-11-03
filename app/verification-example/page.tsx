import { ReportPage, type ReportSearch } from "@/components/verification/report-page"
import { verificationReportFixture } from "@/lib/verificationReportFixtures"
export const metadata = { robots: { index: false, follow: false } }
export default async function Page({ searchParams }: { searchParams: Promise<ReportSearch> }) {
  const report = verificationReportFixture("mismatch")
  report.imageUrl = "/verification-example.jpg"
  return <ReportPage report={report} search={await searchParams} sample />
}

export const viewport = { themeColor: "#1d5789", colorScheme: "light" }
