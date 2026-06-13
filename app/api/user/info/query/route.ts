import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { asStringArray, bad, ok, readBody, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const userIDs = asStringArray(body.userID)
    const users = await prisma.user.findMany({
      where: { id: { in: userIDs }, deletedAt: null },
      select: { id: true, userName: true, shortName: true, avatar: true },
    })
    return ok({
      userInfo: users.map((item) => ({
        userID: item.id,
        userName: item.userName,
        shortName: item.shortName,
        avatar: item.avatar,
      })),
    })
  } catch (err) {
    console.log("[app/user/info/query] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
