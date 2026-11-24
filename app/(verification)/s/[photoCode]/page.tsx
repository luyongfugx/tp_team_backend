import { redirect, notFound } from "next/navigation"
import { legacyReportTaskID } from "@/lib/publicVerificationReport"
import { normalizePhotoCode } from "@/lib/verificationReport"
import type { ReportSearch } from "@/components/verification/report-page"
export const dynamic = "force-dynamic"
export default async function LegacyShare({ params, searchParams }: { params: Promise<{ photoCode: string }>; searchParams: Promise<ReportSearch> }) {
  const code = normalizePhotoCode((await params).photoCode)
  if (!code) notFound()
  let taskID: string | null = null
  try { taskID = await legacyReportTaskID(code) } catch { /* The record page provides a recoverable error state. */ }
  const query = new URLSearchParams()
  const search = await searchParams
  for (const key of ["lang", "embed", "theme"]) if (typeof search[key] === "string") query.set(key, search[key])
  if (taskID) query.set("legacy", "1")
  redirect(`${taskID ? `/verify/${taskID}` : `/record/${code}`}?${query}`)
}
