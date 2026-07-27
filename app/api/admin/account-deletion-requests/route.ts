import { NextResponse } from "next/server"
import { accountDeletionPayload, accountDeletionRequest } from "@/app/api/account-deletion/_utils/account-deletion"
import { badFor, ok, requireUser } from "@/app/api/_utils/api"
import { isSuperAdmin } from "@/app/api/_utils/admin"

const MAX_PAGE_SIZE = 30

export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return badFor(req, "未授权或登录已过期", 401)
    if (!isSuperAdmin(user)) return badFor(req, "无总管理员权限", 403)

    const url = new URL(req.url)
    const requestedPage = Number(url.searchParams.get("page") || "1")
    const requestedPageSize = Number(url.searchParams.get("pageSize") || String(MAX_PAGE_SIZE))
    const pageSize = Number.isFinite(requestedPageSize) && requestedPageSize > 0 ? Math.min(Math.floor(requestedPageSize), MAX_PAGE_SIZE) : MAX_PAGE_SIZE
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1
    const skip = (page - 1) * pageSize

    const [totalCount, requests] = await Promise.all([
      accountDeletionRequest().count({ where: {} }),
      accountDeletionRequest().findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ])

    return ok({
      requests: requests.map(accountDeletionPayload),
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      },
    })
  } catch (err) {
    console.log("[app/admin/account-deletion-requests] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
