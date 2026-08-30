import COS from "cos-nodejs-sdk-v5"
import { normalizeVerificationErrorCode } from "@/lib/verificationErrorCodes"

type BucketConfig = {
  bucket: string
  region: string
  secretIdEnv?: string
  secretKeyEnv?: string
}

type COSBody = Buffer | string | Uint8Array

function configuredBucket(alias: "photo_json" | "verify_images"): BucketConfig {
  const raw = process.env.TENCENT_COS_BUCKETS_JSON?.trim()
  if (raw) {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const value = parsed[alias]
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const entry = value as Record<string, unknown>
      const bucket = typeof entry.bucket === "string" ? entry.bucket.trim() : ""
      const region = typeof entry.region === "string" ? entry.region.trim() : ""
      if (bucket && region) {
        return {
          bucket,
          region,
          secretIdEnv: typeof entry.secretIdEnv === "string" ? entry.secretIdEnv.trim() : undefined,
          secretKeyEnv: typeof entry.secretKeyEnv === "string" ? entry.secretKeyEnv.trim() : undefined,
        }
      }
    }
  }
  const region = process.env.TENCENT_COS_REGION?.trim() || ""
  const bucket = alias === "photo_json"
    ? process.env.TENCENT_COS_PHOTO_JSON_BUCKET?.trim() || ""
    : process.env.TENCENT_COS_VERIFY_IMAGE_BUCKET?.trim() || ""
  if (!bucket || !region) throw new Error(`Tencent COS ${alias} bucket is not configured`)
  return { bucket, region }
}

function cosClient(config: BucketConfig) {
  const secretID = process.env[config.secretIdEnv || "TENCENT_COS_SECRET_ID"]?.trim()
  const secretKey = process.env[config.secretKeyEnv || "TENCENT_COS_SECRET_KEY"]?.trim()
  if (!secretID || !secretKey) throw new Error("Tencent COS read credentials are not configured")
  return new COS({ SecretId: secretID, SecretKey: secretKey, Protocol: "https:" })
}

export async function readPhotoJSON(objectKey: string) {
  const config = configuredBucket("photo_json")
  const cos = cosClient(config)
  const body = await new Promise<COSBody>((resolve, reject) => {
    cos.getObject(
      { Bucket: config.bucket, Region: config.region, Key: objectKey },
      (error: any, data: any) => {
        if (error) reject(error)
        else if (data.Body == null) reject(new Error("COS object body is empty"))
        else resolve(data.Body)
      },
    )
  })
  const buffer = typeof body === "string" ? Buffer.from(body) : Buffer.from(body)
  if (buffer.length > 5 * 1024 * 1024) throw new Error("COS JSON exceeds 5 MB")
  const parsed: unknown = JSON.parse(buffer.toString("utf8").replace(/^\uFEFF/, ""))
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("COS JSON root must be an object")
  }
  return parsed as Record<string, unknown>
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

type RecognitionAttempt = {
  provider: "local" | "deepseek" | "unknown"
  model: string | null
  scope: string | null
  recognized: string | null
  verified: boolean | null
  usable: boolean | null
  similarity: number | null
  error: string | null
  errorMessage: string | null
  retryCount: number | null
  requestErrors: Array<{ type: string; message: string }>
  http: {
    status: number | null
    contentType: string | null
    requestId: string | null
    mode: string | null
  } | null
}

type RecognitionTrace = {
  field: "photoCode" | "time" | "address"
  label: string
  priority: string | null
  finalProvider: string | null
  finalModel: string | null
  fallbackUsed: boolean
  attempts: RecognitionAttempt[]
}

function nullableString(value: unknown) {
  return value == null || value === "" ? null : String(value)
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function provider(value: unknown): RecognitionAttempt["provider"] {
  return value === "local" || value === "deepseek" ? value : "unknown"
}

function recognitionAttempt(
  value: Record<string, unknown>,
  fallbackProvider: RecognitionAttempt["provider"],
): RecognitionAttempt {
  const requestErrors = Array.isArray(value.requestErrors)
    ? value.requestErrors.map(record)
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => ({
        type: String(item.type || "Error"),
        message: String(item.message || ""),
      }))
    : []
  const http = record(value.http)
  return {
    provider: provider(value.provider || value.recognitionProvider || fallbackProvider),
    model: nullableString(value.model),
    scope: nullableString(value.scope || value.rectType || value.source),
    recognized: nullableString(value.recognized || value.code || value.text),
    verified: typeof value.verified === "boolean"
      ? value.verified
      : typeof value.sourceMatched === "boolean"
        ? value.sourceMatched
        : null,
    usable: typeof value.usable === "boolean" ? value.usable : null,
    similarity: nullableNumber(value.similarity),
    error: nullableString(value.error || value.reason),
    errorMessage: nullableString(value.errorMessage),
    retryCount: nullableNumber(value.retryCount),
    requestErrors,
    http: http ? {
      status: nullableNumber(http.status),
      contentType: nullableString(http.contentType),
      requestId: nullableString(http.requestId),
      mode: nullableString(http.mode),
    } : null,
  }
}

function attemptsFrom(
  value: unknown,
  fallbackProvider: RecognitionAttempt["provider"],
) {
  return Array.isArray(value)
    ? value.map(record).filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => recognitionAttempt(item, fallbackProvider))
    : []
}

function sectionRecognitionTrace(
  result: Record<string, unknown>,
  field: "time" | "address",
  label: string,
): RecognitionTrace {
  const section = record(result[field])
  const regions = Array.isArray(section?.regions)
    ? section.regions.map(record).filter((item): item is Record<string, unknown> => Boolean(item))
    : []
  const attempts: RecognitionAttempt[] = []
  let priority: string | null = null
  let finalProvider: string | null = null
  let finalModel: string | null = nullableString(section?.model)
  let fallbackUsed = false

  for (const region of regions) {
    const regionPriority = nullableString(region.recognitionPriority)
    const regionProvider = provider(region.recognitionProvider)
    const localResult = record(region.localResult)
    const localAttempts = localResult
      ? attemptsFrom(localResult.attempts, "local")
      : regionProvider === "local"
        ? attemptsFrom(region.attempts, "local")
        : []
    const deepseekAttempts = regionProvider === "deepseek"
      ? attemptsFrom(region.attempts, "deepseek")
      : attemptsFrom(region.deepseekDiagnostics, "deepseek")

    if (regionPriority === "deepseek_first") attempts.push(...deepseekAttempts, ...localAttempts)
    else attempts.push(...localAttempts, ...deepseekAttempts)

    priority ||= regionPriority
    finalProvider ||= regionProvider === "unknown" ? null : regionProvider
    finalModel ||= nullableString(region.model)
    fallbackUsed ||= region.fallbackUsed === true || (localAttempts.length > 0 && deepseekAttempts.length > 0)
  }

  return { field, label, priority, finalProvider, finalModel, fallbackUsed, attempts }
}

function recognitionTraces(result: Record<string, unknown> | null): RecognitionTrace[] {
  if (!result) return []
  const photoCode = record(result.photoCode)
  const photoAttempts = attemptsFrom(photoCode?.attempts, "unknown")
  if (photoCode && photoAttempts.length === 0) {
    photoAttempts.push(recognitionAttempt(photoCode, provider(photoCode.recognitionProvider)))
  }
  return [
    {
      field: "photoCode",
      label: "照片码",
      priority: null,
      finalProvider: nullableString(photoCode?.recognitionProvider),
      finalModel: nullableString(photoCode?.model),
      fallbackUsed: new Set(photoAttempts.map((item) => item.provider).filter((item) => item !== "unknown")).size > 1,
      attempts: photoAttempts,
    },
    sectionRecognitionTrace(result, "time", "拍摄时间"),
    sectionRecognitionTrace(result, "address", "拍摄地点"),
  ]
}

export function verificationFailureAnalysis(task: Record<string, unknown>) {
  const result = record(task.result)
  const progress = record(task.verificationProgress)
  const stages = Array.isArray(progress?.stages) ? progress.stages : []
  const failedStages = stages
    .map(record)
    .filter((stage): stage is Record<string, unknown> => Boolean(stage))
    .filter((stage) => stage.status === "FAILED")
    .map((stage) => String(stage.key || "UNKNOWN"))

  const mismatches: Array<{ field: string; reason: string; detail?: unknown }> = []
  const checks = [
    ["photoCode", "照片码"],
    ["time", "拍摄时间"],
    ["address", "拍摄地点"],
    ["content", "照片内容"],
  ] as const
  for (const [key, label] of checks) {
    const value = record(result?.[key])
    if (!value || value.verified !== false) continue
    mismatches.push({
      field: label,
      reason: String(value.reason || value.errorMessage || "校验未通过"),
      detail: value,
    })
  }

  const rawErrorCode = task.errorCode || result?.errorCode
  const errorCode = rawErrorCode ? normalizeVerificationErrorCode(rawErrorCode, "") : ""
  const errorMessage = String(task.errorMessage || result?.errorMessage || "")
  const categoryByCode: Record<string, string> = {
    "400": "输入参数无效",
    "403": "疑似作弊或包含非法字符",
    "404": "OCR 未识别到内容",
    "406": "照片内容不一致",
    "409": "照片码与可信拍摄记录不匹配",
    "410": "可信照片内容参考不可用",
    "412": "拍摄时间校验失败",
    "416": "拍摄地点校验失败",
    "422": "照片码长度异常",
    "424": "盲水印提取失败或相似度不足",
    "500": "OCR 初始化或内部结果异常",
    "502": "OCR 预处理或上游服务失败",
    "503": "OCR 服务并发繁忙",
  }
  return {
    passed: task.verified === true,
    summary: task.verified === true
      ? "验真通过"
      : categoryByCode[errorCode] || errorMessage || mismatches.map((item) => `${item.field}不一致`).join("、") || "验真未通过",
    errorCode: errorCode || null,
    errorMessage: errorMessage || null,
    failedStages,
    mismatches,
    recognitionTraces: recognitionTraces(result),
  }
}

export async function safeReadPhotoJSON(objectKey: string | null | undefined) {
  if (!objectKey) return { objectKey: null, document: null, error: "对象键不存在" }
  try {
    return { objectKey, document: await readPhotoJSON(objectKey), error: null }
  } catch (error) {
    return {
      objectKey,
      document: null,
      error: error instanceof Error ? error.message : "读取 COS JSON 失败",
    }
  }
}
