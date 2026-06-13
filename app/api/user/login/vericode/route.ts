import { NextResponse } from "next/server"
import { createSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { bad, EMAIL_RE, normalizeEmail, ok, readBody } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const body = await readBody(req)
    const email = normalizeEmail(body.email)
    const loginType = Number(body.loginType ?? 0)
    if (!email || !EMAIL_RE.test(email)) return bad("请输入有效的邮箱地址")

    if (loginType === 0 || loginType === 3) {
      const veriCode = typeof body.veriCode === "string" ? body.veriCode.trim() : ""
      const record = await prisma.verificationCode.findFirst({
        where: { email, consumed: false },
        orderBy: { createdAt: "desc" },
      })
      if (!record) return bad("验证码不存在，请重新获取")
      if (record.expiresAt.getTime() < Date.now()) return bad("验证码已过期，请重新获取")
      if (record.code !== veriCode) return bad("验证码错误")
      await prisma.verificationCode.update({ where: { id: record.id }, data: { consumed: true } })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        userName: typeof body.userName === "string" ? body.userName : undefined,
        avatar: typeof body.avatar === "string" ? body.avatar : undefined,
        appInstanceID: typeof body.appInstanceID === "string" ? body.appInstanceID : undefined,
      },
      create: {
        email,
        userName: typeof body.userName === "string" ? body.userName : undefined,
        avatar: typeof body.avatar === "string" ? body.avatar : undefined,
        appInstanceID: typeof body.appInstanceID === "string" ? body.appInstanceID : undefined,
      },
    })

    const { token } = await createSession(
      user.id,
      typeof body.appInstanceID === "string" ? body.appInstanceID : undefined,
    )
    const ownerTeamCount = await prisma.team.count({
      where: { ownerID: user.id, deletedAt: null },
    })
    const firstTeam = await prisma.teamMember.findFirst({
      where: { userID: user.id },
      orderBy: { joinedAt: "asc" },
    })

    return ok({
      userID: user.id,
      userName: user.userName,
      avatar: user.avatar,
      shortName: user.shortName,
      ownerTeamCount,
      token,
      email: user.email,
      isNewUser: !existing,
      groupID: firstTeam?.groupID,
    })
  } catch (err) {
    console.log("[app/user/login/vericode] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
