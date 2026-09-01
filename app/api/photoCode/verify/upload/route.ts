import { randomUUID } from "node:crypto"
import { badFor, ok, requireUser, serverError } from "@/app/api/_utils/api"
import { uploadVerificationImage } from "@/lib/cosSignedUrl"

export const runtime = "nodejs"

const MAX_IMAGE_BYTES = 800 * 1024

function cleanUserPathID(userID: string) {
  return userID.trim().replaceAll("/", "_")
}

function isJPEG(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return badFor(req, "未授权或登录已过期", 401)

    const contentLength = Number(req.headers.get("content-length"))
    if (Number.isFinite(contentLength) && contentLength > 1024 * 1024) return badFor(req)

    const form = await req.formData()
    const image = form.get("image")
    if (!(image instanceof File) || image.size <= 0 || image.size > MAX_IMAGE_BYTES) {
      return badFor(req)
    }
    const bytes = new Uint8Array(await image.arrayBuffer())
    if (!isJPEG(bytes)) return badFor(req)

    const objectKey = `verify/${cleanUserPathID(user.id)}/${randomUUID()}.jpg`
    const imageUrl = await uploadVerificationImage(objectKey, Buffer.from(bytes))
    return ok({ imageUrl, objectKey })
  } catch (error) {
    console.log("[photoCode/verify/upload] error:", error)
    return serverError(req)
  }
}
