import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, ok, readBody, requireTeamManager, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    if (!(await requireTeamManager(groupID, user.id))) return bad("无团队管理权限", 403)
    const invite = await prisma.teamInviteLink.findFirst({ where: { groupID, disabledAt: null } })
    if (invite) return ok({ uuID: invite.uuID })
    const created = await prisma.teamInviteLink.create({ data: { groupID, uuID: randomUUID() } })
    return ok({ uuID: created.uuID })
  } catch (err) {
    console.log("[app/group/invite/link/query] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
