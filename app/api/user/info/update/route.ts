import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, EMAIL_RE, normalizeEmail, ok, readBody, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const email = normalizeEmail(body.email)
    if (body.email != null && (!email || !EMAIL_RE.test(email))) return bad("请输入有效的邮箱地址")
    if (email && email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing && existing.id !== user.id) return bad("邮箱已被其他账号使用")
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        userName: typeof body.userName === "string" ? body.userName.trim() : undefined,
        avatar: typeof body.avatar === "string" ? body.avatar : undefined,
        email: email && email !== user.email ? email : undefined,
      },
    })
    return ok({
      userID: updated.id,
      userName: updated.userName,
      avatar: updated.avatar,
      shortName: updated.shortName,
      email: updated.email,
    })
  } catch (err) {
    console.log("[app/user/info/update] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
