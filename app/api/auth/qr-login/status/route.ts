import { generateToken, TOKEN_TTL_MS } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { badFor, ok, readBody, serverError } from "@/app/api/_utils/api"
import { findWebQrLoginSession, normalizeQrScanToken, qrBrowserSecretHash, webQrLoginDelegate } from "@/lib/web-qr-login"

export async function POST(req: Request) {
  try {
    const body = await readBody(req)
    const scanToken = normalizeQrScanToken(body.scanToken || body.token)
    const browserSecret = typeof body.browserSecret === "string" ? body.browserSecret.trim() : ""
    if (!scanToken || !browserSecret) return badFor(req, "参数不正确")

    const record = await findWebQrLoginSession(scanToken, browserSecret)
    if (!record) return badFor(req, "二维码不存在或已失效", 404)
    if (record.expiresAt.getTime() <= Date.now()) return ok({ status: "expired" })
    if (record.consumedAt && !record.webSessionToken) return ok({ status: "consumed" })
    if (!record.userId || !record.confirmedAt) return ok({ status: "pending" })

    const user = await prisma.user.findUnique({ where: { id: record.userId } })
    if (!user || user.deletedAt) return badFor(req, "用户不存在", 404)

    const sessionResult = record.webSessionToken
      ? await prisma.session.findUnique({ where: { token: record.webSessionToken } })
      : await prisma.$transaction(async (tx) => {
          const token = generateToken()
          const consumed = await webQrLoginDelegate(tx).updateMany({
            where: {
              id: record.id,
              browserSecretHash: qrBrowserSecretHash(browserSecret),
              consumedAt: null,
              webSessionToken: null,
              confirmedAt: { not: null },
              expiresAt: { gt: new Date() },
            },
            data: { consumedAt: new Date(), webSessionToken: token },
          })
          if (consumed.count !== 1) return null

          const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)
          return tx.session.create({ data: { token, userId: record.userId as string, expiresAt } })
        })
    if (!sessionResult) return ok({ status: "consumed" })

    return ok({
      status: "authenticated",
      token: sessionResult.token,
      expiresAt: sessionResult.expiresAt.toISOString(),
      userID: user.id,
      email: user.email || "",
      user: { id: user.id, email: user.email || "" },
    })
  } catch (err) {
    console.log("[auth/qr-login/status] error:", err)
    return serverError(req)
  }
}
