import { prisma } from "@/lib/prisma"
import { asStringArray, badFor, ok, readBody, requireTeamManager, requireUser, serverError } from "@/app/api/_utils/api"
import { isSuperAdmin } from "@/app/api/_utils/admin"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return badFor(req, "未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    if (!isSuperAdmin(user) && !(await requireTeamManager(groupID, user.id))) return badFor(req, "无团队管理权限", 403)
    const ids = Array.from(new Set(asStringArray(body.deletedUserIDs))).filter((id) => id && id !== user.id)
    if (ids.length === 0) return ok({ deletedCount: 0, deletedUserIDs: [] })

    const members = await prisma.teamMember.findMany({
      where: { groupID, userID: { in: ids }, role: { not: "OWNER" } },
      select: { userID: true },
    })
    const deletedUserIDs = members.map((member) => member.userID)
    if (deletedUserIDs.length === 0) return ok({ deletedCount: 0, deletedUserIDs: [] })

    const [, deleted] = await prisma.$transaction([
      prisma.projectMember.deleteMany({ where: { groupID, userID: { in: deletedUserIDs } } }),
      prisma.teamMember.deleteMany({
        where: { groupID, userID: { in: deletedUserIDs }, role: { not: "OWNER" } },
      }),
    ])
    return ok({ deletedCount: deleted.count, deletedUserIDs })
  } catch (err) {
    console.log("[app/group/user/delete] error:", err)
    return serverError(req)
  }
}
