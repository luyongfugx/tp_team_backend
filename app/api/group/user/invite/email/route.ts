import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendTeamInviteEmail } from "@/lib/mail"
import { asStringArray, bad, EMAIL_RE, normalizeEmail, ok, readBody, requireTeamManager, requireUser, roleIDToRole } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    if (!(await requireTeamManager(groupID, user.id))) return bad("无团队管理权限", 403)
    const team = await prisma.team.findUnique({ where: { groupID }, select: { groupName: true } })
    if (!team) return bad("团队不存在")

    const emails = asStringArray(body.emails).map(normalizeEmail)
    const invalidEmails = emails.filter((email) => !EMAIL_RE.test(email))
    const validEmails = [...new Set(emails.filter((email) => EMAIL_RE.test(email)))]
    const users = await prisma.user.findMany({ where: { email: { in: validEmails } } })
    const existingMembers = await prisma.teamMember.findMany({
      where: { groupID, userID: { in: users.map((item) => item.id) } },
      include: { user: true },
    })
    const alreadyMemberEmails = existingMembers.map((item) => item.user.email)
    const role = roleIDToRole(body.roleID)
    const roleID = role === "ADMIN" ? 2 : 3
    const sendTargetEmails = validEmails.filter((email) => !alreadyMemberEmails.includes(email))
    const inviteData = sendTargetEmails.map((email) => ({
      groupID,
      email,
      role,
      roleID,
      uuID: randomUUID(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }))

    if (inviteData.length > 0) {
      await prisma.$transaction([
        prisma.teamEmailInvite.deleteMany({
          where: {
            groupID,
            email: { in: sendTargetEmails },
          },
        }),
        prisma.teamEmailInvite.createMany({ data: inviteData }),
      ])
    }

    const sendResults = await Promise.all(
      inviteData.map(async (invite) => ({
        email: invite.email,
        result: await sendTeamInviteEmail({
          email: invite.email,
          groupName: team.groupName,
          inviterName: user.userName || user.shortName || user.email,
        }),
      })),
    )
    const succeedSendEmails = sendResults.filter((item) => item.result.ok).map((item) => item.email)
    const failedSendEmails = sendResults.filter((item) => !item.result.ok).map((item) => item.email)

    return ok({
      expiredDays: 7,
      succeedSendEmails,
      failedSendEmails,
      invalidEmails,
      alreadyMemberEmails,
    })
  } catch (err) {
    console.log("[app/group/user/invite/email] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
