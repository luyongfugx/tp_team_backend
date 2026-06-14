import { NextResponse } from "next/server"
import { createSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { bad, EMAIL_RE, normalizeEmail, ok, readBody, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const uuID = typeof body.uuID === "string" ? body.uuID : ""
    const inviteLinkWay = body.inviteLinkWay === "EMAIL" ? "EMAIL" : "LINK"
    const linkInvite =
      inviteLinkWay === "LINK"
        ? await prisma.teamInviteLink.findFirst({
            where: { groupID, uuID, disabledAt: null, team: { deletedAt: null } },
          })
        : null
    const emailInvite =
      inviteLinkWay === "EMAIL"
        ? await prisma.teamEmailInvite.findFirst({
            where: {
              groupID,
              uuID,
              acceptedAt: null,
              team: { deletedAt: null },
            },
          })
        : null
    const invite = emailInvite ?? linkInvite
    if (!invite) return bad("邀请链接不存在或已失效")
    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) return bad("邀请链接已过期")

    let user = await requireUser(req)
    if (!user) {
      const email = normalizeEmail(body.email)
      if (!email || !EMAIL_RE.test(email)) return bad("请输入有效的邮箱地址")
      const veriCode = typeof body.veriCode === "string" ? body.veriCode.trim() : ""
      const code = await prisma.verificationCode.findFirst({
        where: { email, consumed: false },
        orderBy: { createdAt: "desc" },
      })
      if (!code || code.expiresAt.getTime() < Date.now() || code.code !== veriCode) {
        return bad("验证码错误或已过期")
      }
      await prisma.verificationCode.update({ where: { id: code.id }, data: { consumed: true } })
      user = await prisma.user.upsert({
        where: { email },
        update: {
          userName: typeof body.userName === "string" ? body.userName : undefined,
          avatar: typeof body.avatar === "string" ? body.avatar : undefined,
        },
        create: {
          email,
          userName: typeof body.userName === "string" ? body.userName : undefined,
          avatar: typeof body.avatar === "string" ? body.avatar : undefined,
        },
      })
    }
    if (emailInvite && emailInvite.email !== user.email) return bad("邀请邮箱与当前账号不匹配", 403)

    await prisma.$transaction([
      prisma.teamMember.upsert({
        where: { groupID_userID: { groupID, userID: user.id } },
        update: {},
        create: { groupID, userID: user.id, role: invite.role, roleID: invite.roleID },
      }),
      ...(emailInvite
        ? [
            prisma.teamEmailInvite.update({
              where: { id: emailInvite.id },
              data: { acceptedAt: new Date() },
            }),
          ]
        : []),
    ])
    const { token } = await createSession(
      user.id,
      typeof body.appInstanceID === "string" ? body.appInstanceID : undefined,
    )
    return ok({
      userID: user.id,
      userName: user.userName,
      avatar: user.avatar,
      shortName: user.shortName,
      token,
      email: user.email,
      groupID,
    })
  } catch (err) {
    console.log("[app/group/user/join] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
