import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import { generateCode } from "@/lib/auth"
import { localeFromRequest } from "@/lib/i18n"
import { sendTeamInviteEmail } from "@/lib/mail"
import { asStringArray, bad, EMAIL_RE, normalizeEmail, ok, readBody, requireTeamManager, requireUser, roleIDToRole } from "@/app/api/_utils/api"

async function createInviteCode() {
  for (let index = 0; index < 20; index += 1) {
    const code = generateCode()
    const existingInvite = await prisma.teamEmailInvite.findFirst({
      where: { inviteCode: code },
      select: { id: true },
    })
    if (!existingInvite) return code
  }
  throw new Error("生成邀请码失败")
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const locale = localeFromRequest(req, body)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    if (!(await requireTeamManager(groupID, user.id))) return bad("无团队管理权限", 403)
    const team = await prisma.team.findFirst({
      where: { groupID, deletedAt: null },
      select: {
        groupName: true,
        _count: { select: { members: true, photos: true } },
      },
    })
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
    const requestedRole = roleIDToRole(body.roleID)
    const role = requestedRole === "ADMIN" ? "ADMIN" : "MEMBER"
    const roleID = role === "ADMIN" ? 2 : 3
    const targetEmails = validEmails.filter((email) => !alreadyMemberEmails.includes(email))
    const existingUserEmails = new Set(users.map((item) => item.email))
    const createdUserEmails: string[] = []
    const joinedEmails: string[] = []
    const inviteCodes: Record<string, string> = {}
    const acceptedAt = new Date()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    if (validEmails.length > 0) {
      await prisma.teamEmailInvite.deleteMany({
        where: { groupID, email: { in: validEmails } },
      })
    }

    for (const email of targetEmails) {
      const inviteCode = await createInviteCode()
      const targetUser = await prisma.user.upsert({
        where: { email },
        update: { deletedAt: null },
        create: { email },
      })
      if (!existingUserEmails.has(email)) createdUserEmails.push(email)

      await prisma.teamMember.upsert({
        where: { groupID_userID: { groupID, userID: targetUser.id } },
        update: {},
        create: { groupID, userID: targetUser.id, role, roleID },
      })
      await prisma.teamEmailInvite.create({
        data: {
          groupID,
          email,
          inviterID: user.id,
          role,
          roleID,
          uuID: randomUUID(),
          inviteCode,
          acceptedAt,
          expiresAt,
        },
      })
      inviteCodes[email] = inviteCode
      joinedEmails.push(email)
    }

    const sendResults = await Promise.all(
      joinedEmails.map(async (email) => ({
        email,
        result: await sendTeamInviteEmail({
          email,
          groupName: team.groupName,
          inviterName: user.userName || user.shortName || user.email,
          inviteCode: inviteCodes[email],
          memberCount: team._count.members + joinedEmails.length,
          photoCount: team._count.photos,
          locale,
        }),
      })),
    )
    const succeedSendEmails = sendResults.filter((item) => item.result.ok).map((item) => item.email)
    const failedSendEmails = sendResults.filter((item) => !item.result.ok).map((item) => item.email)

    return ok({
      succeedSendEmails,
      failedSendEmails,
      invalidEmails,
      alreadyMemberEmails,
      joinedEmails,
      createdUserEmails,
      inviteCodes,
    })
  } catch (err) {
    console.log("[app/group/user/invite/email] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
