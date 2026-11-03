import { cache } from "react"
import { getVerificationReport } from "@/lib/publicVerificationReport"
import { ReportPage, reportMetadata, type ReportSearch } from "@/components/verification/report-page"
export const dynamic = "force-dynamic"
const load = cache(getVerificationReport)
type Props = { params: Promise<{ taskID: string }>; searchParams: Promise<ReportSearch> }
export async function generateMetadata({ params, searchParams }: Props) { return reportMetadata(await load((await params).taskID), await searchParams) }
export default async function Page({ params, searchParams }: Props) {
  return <ReportPage report={await load((await params).taskID)} search={await searchParams} />
}

export const viewport = { themeColor: "#1d5789", colorScheme: "light" }
