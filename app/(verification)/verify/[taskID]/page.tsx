import { cache, Suspense } from "react"
import { getVerificationReport } from "@/lib/publicVerificationReport"
import { ReportPage, ReportPending, reportMetadata, type ReportSearch } from "@/components/verification/report-page"
export const dynamic = "force-dynamic"
const load = cache(getVerificationReport)
type Props = { params: Promise<{ taskID: string }>; searchParams: Promise<ReportSearch> }
export async function generateMetadata({ params, searchParams }: Props) { return reportMetadata(await load((await params).taskID), await searchParams) }
export default async function Page({ params, searchParams }: Props) {
  const { taskID } = await params
  const search = await searchParams
  return <Suspense fallback={<ReportPending search={search} />}><ResolvedReport taskID={taskID} search={search} /></Suspense>
}
async function ResolvedReport({ taskID, search }: { taskID: string; search: ReportSearch }) {
  return <ReportPage report={await load(taskID)} search={search} />
}

export const viewport = { themeColor: "#1d5789", colorScheme: "light" }
