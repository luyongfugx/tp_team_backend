import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, ok, readBody, requireTeamManager, requireUser, roleIDToRole, roleToID } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const targetUserID = typeof body.userID === "string" ? body.userID : ""
    const manager = await requireTeamManager(groupID, user.id)
    if (!manager || manager.role !== "OWNER") return bad("只有创建者可以调整团队角色", 403)
    if (targetUserID === user.id) return bad("不能修改自己的创建者角色")
    if (body.roleID !== 2 && body.roleID !== "2" && body.roleID !== 3 && body.roleID !== "3") {
      return bad("只能设置为管理员或普通成员")
    }
    const role = roleIDToRole(body.roleID)
    const targetMember = await prisma.teamMember.findUnique({
      where: { groupID_userID: { groupID, userID: targetUserID } },
      select: { role: true },
    })
    if (!targetMember) return bad("成员不存在")
    if (targetMember.role === "OWNER") return bad("转让创建者请使用团队转让接口")

    const roleID = roleToID(role)
    await prisma.$transaction([
      prisma.teamMember.update({
        where: { groupID_userID: { groupID, userID: targetUserID } },
        data: { role, roleID },
      }),
      prisma.projectMember.updateMany({
        where: { groupID, userID: targetUserID },
        data: { role, roleID },
      }),
    ])
    return ok({ userID: targetUserID, role, roleID })
  } catch (err) {
    console.log("[app/group/user/role/update] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
