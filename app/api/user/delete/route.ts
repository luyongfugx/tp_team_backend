import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, ok, requireUser } from "@/app/api/_utils/api"
import { deleteUserData } from "@/app/api/_utils/delete"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    await prisma.$transaction((tx) => deleteUserData(tx, user))
    return ok()
  } catch (err) {
    console.log("[app/user/delete] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
