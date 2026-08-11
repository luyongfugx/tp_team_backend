import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { badFor, jsonSafe, ok, requireUser } from "@/app/api/_utils/api"
import { isSuperAdmin } from "@/app/api/_utils/admin"
import { localeFromRequest, t } from "@/lib/i18n"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(req: Request, context: RouteContext) {
  try {
    const adminUser = await requireUser(req)
    if (!adminUser) return badFor(req, "未授权或登录已过期", 401)
    if (!isSuperAdmin(adminUser)) return badFor(req, "无总管理员权限", 403)

    const { id } = await context.params
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            ownedTeams: true,
            teamMemberships: true,
            projectMemberships: true,
            photos: true,
            sessions: true,
          },
        },
      },
    })
    if (!user) return badFor(req, "用户不存在", 404)

    return ok(jsonSafe({ user }))
  } catch (err) {
    console.log("[app/admin/users/[id]] error:", err)
    return NextResponse.json({ error: t(localeFromRequest(req), "common.serverError") }, { status: 500 })
  }
}
