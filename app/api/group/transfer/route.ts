import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, ok, readBody, requireTeamManager, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const newOwnerID = typeof body.newOwnerID === "string" ? body.newOwnerID : ""
    const member = await requireTeamManager(groupID, user.id)
    if (!member || member.role !== "OWNER") return bad("只有创建者可以转让团队", 403)
    const target = await prisma.teamMember.findUnique({ where: { groupID_userID: { groupID, userID: newOwnerID } } })
    if (!target) return bad("新创建者不是团队成员")
    await prisma.$transaction([
      prisma.team.update({ where: { groupID }, data: { ownerID: newOwnerID } }),
      prisma.teamMember.update({ where: { groupID_userID: { groupID, userID: user.id } }, data: { role: "ADMIN", roleID: 2 } }),
      prisma.teamMember.update({ where: { groupID_userID: { groupID, userID: newOwnerID } }, data: { role: "OWNER", roleID: 1 } }),
    ])
    return ok()
  } catch (err) {
    console.log("[app/group/transfer] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
