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
    const [projects, photos] = await Promise.all([
      prisma.project.findMany({ where: { groupID, deletedAt: null }, select: { projectName: true }, take: 20 }),
      prisma.photo.findMany({ where: { groupID, deletedAt: null }, select: { location: true, antiFakeCode: true }, take: 20, orderBy: { createdAt: "desc" } }),
    ])
    const words = [...new Set([
      ...projects.map((item) => item.projectName),
      ...photos.flatMap((item) => [item.location, item.antiFakeCode]),
    ].filter((item): item is string => Boolean(item)))]
    return ok({ words })
  } catch (err) {
    console.log("[app/photo/search/recommend] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
