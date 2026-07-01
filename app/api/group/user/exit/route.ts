import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, ok, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const member = await requireTeamMember(groupID, user.id)
    if (!member) return bad("无团队访问权限", 403)
    if (member.role === "OWNER") return bad("创建者需要先转让团队")
    await prisma.$transaction([
      prisma.projectMember.deleteMany({ where: { groupID, userID: user.id } }),
      prisma.teamMember.delete({ where: { groupID_userID: { groupID, userID: user.id } } }),
    ])
    return ok()
  } catch (err) {
    console.log("[app/group/user/exit] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
