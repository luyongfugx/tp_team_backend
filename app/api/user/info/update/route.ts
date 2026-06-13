import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, ok, readBody, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        userName: typeof body.userName === "string" ? body.userName.trim() : undefined,
        avatar: typeof body.avatar === "string" ? body.avatar : undefined,
      },
    })
    return ok()
  } catch (err) {
    console.log("[app/user/info/update] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
