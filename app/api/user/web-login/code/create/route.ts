import { NextResponse } from "next/server"
import { bad, ok, requireUser, serverError } from "@/app/api/_utils/api"
import { createWebLoginCode, webLoginIdentifierForUser } from "@/lib/web-login-code"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)

    const { code, expiresAt } = await createWebLoginCode(user.id)
    return ok({
      code,
      expiresAt: expiresAt.toISOString(),
      identifier: webLoginIdentifierForUser(user),
      email: user.email || "",
      zaloUserID: user.zaloUserID || "",
      userID: user.id,
    })
  } catch (err) {
    console.log("[app/user/web-login/code/create] error:", err)
    return serverError(req)
  }
}
