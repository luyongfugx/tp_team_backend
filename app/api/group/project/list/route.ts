import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, jsonSafe, ok, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"

function distanceMeters(lat1: number, lng1: number, lat2?: number | null, lng2?: number | null) {
  if (lat2 == null || lng2 == null) return undefined
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    if (!(await requireTeamMember(groupID, user.id))) return bad("无团队访问权限", 403)
    const currentLat = body.lat == null ? undefined : Number(body.lat)
    const currentLng = body.lng == null ? undefined : Number(body.lng)

    const projects = await prisma.project.findMany({
      where: { groupID, deletedAt: null },
      orderBy: { createdAt: "asc" },
    })

    return ok({
      defaultSelect: projects[0]?.projectID ?? 0,
      projects: jsonSafe(projects.map((project) => {
        const lat = project.lat?.toNumber()
        const lng = project.lng?.toNumber()
        return {
          projectID: project.projectID,
          projectName: project.projectName,
          photoCount: project.photoCount,
          latestPhotoTimestamp: project.latestPhotoTimestamp,
          latestPhotoSmallURL: project.latestPhotoSmallURL,
          addressInfo: {
            lat,
            lng,
            address: project.address,
            circle: project.circle,
            distanceUnit: project.distanceUnit,
            distance: currentLat == null || currentLng == null ? undefined : distanceMeters(currentLat, currentLng, lat, lng),
            removeAddress: project.removeAddress,
          },
          microBind: project.microBind,
        }
      })),
    })
  } catch (err) {
    console.log("[app/group/project/list] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
