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
    const task = await prisma.photoPackageTask.create({
      data: {
        groupID,
        packageType: Number(body.packageType ?? 0),
        packageStatus: 0,
        progress: 0,
        timeZone: typeof body.timeZone === "string" ? body.timeZone : undefined,
        rangeSelected: body.rangeSelected,
        selectedPhotoIDs: body.selectedPhotoIDs,
        unSelectedPhotoIDs: body.unSelectedPhotoIDs,
        filters: body,
        eventParams: body.eventParams,
      },
    })
    return ok({ taskID: task.taskID })
  } catch (err) {
    console.log("[app/photo/package] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
