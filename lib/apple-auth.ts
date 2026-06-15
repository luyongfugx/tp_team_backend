import { createHash, createPublicKey, createVerify } from "crypto"
import type { JsonWebKey as NodeJsonWebKey } from "crypto"

type AppleJwk = NodeJsonWebKey & {
  kid: string
  alg: string
}

type AppleJwtHeader = {
  alg?: string
  kid?: string
}

export type AppleIdentityPayload = {
  iss: string
  aud: string | string[]
  exp: number
  iat?: number
  sub: string
  email?: string
  email_verified?: string | boolean
  is_private_email?: string | boolean
  nonce?: string
}

let cachedKeys: { keys: AppleJwk[]; expiresAt: number } | null = null

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=")
  return Buffer.from(padded, "base64")
}

function parseJwtPart<T>(value: string): T {
  return JSON.parse(base64UrlDecode(value).toString("utf8")) as T
}

async function getAppleKeys() {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys

  const res = await fetch("https://appleid.apple.com/auth/keys", {
    next: { revalidate: 60 * 60 * 6 },
  })
  if (!res.ok) throw new Error("获取 Apple 公钥失败")

  const data = (await res.json()) as { keys?: AppleJwk[] }
  const keys = Array.isArray(data.keys) ? data.keys : []
  cachedKeys = { keys, expiresAt: Date.now() + 6 * 60 * 60 * 1000 }
  return keys
}

function allowedAudiences() {
  return (process.env.APPLE_CLIENT_IDS || process.env.APPLE_CLIENT_ID || process.env.APPLE_BUNDLE_ID || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function assertAudience(aud: string | string[]) {
  const allowed = allowedAudiences()
  if (allowed.length === 0) throw new Error("Apple 登录未配置 APPLE_CLIENT_IDS")

  const values = Array.isArray(aud) ? aud : [aud]
  if (!values.some((value) => allowed.includes(value))) {
    throw new Error("Apple token audience 不匹配")
  }
}

function assertNonce(payload: AppleIdentityPayload, nonce?: string, rawNonce?: string) {
  const expectedNonce = rawNonce ? createHash("sha256").update(rawNonce).digest("hex") : nonce
  if (expectedNonce && payload.nonce !== expectedNonce) {
    throw new Error("Apple token nonce 不匹配")
  }
}

export async function verifyAppleIdentityToken({
  identityToken,
  nonce,
  rawNonce,
}: {
  identityToken: string
  nonce?: string
  rawNonce?: string
}) {
  const parts = identityToken.split(".")
  if (parts.length !== 3) throw new Error("Apple identityToken 格式不正确")

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const header = parseJwtPart<AppleJwtHeader>(encodedHeader)
  const payload = parseJwtPart<AppleIdentityPayload>(encodedPayload)

  if (header.alg !== "ES256" || !header.kid) throw new Error("Apple identityToken 算法不支持")

  const key = (await getAppleKeys()).find((item) => item.kid === header.kid)
  if (!key) throw new Error("Apple identityToken 公钥不存在")

  const verifier = createVerify("SHA256")
  verifier.update(`${encodedHeader}.${encodedPayload}`)
  verifier.end()
  const publicKey = createPublicKey({ key, format: "jwk" })
  const isValid = verifier.verify({ key: publicKey, dsaEncoding: "ieee-p1363" }, base64UrlDecode(encodedSignature))
  if (!isValid) throw new Error("Apple identityToken 签名无效")

  if (payload.iss !== "https://appleid.apple.com") throw new Error("Apple token issuer 不正确")
  if (!payload.sub) throw new Error("Apple token 缺少用户标识")
  if (!payload.exp || payload.exp * 1000 <= Date.now()) throw new Error("Apple token 已过期")
  assertAudience(payload.aud)
  assertNonce(payload, nonce, rawNonce)

  return payload
}
