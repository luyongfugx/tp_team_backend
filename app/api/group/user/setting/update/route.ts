import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, ok, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    if (!(await requireTeamMember(groupID, user.id))) return bad("无团队访问权限", 403)
    await prisma.teamMember.update({
      where: { groupID_userID: { groupID, userID: user.id } },
      data: { userSettings: Array.isArray(body.settings) ? body.settings : [] },
    })
    const team = await prisma.team.findUnique({ where: { groupID } })
    return ok({ accessControl: team?.accessControl })
  } catch (err) {
    console.log("[app/group/user/setting/update] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
