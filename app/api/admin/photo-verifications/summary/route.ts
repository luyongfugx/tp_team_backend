import { NextResponse } from "next/server"
import { PhotoVerificationTaskStatus } from "@prisma/client"
import { badFor, requireUser } from "@/app/api/_utils/api"
import { isSuperAdmin } from "@/app/api/_utils/admin"
import { prisma } from "@/lib/prisma"
import { localeFromRequest, t } from "@/lib/i18n"
import { summarizeVerificationGroups, verificationSummaryDates } from "@/lib/photo-verification-summary"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return badFor(req, "未授权或登录已过期", 401)
    if (!isSuperAdmin(user)) return badFor(req, "无总管理员权限", 403)
    const dates = verificationSummaryDates(new URL(req.url).searchParams.get("date"))
    if (!dates) return badFor(req, "参数不正确", 400)
    const group = (gte: Date, lt: Date) => prisma.photoVerificationTask.groupBy({
      by: ["status", "verified"],
      where: { createdAt: { gte, lt }, status: { in: Object.values(PhotoVerificationTaskStatus) } },
      _count: { _all: true },
    })
    const [current, previous] = await prisma.$transaction([
      group(dates.start, dates.end), group(dates.previousStart, dates.previousEnd),
    ])
    return NextResponse.json({
      date: dates.date, previousDate: dates.previousDate,
      timeZone: "Asia/Shanghai", basis: "createdAt", scope: "all_channels",
      current: summarizeVerificationGroups(current), previous: summarizeVerificationGroups(previous),
      generatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "private, no-store" } })
  } catch {
    console.error("[api/admin/photo-verifications/summary] failed to read daily aggregates")
    return NextResponse.json({ error: t(localeFromRequest(req), "common.serverError") }, { status: 500 })
  }
}
