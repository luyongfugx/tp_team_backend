import { ok, serverError } from "@/app/api/_utils/api"
import { createWebQrLoginSession } from "@/lib/web-qr-login"

export async function POST(req: Request) {
  try {
    const { scanToken, browserSecret, expiresAt } = await createWebQrLoginSession()
    const baseURL = process.env.WEB_QR_LOGIN_URL || "https://teamspace.timeprint.net/scan-login"
    const scanURL = new URL(baseURL)
    scanURL.searchParams.set("token", scanToken)
    return ok({
      scanToken,
      browserSecret,
      scanURL: scanURL.toString(),
      expiresAt: expiresAt.toISOString(),
    })
  } catch (err) {
    console.log("[auth/qr-login/create] error:", err)
    return serverError(req)
  }
}
