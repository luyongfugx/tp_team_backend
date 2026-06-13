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
    await prisma.photoPdfSetting.upsert({
      where: { groupID },
      update: {
        title: typeof body.title === "string" ? body.title : undefined,
        icon: typeof body.icon === "string" ? body.icon : undefined,
        iconOpen: typeof body.iconOpen === "boolean" ? body.iconOpen : undefined,
      },
      create: {
        groupID,
        title: typeof body.title === "string" ? body.title : undefined,
        icon: typeof body.icon === "string" ? body.icon : undefined,
        iconOpen: typeof body.iconOpen === "boolean" ? body.iconOpen : false,
      },
    })
    return ok()
  } catch (err) {
    console.log("[app/photo/pdf/setting/update] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
