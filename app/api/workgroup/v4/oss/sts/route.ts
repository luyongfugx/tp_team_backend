import { NextResponse } from "next/server"
import * as STS from "qcloud-cos-sts"
import { prisma } from "@/lib/prisma"
import { bad, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"

const TEAM_PHOTO_PATTERN = /^teamspace\/[A-Z]{2}\/([^/]+)\/(team|\d+)\/\d{4}\/\d{2}\/\d{2}\/(?:ios|android)_[A-Za-z0-9._-]+\.jpg$/
const AVATAR_PATTERN = /^teamspace\/avatar\/([^/]+)\/\d{4}\/\d{2}\/\d{2}\/(?:ios|android)_[A-Za-z0-9._-]+\.png$/
const BUCKET_KEY_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/

type COSAccess = "read" | "write" | "readwrite"

type COSBucketConfig = {
  bucket: string
  region: string
  allowRead: boolean
  allowWrite: boolean
  allowedPrefixes: string[]
  validator?: "team" | "photoJson" | "verifyImage"
  secretIdEnv?: string
  secretKeyEnv?: string
}

function durationSeconds() {
  const configured = Number(process.env.COS_STS_DURATION_SECONDS)
  if (!Number.isInteger(configured)) return 900
  return Math.min(1800, Math.max(300, configured))
}

function cleanUserPathID(userID: string) {
  return userID.trim().replaceAll("/", "_")
}

function validObjectKey(value: unknown) {
  if (typeof value !== "string") return ""
  const objectKey = value.trim()
  if (!objectKey || objectKey.length > 1024 || objectKey.startsWith("/") || objectKey.includes("\\")) return ""
  if (objectKey.split("/").some((part) => !part || part === "." || part === "..")) return ""
  return objectKey
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim())
    : []
}

function parseBucketConfig(value: unknown): COSBucketConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const bucket = typeof raw.bucket === "string" ? raw.bucket.trim() : ""
  const region = typeof raw.region === "string" ? raw.region.trim() : ""
  if (!bucket || !region) return null
  const validator = raw.validator === "team" || raw.validator === "photoJson" || raw.validator === "verifyImage"
    ? raw.validator
    : undefined
  const allowedPrefixes = stringArray(raw.allowedPrefixes)
  if (!validator && allowedPrefixes.length === 0) return null
  return {
    bucket,
    region,
    allowRead: raw.allowRead === true,
    allowWrite: raw.allowWrite === true,
    allowedPrefixes,
    validator,
    secretIdEnv: typeof raw.secretIdEnv === "string" ? raw.secretIdEnv.trim() : undefined,
    secretKeyEnv: typeof raw.secretKeyEnv === "string" ? raw.secretKeyEnv.trim() : undefined,
  }
}

function configuredBuckets(): Record<string, COSBucketConfig> {
  const rawConfig = process.env.TENCENT_COS_BUCKETS_JSON?.trim()
  if (rawConfig) {
    const parsed = JSON.parse(rawConfig) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("TENCENT_COS_BUCKETS_JSON must be an object")
    return Object.entries(parsed as Record<string, unknown>).reduce<Record<string, COSBucketConfig>>((result, [key, value]) => {
      if (!BUCKET_KEY_PATTERN.test(key)) return result
      const config = parseBucketConfig(value)
      if (config) result[key] = config
      return result
    }, {})
  }

  const bucket = process.env.TENCENT_COS_TEAM_BUCKET?.trim()
  const region = process.env.TENCENT_COS_REGION?.trim()
  return bucket && region ? {
    team: {
      bucket,
      region,
      allowRead: true,
      allowWrite: true,
      allowedPrefixes: [],
      validator: "team",
    },
  } : {}
}

function requestedAccess(value: unknown): COSAccess | null {
  if (value == null || value === "") return "write"
  return value === "read" || value === "write" || value === "readwrite" ? value : null
}

function accessActions(access: COSAccess) {
  const actions: string[] = []
  if (access === "read" || access === "readwrite") actions.push("name/cos:GetObject")
  if (access === "write" || access === "readwrite") actions.push("name/cos:PutObject")
  return actions
}

function configuredSecret(config: COSBucketConfig, kind: "id" | "key") {
  const envName = kind === "id" ? config.secretIdEnv : config.secretKeyEnv
  const fallbackName = kind === "id" ? "TENCENT_COS_SECRET_ID" : "TENCENT_COS_SECRET_KEY"
  return process.env[envName || fallbackName]?.trim()
}

async function validateTeamObject(objectKey: string, userID: string) {
  const avatarMatch = objectKey.match(AVATAR_PATTERN)
  if (avatarMatch) return avatarMatch[1] === cleanUserPathID(userID)

  const photoMatch = objectKey.match(TEAM_PHOTO_PATTERN)
  if (!photoMatch) return false
  const groupID = photoMatch[1]
  const projectPath = photoMatch[2]
  if (!(await requireTeamMember(groupID, userID))) return false
  if (projectPath === "team") return true
  const projectID = Number(projectPath)
  if (!Number.isSafeInteger(projectID) || projectID <= 0) return false
  return Boolean(await prisma.project.findFirst({
    where: { groupID, projectID, deletedAt: null },
    select: { projectID: true },
  }))
}

async function objectAllowed(config: COSBucketConfig, objectKey: string, userID: string) {
  if (config.validator === "team") return validateTeamObject(objectKey, userID)
  if (config.validator === "photoJson") {
    // Some captures still use the local code provider during rollout. Limit the
    // credential to one valid code-shaped object; ownership moves to the code
    // table automatically once all clients consume prefetched server codes.
    return /^[A-Z0-9]{14}\.json$/.test(objectKey)
  }
  if (config.validator === "verifyImage") {
    const safeUserID = cleanUserPathID(userID)
    return objectKey.startsWith(`verify/${safeUserID}/`) && /\.(?:jpe?g)$/i.test(objectKey)
  }
  return config.allowedPrefixes.some((prefix) => objectKey.startsWith(prefix))
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)

    const body = await readBody(req)
    const bucketKey = typeof body.bucketKey === "string" ? body.bucketKey.trim() : "team"
    const objectKey = validObjectKey(body.objectKey ?? body.object_key)
    const access = requestedAccess(body.access)
    if (!BUCKET_KEY_PATTERN.test(bucketKey) || !objectKey || !access) return bad()

    const config = configuredBuckets()[bucketKey]
    if (!config) return bad("参数不正确", 404)
    if ((access === "read" || access === "readwrite") && !config.allowRead) return bad("无团队访问权限", 403)
    if ((access === "write" || access === "readwrite") && !config.allowWrite) return bad("无团队访问权限", 403)
    if (!(await objectAllowed(config, objectKey, user.id))) return bad("无团队访问权限", 403)

    const secretId = configuredSecret(config, "id")
    const secretKey = configuredSecret(config, "key")
    if (!secretId || !secretKey) {
      return NextResponse.json({ error: "COS STS 配置缺失" }, { status: 503 })
    }

    const policy = STS.getPolicy([{
      action: accessActions(access),
      bucket: config.bucket,
      region: config.region,
      prefix: objectKey,
    }])
    const credential = await STS.getCredential({
      secretId,
      secretKey,
      region: config.region,
      durationSeconds: durationSeconds(),
      policy,
    })

    return NextResponse.json({
      credentials: credential.credentials,
      startTime: credential.startTime,
      expiredTime: credential.expiredTime,
      bucketKey,
      bucket: config.bucket,
      region: config.region,
      objectKey,
      access,
    }, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (err) {
    console.log("[app/workgroup/v4/oss/sts] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
