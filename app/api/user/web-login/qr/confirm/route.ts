import { badFor, ok, readBody, requireUser, serverError } from "@/app/api/_utils/api"
import { confirmWebQrLoginSession, normalizeQrScanToken } from "@/lib/web-qr-login"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return badFor(req, "未授权或登录已过期", 401)
    const body = await readBody(req)
    const scanToken = normalizeQrScanToken(body.scanToken || body.token || body.scanURL || body.code)
    if (!scanToken) return badFor(req, "二维码不正确")

    const result = await confirmWebQrLoginSession(scanToken, user.id)
    if (!result.ok) {
      if (result.reason === "expired") return badFor(req, "二维码已过期，请刷新后重试", 410)
      if (result.reason === "confirmed") return badFor(req, "二维码已被其他用户确认", 409)
      if (result.reason === "consumed") return badFor(req, "二维码已使用", 409)
      return badFor(req, "二维码不存在或已失效", 404)
    }
    return ok({ confirmed: true, alreadyConfirmed: result.alreadyConfirmed })
  } catch (err) {
    console.log("[user/web-login/qr/confirm] error:", err)
    return serverError(req)
  }
}
