import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, canManage, ok, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const photoID = typeof body.photoID === "string" ? body.photoID : ""
    const member = await requireTeamMember(groupID, user.id)
    if (!member) return bad("无团队访问权限", 403)
    const photo = await prisma.photo.findFirst({ where: { groupID, photoID, deletedAt: null } })
    if (!photo) return bad("照片不存在")
    if (!canManage(member) && photo.userID !== user.id) return bad("无照片删除权限", 403)
    await prisma.photo.update({ where: { photoID }, data: { deletedAt: new Date() } })
    return ok()
  } catch (err) {
    console.log("[app/photo/delete] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
