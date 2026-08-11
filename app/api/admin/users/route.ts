import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { badFor, jsonSafe, ok, requireUser } from "@/app/api/_utils/api"
import { isSuperAdmin } from "@/app/api/_utils/admin"
import { localeFromRequest, t } from "@/lib/i18n"

const MAX_PAGE_SIZE = 30
const USER_LIST_SELECT = {
  id: true,
  email: true,
  userName: true,
  shortName: true,
  zaloUserID: true,
  avatar: true,
  platform: true,
  appVersion: true,
  countryCode: true,
  appLan: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as never

function paging(url: URL) {
  const requestedPage = Number(url.searchParams.get("page") || "1")
  const requestedPageSize = Number(url.searchParams.get("pageSize") || String(MAX_PAGE_SIZE))
  const pageSize = Number.isFinite(requestedPageSize) && requestedPageSize > 0 ? Math.min(Math.floor(requestedPageSize), MAX_PAGE_SIZE) : MAX_PAGE_SIZE
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1
  return { page, pageSize, skip: (page - 1) * pageSize }
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return badFor(req, "未授权或登录已过期", 401)
    if (!isSuperAdmin(user)) return badFor(req, "无总管理员权限", 403)

    const url = new URL(req.url)
    const { page, pageSize, skip } = paging(url)
    const search = (url.searchParams.get("search") || "").trim()
    const where = search
      ? ({
          OR: [
            { id: { contains: search } },
            { email: { contains: search } },
            { userName: { contains: search } },
            { shortName: { contains: search } },
            { googleUserID: { contains: search } },
            { appleUserID: { contains: search } },
            { zaloUserID: { contains: search } },
          ],
        } as never)
      : ({ } as never)

    const [totalCount, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: USER_LIST_SELECT,
      }),
    ])

    return ok(
      jsonSafe({
        users,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
        },
        search,
      }),
    )
  } catch (err) {
    console.log("[app/admin/users] error:", err)
    return NextResponse.json({ error: t(localeFromRequest(req), "common.serverError") }, { status: 500 })
  }
}
