import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, ok, readBody, requireTeamManager, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const projectID = Number(body.projectID)
    if (!Number.isFinite(projectID)) return bad()
    if (!(await requireTeamManager(groupID, user.id))) return bad("无团队管理权限", 403)
    await prisma.project.update({
      where: { projectID },
      data: {
        projectName: typeof body.projectName === "string" ? body.projectName.trim() : undefined,
        lat: body.lat == null ? undefined : String(body.lat),
        lng: body.lng == null ? undefined : String(body.lng),
        address: typeof body.address === "string" ? body.address : undefined,
        circle: body.circle == null ? undefined : Number(body.circle),
        distanceUnit: typeof body.distanceUnit === "string" ? body.distanceUnit : undefined,
        removeAddress: typeof body.removeAddress === "boolean" ? body.removeAddress : undefined,
      },
    })
    return ok()
  } catch (err) {
    console.log("[app/group/project/update] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
