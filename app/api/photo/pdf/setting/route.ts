import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, ok, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    if (!(await requireTeamMember(body.groupID, user.id))) return bad("无团队访问权限", 403)
    const setting = await prisma.photoPdfSetting.findUnique({
      where: { groupID: String(body.groupID) },
    })
    return ok({
      title: setting?.title ?? "",
      icon: setting?.icon ?? "",
      iconOpen: setting?.iconOpen ?? false,
    })
  } catch (err) {
    console.log("[app/photo/pdf/setting] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
