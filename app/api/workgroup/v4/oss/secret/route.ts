import { createHash, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { bad, readBody } from "@/app/api/_utils/api"

function signatureMatches(deviceID: string, signature: string, signKey: string) {
  if (!/^[a-f\d]{32}$/i.test(signature)) return false
  const expected = createHash("md5").update(`${deviceID}${signKey}`).digest("hex")
  const actualBuffer = Buffer.from(signature.toLowerCase(), "utf8")
  const expectedBuffer = Buffer.from(expected, "utf8")
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

export async function POST(req: Request) {
  try {
    const body = await readBody(req)
    const rawDeviceID = body.device_id ?? body.deviceId
    const deviceID = typeof rawDeviceID === "string" ? rawDeviceID.trim() : ""
    const signature = typeof body.sign === "string" ? body.sign.trim() : ""
    if (!deviceID || deviceID.length > 191 || !signature) return bad()

    const signKey = process.env.COS_JSON_SIGN_KEY
    const aesSecret = process.env.COS_JSON_AES_SECRET
    if (!signKey || !aesSecret) {
      return NextResponse.json({ error: "COS JSON 加密配置缺失" }, { status: 503 })
    }
    if (![16, 24, 32].includes(Buffer.byteLength(aesSecret, "utf8"))) {
      return NextResponse.json({ error: "COS JSON AES 密钥长度必须为 16、24 或 32 字节" }, { status: 503 })
    }
    if (!signatureMatches(deviceID, signature, signKey)) return bad("签名不正确", 403)

    return NextResponse.json({ StatusCode: 200, Secret: aesSecret })
  } catch (err) {
    console.log("[app/workgroup/v4/oss/secret] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
