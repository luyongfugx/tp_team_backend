import * as STS from "qcloud-cos-sts"

export const INSPECTION_BUCKET = "timeprint-inspection-1330977225"
export const INSPECTION_REGION = "ap-singapore"

// Exact objects only: no wildcard, traversal, URL decoding or caller-selected bucket.
export function inspectionObjects(value: unknown): [string, string] | null {
  if (typeof value !== "string" || value.length > 1024 || !value.startsWith("samples/v1/") || !value.endsWith(".jpg")) return null
  const path = value.slice("samples/".length, -4)
  const parts = path.split("/")
  if (parts.some(p => !/^(?:[A-Za-z0-9_.-]|~[0-9a-f]{2}){1,160}$/.test(p) || p === "." || p === "..")) return null
  const offset = parts[1] === "live" ? 2 : parts[1] === "audit" ? 3 : -1
  if (offset < 0 || parts.length !== offset + 8) return null
  const [, platform, , , , page, popup, state] = parts.slice(offset)
  if (platform !== "ios" && platform !== "android") return null
  if (!page.startsWith(`${platform}.page.`) || !(popup === "none" || popup.startsWith(`${platform}.popup.`))) return null
  if (!["default", "large-text", "empty", "expanded"].includes(state)) return null
  return [value, `markers/${path}.done`]
}

export function inspectionPolicy(objects: [string, string]) {
  const policy = STS.getPolicy(objects.map(prefix => ({
    action: ["name/cos:PutObject"], bucket: INSPECTION_BUCKET, region: INSPECTION_REGION, prefix,
  })))
  // Enforced by COS, not just cooperative clients. Marker can never contain user data.
  return { ...policy, statement: policy.statement.map((statement, index) => ({
    ...statement,
    condition: {
      string_equal: { "cos:x-cos-forbid-overwrite": "true" },
      numeric_less_than_equal: { "cos:content-length": index === 0 ? 600000 : 0 },
    },
  })) }
}

// In-process bounds; the production reverse proxy must replace incoming IP headers.
// Multiple server replicas also need a shared edge/WAF limit. No business DB calls.
export function createInspectionSTSHandler(
  issue: (options: STS.GetCredentialOptions) => Promise<STS.CredentialData> = STS.getCredential,
  env: Record<string, string | undefined> = process.env,
  now = Date.now,
) {
  const limits = new Map<string, { start: number; count: number }>()
  let concurrent = 0
  function consume(key: string, maximum: number, time: number) {
    const old = limits.get(key)
    if (!old || time - old.start >= 60000) {
      if (limits.size >= 4096) {
        for (const [id, entry] of limits) if (time - entry.start >= 60000) limits.delete(id)
        if (limits.size >= 4096) return false
      }
      limits.set(key, { start: time, count: 1 }); return true
    }
    if (old.count >= maximum) return false
    old.count++; return true
  }
  return async (req: Request, body: Record<string, unknown>) => {
    const reply = (data: unknown, status = 200) => Response.json(data, {
      status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "60" } : {}) },
    })
    const objects = inspectionObjects(body.objectKey)
    if (body.bucketKey !== "inspection" || body.access !== "write" || !objects) return reply({ error: "Invalid inspection scope" }, 400)
    const time = now()
    const ip = (req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").trim().slice(0, 64)
    if (!consume("global", 1200, time) || !consume(`ip:${ip}`, 120, time) || concurrent >= 8) return reply({ error: "Inspection busy" }, 429)
    const secretId = env.TENCENT_COS_INSPECTION_SECRET_ID || env.TENCENT_COS_SECRET_ID
    const secretKey = env.TENCENT_COS_INSPECTION_SECRET_KEY || env.TENCENT_COS_SECRET_KEY
    if (!secretId || !secretKey) return reply({ error: "Inspection STS unavailable" }, 503)
    concurrent++
    try {
      const credential = await issue({ secretId, secretKey, region: INSPECTION_REGION,
        durationSeconds: 900, policy: inspectionPolicy(objects) })
      return reply({ credentials: credential.credentials, startTime: credential.startTime,
        expiredTime: credential.expiredTime, bucketKey: "inspection", bucket: INSPECTION_BUCKET,
        region: INSPECTION_REGION, objectKey: objects[0], access: "write" })
    } catch {
      // Never log credentials or provider responses for this anonymous endpoint.
      return reply({ error: "Inspection STS unavailable" }, 503)
    } finally { concurrent-- }
  }
}

export const inspectionSTSResponse = createInspectionSTSHandler()
