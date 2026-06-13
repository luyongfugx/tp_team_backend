import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { asStringArray, bad, EMAIL_RE, normalizeEmail, ok, readBody, requireTeamManager, requireUser, roleIDToRole } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    if (!(await requireTeamManager(groupID, user.id))) return bad("无团队管理权限", 403)

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
    const succeedSendEmails = validEmails.filter((email) => !alreadyMemberEmails.includes(email))

    await prisma.teamEmailInvite.createMany({
      data: succeedSendEmails.map((email) => ({
        groupID,
        email,
        role,
        roleID,
        uuID: randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })),
    })

    return ok({
      expiredDays: 7,
      succeedSendEmails,
      failedSendEmails: [],
      invalidEmails,
      alreadyMemberEmails,
    })
  } catch (err) {
    console.log("[app/group/user/invite/email] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
