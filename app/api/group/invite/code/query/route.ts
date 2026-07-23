import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, ok, readBody, requireTeamMember, requireUser, roleIDToRole, roleToID, roleToName } from "@/app/api/_utils/api"

type TeamInviteCodeDelegate = {
  findFirst: (args: unknown) => Promise<{
    code: string
    role: "OWNER" | "ADMIN" | "MEMBER"
    roleID: number
    expiresAt: Date | null
  } | null>
  create: (args: unknown) => Promise<{
    code: string
    role: "OWNER" | "ADMIN" | "MEMBER"
    roleID: number
    expiresAt: Date | null
  }>
}

function teamInviteCode() {
  return (prisma as never as { teamInviteCode: TeamInviteCodeDelegate }).teamInviteCode
}

async function createTeamCode() {
  for (let index = 0; index < 20; index += 1) {
    const code = randomInt(100000, 1000000).toString()
    const existing = await teamInviteCode().findFirst({ where: { code } })
    if (!existing) return code
  }
  throw new Error("生成团队码失败")
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)

    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    if (!(await requireTeamMember(groupID, user.id))) return bad("无团队访问权限", 403)

    const now = new Date()
    const existing = await teamInviteCode().findFirst({
      where: {
        groupID,
        disabledAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      } as never,
      orderBy: { createdAt: "desc" },
    })
    if (existing) {
      return ok({
        teamCode: existing.code,
        role: roleToName(existing.role),
        roleID: roleToID(existing.role),
        expiresAt: existing.expiresAt,
      })
    }

    const role = roleIDToRole(body.roleID)
    const roleID = role === "ADMIN" ? 2 : 3
    const created = await teamInviteCode().create({
      data: {
        groupID,
        code: await createTeamCode(),
        role,
        roleID,
      } as never,
    })

    return ok({
      teamCode: created.code,
      role: roleToName(created.role),
      roleID: roleToID(created.role),
      expiresAt: created.expiresAt,
    })
  } catch (err) {
    console.log("[app/group/invite/code/query] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
