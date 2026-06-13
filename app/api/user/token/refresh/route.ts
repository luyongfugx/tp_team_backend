import { NextResponse } from "next/server"
import { createSession, getTokenFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { bad, ok, readBody, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const oldToken = getTokenFromRequest(req)
    const { token } = await createSession(
      user.id,
      typeof body.appInstanceID === "string" ? body.appInstanceID : undefined,
    )
    if (oldToken) await prisma.session.deleteMany({ where: { token: oldToken } }).catch(() => {})
    return ok({ token })
  } catch (err) {
    console.log("[app/user/token/refresh] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
