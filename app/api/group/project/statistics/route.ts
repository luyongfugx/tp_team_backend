import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, jsonSafe, ok, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const projectID = Number(body.projectID ?? 0)
    if (!(await requireTeamMember(groupID, user.id))) return bad("无团队访问权限", 403)
    const where = { groupID, deletedAt: null, ...(projectID ? { projectID } : {}) }
    const total = await prisma.photo.count({ where })
    const contributors = await prisma.photo.groupBy({
      by: ["userID"],
      where,
      _count: { photoID: true },
      orderBy: { _count: { photoID: "desc" } },
      take: 20,
    })
    const users = await prisma.user.findMany({
      where: { id: { in: contributors.map((item) => item.userID) } },
      select: { id: true, userName: true, shortName: true, avatar: true },
    })
    return ok({
      statistics: jsonSafe({
        overView: { photoCount: total },
        contributors: contributors.map((item) => {
          const contributor = users.find((found) => found.id === item.userID)
          return {
            userID: item.userID,
            userName: contributor?.userName,
            shortName: contributor?.shortName,
            avatar: contributor?.avatar,
            photoCount: item._count.photoID,
          }
        }),
      }),
    })
  } catch (err) {
    console.log("[app/group/project/statistics] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
