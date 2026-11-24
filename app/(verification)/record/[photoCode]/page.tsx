import { cache } from "react"
import { getCaptureRecordReport } from "@/lib/publicVerificationReport"
import { ReportPage, reportMetadata, type ReportSearch } from "@/components/verification/report-page"
export const dynamic = "force-dynamic"
const load = cache(getCaptureRecordReport)
type Props = { params: Promise<{ photoCode: string }>; searchParams: Promise<ReportSearch> }
export async function generateMetadata({ params, searchParams }: Props) { return reportMetadata(await load((await params).photoCode), await searchParams) }
export default async function Page({ params, searchParams }: Props) {
  return <ReportPage report={await load((await params).photoCode)} search={await searchParams} />
}

export const viewport = { themeColor: "#1d5789", colorScheme: "light" }
