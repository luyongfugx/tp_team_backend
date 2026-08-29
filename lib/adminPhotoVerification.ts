import COS from "cos-nodejs-sdk-v5"

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

  const errorCode = String(task.errorCode || result?.errorCode || "")
  const errorMessage = String(task.errorMessage || result?.errorMessage || "")
  const categoryByCode: Record<string, string> = {
    "-2100": "输入参数无效",
    "-2200": "盲水印提取失败或相似度不足",
    "-2300": "OCR 初始化或内部结果异常",
    "-2301": "OCR 未识别到内容",
    "-2302": "OCR 预处理失败",
    "-2303": "照片码长度异常",
    "-2400": "照片码结构、时间或地点范围校验失败",
    "-2401": "拍摄时间校验失败",
    "-2402": "拍摄地点校验失败",
    "-2403": "疑似作弊或包含非法字符",
    "-2500": "OCR 服务并发繁忙",
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
