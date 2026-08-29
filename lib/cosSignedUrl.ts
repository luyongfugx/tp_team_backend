import COS from "cos-nodejs-sdk-v5"
import { verificationImageBucket } from "@/lib/photoVerification"

type BucketSecretConfig = { secretIdEnv?: string; secretKeyEnv?: string }

function verificationBucketSecrets() {
  let config: BucketSecretConfig = {}
  const raw = process.env.TENCENT_COS_BUCKETS_JSON?.trim()
  if (raw) {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const value = parsed.verify_images
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const entry = value as Record<string, unknown>
      config = {
        secretIdEnv: typeof entry.secretIdEnv === "string" ? entry.secretIdEnv.trim() : undefined,
        secretKeyEnv: typeof entry.secretKeyEnv === "string" ? entry.secretKeyEnv.trim() : undefined,
      }
    }
  }
  const secretID = process.env[config.secretIdEnv || "TENCENT_COS_SECRET_ID"]?.trim()
  const secretKey = process.env[config.secretKeyEnv || "TENCENT_COS_SECRET_KEY"]?.trim()
  if (!secretID || !secretKey) throw new Error("Tencent COS read credentials are not configured")
  return { secretID, secretKey }
}

export function signedVerificationImageURL(objectKey: string, expiresSeconds = 900) {
  const { bucket, region } = verificationImageBucket()
  const { secretID, secretKey } = verificationBucketSecrets()
  const cos = new COS({ SecretId: secretID, SecretKey: secretKey, Protocol: "https:" })
  return cos.getObjectUrl({
    Bucket: bucket,
    Region: region,
    Key: objectKey,
    Sign: true,
    Method: "GET",
    Expires: Math.min(3600, Math.max(300, expiresSeconds)),
    Protocol: "https:",
  })
}
