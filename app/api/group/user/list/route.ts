import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, jsonSafe, ok, readBody, roleToID, roleToName, requireTeamMember, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    if (!(await requireTeamMember(groupID, user.id))) return bad("无团队访问权限", 403)
    const members = await prisma.teamMember.findMany({
      where: { groupID },
      include: { user: true },
      orderBy: { joinedAt: "asc" },
    })
    return ok({
      users: jsonSafe(members.map((member) => ({
        userID: member.userID,
        userName: member.user.userName,
        shortName: member.user.shortName,
        avatar: member.user.avatar,
        role: roleToName(member.role),
        roleID: roleToID(member.role),
        photoCount: member.photoCount,
        latestPhotoTimeInterval: member.latestPhotoTimeInterval,
        latestPhotoTimestamp: member.latestPhotoTimestamp,
        latestPhotoSmallURL: member.latestPhotoSmallURL,
      }))),
    })
  } catch (err) {
    console.log("[app/group/user/list] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
