import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, ok, readBody, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    if (typeof body.userName !== "string" || !body.userName.trim()) return bad()
    await prisma.user.update({ where: { id: user.id }, data: { userName: body.userName.trim() } })
    return ok()
  } catch (err) {
    console.log("[app/user/name/update] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
