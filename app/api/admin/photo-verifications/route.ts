import { NextResponse } from "next/server"
import { badFor, jsonSafe, ok, requireUser } from "@/app/api/_utils/api"
import { isSuperAdmin } from "@/app/api/_utils/admin"
import { prisma } from "@/lib/prisma"
import { localeFromRequest, t } from "@/lib/i18n"

const verificationTasks = (prisma as unknown as { photoVerificationTask: any }).photoVerificationTask
const MAX_PAGE_SIZE = 50

export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return badFor(req, "未授权或登录已过期", 401)
    if (!isSuperAdmin(user)) return badFor(req, "无总管理员权限", 403)

    const url = new URL(req.url)
    const requestedPage = Number(url.searchParams.get("page") || "1")
    const requestedPageSize = Number(url.searchParams.get("pageSize") || "30")
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1
    const pageSize = Number.isFinite(requestedPageSize) && requestedPageSize > 0
      ? Math.min(Math.floor(requestedPageSize), MAX_PAGE_SIZE)
      : 30
    const outcome = url.searchParams.get("outcome") || "all"
    if (!new Set(["all", "success", "failure"]).has(outcome)) return badFor(req, "参数不正确")

    const where = outcome === "success"
      ? { status: "SUCCEEDED", verified: true }
      : outcome === "failure"
        ? { OR: [{ status: "FAILED" }, { status: "SUCCEEDED", verified: false }] }
        : {}
    const [totalCount, tasks] = await Promise.all([
      verificationTasks.count({ where }),
      verificationTasks.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          taskID: true,
          userID: true,
          status: true,
          photoCode: true,
          verified: true,
          errorCode: true,
          errorMessage: true,
          verificationProgress: true,
          createdAt: true,
          startedAt: true,
          completedAt: true,
          user: { select: { id: true, email: true, userName: true, shortName: true } },
        },
      }),
    ])

    return ok(jsonSafe({
      tasks,
      outcome,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      },
    }))
  } catch (error) {
    console.log("[api/admin/photo-verifications] error:", error)
    return NextResponse.json({ error: t(localeFromRequest(req), "common.serverError") }, { status: 500 })
  }
}
