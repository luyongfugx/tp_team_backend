import { timingSafeEqual } from "node:crypto"

type VerificationImageBucket = {
  bucket: string
  region: string
}

export const VERIFICATION_STAGE_KEYS = ["PHOTO_CODE", "TIME", "ADDRESS", "PHOTO_INFO"] as const
export const VERIFICATION_STAGE_STATUSES = ["PENDING", "RUNNING", "COMPLETED", "FAILED"] as const
type VerificationStageKey = typeof VERIFICATION_STAGE_KEYS[number]
type VerificationStageStatus = typeof VERIFICATION_STAGE_STATUSES[number]

type VerificationProgress = {
  currentStage: VerificationStageKey
  stages: Array<{ key: VerificationStageKey; status: VerificationStageStatus }>
  updatedAt: number
}

export function initialVerificationProgress(): VerificationProgress {
  return {
    currentStage: "PHOTO_CODE",
    stages: VERIFICATION_STAGE_KEYS.map((key, index) => ({
      key,
      status: index === 0 ? "RUNNING" : "PENDING",
    })),
    updatedAt: Date.now(),
  }
}

function isStageKey(value: unknown): value is VerificationStageKey {
  return typeof value === "string" && (VERIFICATION_STAGE_KEYS as readonly string[]).includes(value)
}

function isStageStatus(value: unknown): value is VerificationStageStatus {
  return typeof value === "string" && (VERIFICATION_STAGE_STATUSES as readonly string[]).includes(value)
}

export function mergeVerificationProgress(
  existing: unknown,
  stageValue: unknown,
  statusValue: unknown,
): VerificationProgress | null {
  if (!isStageKey(stageValue) || !isStageStatus(statusValue)) return null
  const base = initialVerificationProgress()
  const source = existing && typeof existing === "object" && !Array.isArray(existing)
    ? existing as Record<string, unknown>
    : null
  const sourceStages = Array.isArray(source?.stages) ? source.stages : []
  const prior = new Map<string, VerificationStageStatus>()
  for (const item of sourceStages) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    if (isStageKey(row.key) && isStageStatus(row.status)) prior.set(row.key, row.status)
  }
  const targetIndex = VERIFICATION_STAGE_KEYS.indexOf(stageValue)
  return {
    currentStage: stageValue,
    stages: base.stages.map(({ key }, index) => {
      let status = prior.get(key) ?? (index === 0 ? "RUNNING" : "PENDING")
      if (index < targetIndex && status !== "FAILED") status = "COMPLETED"
      if (key === stageValue) status = statusValue
      return { key, status }
    }),
    updatedAt: Date.now(),
  }
}

export function completedVerificationProgress(): VerificationProgress {
  return {
    currentStage: "PHOTO_INFO",
    stages: VERIFICATION_STAGE_KEYS.map((key) => ({ key, status: "COMPLETED" })),
    updatedAt: Date.now(),
  }
}

function cleanUserPathID(userID: string) {
  return userID.trim().replaceAll("/", "_")
}

export function verificationImageBucket(): VerificationImageBucket {
  const raw = process.env.TENCENT_COS_BUCKETS_JSON?.trim()
  if (raw) {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const entry = parsed.verify_images
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const bucket = typeof (entry as Record<string, unknown>).bucket === "string"
        ? String((entry as Record<string, unknown>).bucket).trim()
        : ""
      const region = typeof (entry as Record<string, unknown>).region === "string"
        ? String((entry as Record<string, unknown>).region).trim()
        : ""
      if (bucket && region) return { bucket, region }
    }
  }
  const bucket = process.env.TENCENT_COS_VERIFY_IMAGE_BUCKET?.trim()
  const region = process.env.TENCENT_COS_REGION?.trim()
  if (!bucket || !region) throw new Error("Verification image bucket is not configured")
  return { bucket, region }
}

export function validateVerificationImageURL(rawURL: unknown, userID: string) {
  if (typeof rawURL !== "string" || rawURL.length > 2048) return null
  let url: URL
  try {
    url = new URL(rawURL)
  } catch {
    return null
  }
  const config = verificationImageBucket()
  const allowedHosts = new Set([
    `${config.bucket}.cos.${config.region}.myqcloud.com`,
    `${config.bucket}.cos.${config.region}.tencentcos.cn`,
  ])
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname.toLowerCase()) || url.search || url.hash) return null
  let objectKey = ""
  try {
    objectKey = decodeURIComponent(url.pathname.replace(/^\/+/, ""))
  } catch {
    return null
  }
  const prefix = `verify/${cleanUserPathID(userID)}/`
  if (!objectKey.startsWith(prefix) || objectKey.includes("\\") || objectKey.split("/").some((part) => !part || part === "." || part === "..")) return null
  if (!/\.(?:jpe?g)$/i.test(objectKey)) return null
  return { imageUrl: url.toString(), objectKey }
}

export async function submitPhotoVerificationTask(taskID: string, imageUrl: string) {
  const baseURL = process.env.TP_OCR_BASE_URL?.trim()
  const apiKey = process.env.TP_OCR_API_KEY?.trim()
  if (!baseURL || !apiKey) throw new Error("TP OCR task service is not configured")
  const endpoint = new URL("/v1/verification-tasks", baseURL).toString()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ taskId: taskID, url: imageUrl }),
      signal: controller.signal,
      cache: "no-store",
    })
    if (!response.ok) {
      const body = (await response.text()).slice(0, 500)
      throw new Error(`TP OCR rejected task (${response.status}): ${body}`)
    }
  } finally {
    clearTimeout(timeout)
  }
}

export function callbackSecretMatches(value: string | null) {
  const expected = process.env.TP_OCR_CALLBACK_SECRET?.trim()
  if (!expected || !value) return false
  const receivedBuffer = Buffer.from(value)
  const expectedBuffer = Buffer.from(expected)
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer)
}

export function publicVerificationTask(task: Record<string, unknown>) {
  return {
    taskID: task.taskID,
    status: task.status,
    imageUrl: task.imageUrl,
    photoCode: task.photoCode,
    verified: task.verified,
    result: task.result,
    resultObjectKey: task.resultObjectKey,
    errorCode: task.errorCode,
    errorMessage: task.errorMessage,
    progress: task.verificationProgress,
    createdAt: task.createdAt instanceof Date ? task.createdAt.getTime() : task.createdAt,
    startedAt: task.startedAt instanceof Date ? task.startedAt.getTime() : task.startedAt,
    completedAt: task.completedAt instanceof Date ? task.completedAt.getTime() : task.completedAt,
    updatedAt: task.updatedAt instanceof Date ? task.updatedAt.getTime() : task.updatedAt,
  }
}
