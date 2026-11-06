import { prisma } from "@/lib/prisma"
import { signedVerificationImageURL } from "@/lib/cosSignedUrl"
import { fetchTrustedPhotoRecord } from "@/lib/photoRecord"
import { normalizePhotoCode, normalizeTaskID, verificationReport, photoRecordReport, unavailableReport, text } from "./verificationReport"
import { livePreviewImage } from "./verificationPreviewImage"

// Read-only development adapter: lets the Fang preview use existing public API results
// without copying production database/COS credentials to a developer machine.
async function previewRead(path: string, body: Record<string, string>) {
  const base = process.env.NODE_ENV === "development" ? process.env.TP_VERIFICATION_READ_API_BASE : undefined
  if (!base) return undefined
  const url = new URL(`${base.replace(/\/$/, "")}/${path}`)
  if (url.protocol !== "https:") throw new Error("Preview API must use HTTPS")
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15000) })
  if (response.status === 404) return null
  if (!response.ok) throw new Error("Preview read unavailable")
  const json = await response.json()
  return json.data ?? json
}

export async function getVerificationReport(value: unknown) {
  const taskID = normalizeTaskID(value)
  if (!taskID) return unavailableReport("verification", "not_found")
  try {
    const preview = await previewRead("photoCode/verify/task/status", { taskID })
    if (preview !== undefined) {
      if (!preview) return unavailableReport("verification", "not_found")
      const report = verificationReport(preview)
      // Resolve the signed image independently in the browser. Reading the live
      // H5 preview must never hold up the verification result or its HTML.
      report.imageUrl = typeof preview.imageUrl === "string" && preview.imageUrl
        ? `/api/photoCode/verify/task/${taskID}/preview` : null
      report.imageUnavailable = !report.imageUrl
      return report
    }
    const task = await prisma.photoVerificationTask.findUnique({ where: { taskID }, select: {
      taskID: true, status: true, photoCode: true, verified: true, result: true,
      errorCode: true, completedAt: true, imageObjectKey: true,
    } })
    if (!task) return unavailableReport("verification", "not_found")
    const report = verificationReport(task)
    if (task.imageObjectKey) {
      try { report.imageUrl = signedVerificationImageURL(task.imageObjectKey) }
      catch { report.imageUnavailable = true }
    }
    return report
  } catch { return unavailableReport("verification", "error") }
}

export async function getVerificationPreviewImage(value: unknown) {
  if (process.env.NODE_ENV !== "development" || !process.env.TP_VERIFICATION_READ_API_BASE) return null
  const taskID = normalizeTaskID(value)
  if (!taskID) return null
  try {
    const task = await previewRead("photoCode/verify/task/status", { taskID })
    return task ? await livePreviewImage(taskID, task.imageUrl) : null
  } catch { return null }
}

export async function getCaptureRecordReport(value: unknown) {
  const code = normalizePhotoCode(value)
  if (!code) return unavailableReport("record", "not_found")
  try {
    const preview = await previewRead("photoCode/record", { photoCode: code })
    const record = preview === undefined ? await fetchTrustedPhotoRecord(code) : preview
    return record ? photoRecordReport(record, code) : unavailableReport("record", "not_found", code)
  } catch { return unavailableReport("record", "error", code) }
}

// Old links continue to open, but explicitly resolve to a report for one concrete task.
export async function legacyReportTaskID(value: unknown) {
  const photoCode = normalizePhotoCode(value)
  if (!photoCode) return null
  const task = await prisma.photoVerificationTask.findFirst({
    where: { photoCode, status: "SUCCEEDED" }, select: { taskID: true }, orderBy: { completedAt: "desc" },
  })
  return normalizeTaskID(text(task?.taskID))
}
