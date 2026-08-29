import { NextResponse } from "next/server"
import { badFor, jsonSafe, ok, requireUser } from "@/app/api/_utils/api"
import { isSuperAdmin } from "@/app/api/_utils/admin"
import { prisma } from "@/lib/prisma"
import { localeFromRequest, t } from "@/lib/i18n"
import { signedVerificationImageURL } from "@/lib/cosSignedUrl"
import { safeReadPhotoJSON, verificationFailureAnalysis } from "@/lib/adminPhotoVerification"

const verificationTasks = (prisma as unknown as { photoVerificationTask: any }).photoVerificationTask

export async function GET(req: Request, context: { params: Promise<{ taskID: string }> }) {
  try {
    const user = await requireUser(req)
    if (!user) return badFor(req, "未授权或登录已过期", 401)
    if (!isSuperAdmin(user)) return badFor(req, "无总管理员权限", 403)
    const { taskID } = await context.params
    if (!taskID || taskID.length > 100) return badFor(req, "参数不正确")

    const task = await verificationTasks.findUnique({
      where: { taskID },
      include: { user: { select: { id: true, email: true, userName: true, shortName: true } } },
    })
    if (!task) return badFor(req, "任务不存在", 404)

    const taskRecord = task as Record<string, unknown>
    const resultRecord = task.result && typeof task.result === "object" && !Array.isArray(task.result)
      ? task.result as Record<string, unknown>
      : null
    const resultPhotoCode = resultRecord?.photoCode && typeof resultRecord.photoCode === "object" && !Array.isArray(resultRecord.photoCode)
      ? String((resultRecord.photoCode as Record<string, unknown>).recognized || "")
      : ""
    const photoCode = String(task.photoCode || resultPhotoCode).trim().toUpperCase()
    const sourcePrefix = process.env.COS_SOURCE_PREFIX?.trim().replace(/^\/+|\/+$/g, "") || ""
    const verifiedPrefix = process.env.COS_VERIFIED_PREFIX?.trim().replace(/^\/+|\/+$/g, "") || ""
    const sourceObjectKey = photoCode ? `${sourcePrefix ? `${sourcePrefix}/` : ""}${photoCode}.json` : null
    const verifyObjectKey = task.resultObjectKey || (photoCode
      ? `${verifiedPrefix ? `${verifiedPrefix}/` : ""}${photoCode}_verified.json`
      : null)
    const [sourceJSON, verifyJSON] = await Promise.all([
      safeReadPhotoJSON(sourceObjectKey),
      safeReadPhotoJSON(verifyObjectKey),
    ])
    let imageURL: string | null = null
    let imageError: string | null = null
    try {
      imageURL = signedVerificationImageURL(task.imageObjectKey, 900)
    } catch (error) {
      imageError = error instanceof Error ? error.message : "生成验真图片地址失败"
    }

    return ok(jsonSafe({
      task,
      image: { objectKey: task.imageObjectKey, url: imageURL, error: imageError },
      sourceJSON,
      verifyJSON,
      analysis: verificationFailureAnalysis(taskRecord),
    }))
  } catch (error) {
    console.log("[api/admin/photo-verifications/detail] error:", error)
    return NextResponse.json({ error: t(localeFromRequest(req), "common.serverError") }, { status: 500 })
  }
}
