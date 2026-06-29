import { createPublicKey, createVerify } from "crypto"
import type { JsonWebKey as NodeJsonWebKey } from "crypto"

type GoogleJwk = NodeJsonWebKey & {
  kid: string
  alg?: string
}

type GoogleJwtHeader = {
  alg?: string
  kid?: string
}

export type GoogleIdentityPayload = {
  iss: string
  aud: string | string[]
  exp: number
  iat?: number
  sub: string
  email?: string
  email_verified?: boolean | string
  name?: string
  picture?: string
  given_name?: string
  family_name?: string
  nonce?: string
}

let cachedKeys: { keys: GoogleJwk[]; expiresAt: number } | null = null

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=")
  return Buffer.from(padded, "base64")
}

function parseJwtPart<T>(value: string): T {
  return JSON.parse(base64UrlDecode(value).toString("utf8")) as T
}

async function getGoogleKeys() {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys

  const res = await fetch("https://www.googleapis.com/oauth2/v3/certs", {
    next: { revalidate: 60 * 60 * 6 },
  })
  if (!res.ok) throw new Error("获取 Google 公钥失败")

  const data = (await res.json()) as { keys?: GoogleJwk[] }
  const keys = Array.isArray(data.keys) ? data.keys : []
  const maxAge = res.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1]
  cachedKeys = {
    keys,
    expiresAt: Date.now() + (maxAge ? Number(maxAge) : 6 * 60 * 60) * 1000,
  }
  return keys
}

function allowedAudiences() {
  return (process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_IOS_CLIENT_ID || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function assertAudience(aud: string | string[]) {
  const allowed = allowedAudiences()
  if (allowed.length === 0) throw new Error("Google 登录未配置 GOOGLE_CLIENT_IDS")

  const values = Array.isArray(aud) ? aud : [aud]
  if (!values.some((value) => allowed.includes(value))) {
    throw new Error("Google token audience 不匹配")
  }
}

function assertNonce(payload: GoogleIdentityPayload, nonce?: string) {
  if (nonce && payload.nonce !== nonce) {
    throw new Error("Google token nonce 不匹配")
  }
}

function isEmailVerified(value: GoogleIdentityPayload["email_verified"]) {
  return value === true || value === "true"
}

export async function verifyGoogleIdentityToken({
  identityToken,
  nonce,
}: {
  identityToken: string
  nonce?: string
}) {
  const parts = identityToken.split(".")
  if (parts.length !== 3) throw new Error("Google identityToken 格式不正确")

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const header = parseJwtPart<GoogleJwtHeader>(encodedHeader)
  const payload = parseJwtPart<GoogleIdentityPayload>(encodedPayload)

  if (!header.kid) throw new Error("Google identityToken 缺少 key id")
  if (header.alg !== "RS256") throw new Error("Google identityToken 算法不支持")

  const key = (await getGoogleKeys()).find((item) => item.kid === header.kid)
  if (!key) throw new Error("Google identityToken 公钥不存在")

  const verifier = createVerify("RSA-SHA256")
  verifier.update(`${encodedHeader}.${encodedPayload}`)
  verifier.end()
  const publicKey = createPublicKey({ key, format: "jwk" })
  if (!verifier.verify(publicKey, base64UrlDecode(encodedSignature))) {
    throw new Error("Google identityToken 签名无效")
  }

  if (payload.iss !== "accounts.google.com" && payload.iss !== "https://accounts.google.com") {
    throw new Error("Google token issuer 不正确")
  }
  if (!payload.sub) throw new Error("Google token 缺少用户标识")
  if (!payload.exp || payload.exp * 1000 <= Date.now()) throw new Error("Google token 已过期")
  assertAudience(payload.aud)
  assertNonce(payload, nonce)
  if (!payload.email) throw new Error("Google token 缺少邮箱")
  if (!isEmailVerified(payload.email_verified)) throw new Error("Google 邮箱未验证")

  return payload
}
