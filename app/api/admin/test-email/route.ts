import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateCode } from "@/lib/auth"
import { localeFromRequest } from "@/lib/i18n"
import { sendTeamInviteEmail, sendVerificationEmail } from "@/lib/mail"
import { bad, EMAIL_RE, normalizeEmail, ok, readBody, requireUser } from "@/app/api/_utils/api"
import { isSuperAdmin } from "@/app/api/_utils/admin"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    if (!isSuperAdmin(user)) return bad("无总管理员权限", 403)

    const body = await readBody(req)
    const locale = localeFromRequest(req, body)
    const email = normalizeEmail(body.email)
    if (!email || !EMAIL_RE.test(email)) return bad("请输入有效的邮箱地址")

    const type = typeof body.type === "string" ? body.type : ""
    if (type === "verification") {
      const code = typeof body.code === "string" && /^\d{6}$/.test(body.code) ? body.code : generateCode()
      const result = await sendVerificationEmail(email, code, locale)
      return ok({ type, email, code, result })
    }

    if (type === "invite") {
      const groupID = typeof body.groupID === "string" ? body.groupID : ""
      const team = groupID
        ? await prisma.team.findFirst({
            where: { groupID, deletedAt: null },
            include: { _count: { select: { members: true, photos: true } } },
          })
        : null
      const linkGroupID = team?.groupID || groupID || (typeof body.linkGroupID === "string" && body.linkGroupID.trim()) || "test-team"
      const groupName = team?.groupName || (typeof body.groupName === "string" && body.groupName.trim()) || "Timeprint Team"
      const inviterName = (typeof body.inviterName === "string" && body.inviterName.trim()) || user.userName || user.email
      const inviteCode = typeof body.inviteCode === "string" && /^\d{6}$/.test(body.inviteCode) ? body.inviteCode : generateCode()
      const result = await sendTeamInviteEmail({
        email,
        groupName,
        inviterName,
        inviteCode,
        memberCount: team?._count.members ?? 1,
        photoCount: team?._count.photos ?? 0,
        locale,
      })
      return ok({ type, email, groupID: linkGroupID, inviteCode, result })
    }

    return bad("邮件类型不正确")
  } catch (err) {
    console.log("[app/admin/test-email] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
