import { NextResponse } from "next/server"
import { bad, ok, readBody } from "@/app/api/_utils/api"
import { prisma } from "@/lib/prisma"
import { callbackSecretMatches } from "@/lib/photoVerification"

const verificationTasks = (prisma as unknown as { photoVerificationTask: any }).photoVerificationTask

export async function POST(req: Request) {
  try {
    if (!callbackSecretMatches(req.headers.get("x-callback-secret"))) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const taskID = typeof body.taskId === "string" ? body.taskId.trim() : ""
    const status = body.status
    if (!taskID || !["PROCESSING", "SUCCEEDED", "FAILED"].includes(String(status))) return bad("参数不正确")
    const existing = await verificationTasks.findUnique({ where: { taskID } })
    if (!existing) return bad("任务不存在", 404)

    const now = new Date()
    if (status === "PROCESSING") {
      await verificationTasks.updateMany({
        where: { taskID, status: { in: ["PENDING", "PROCESSING"] } },
        data: { status: "PROCESSING", startedAt: existing.startedAt ?? now },
      })
      return ok({ taskID, status: "PROCESSING" })
    }

    if (status === "SUCCEEDED") {
      const result = body.result && typeof body.result === "object" ? body.result : {}
      const photoCodeBlock = (result as Record<string, unknown>).photoCode
      const photoCode = photoCodeBlock && typeof photoCodeBlock === "object"
        ? String((photoCodeBlock as Record<string, unknown>).recognized ?? "").slice(0, 14)
        : null
      await verificationTasks.update({
        where: { taskID },
        data: {
          status: "SUCCEEDED",
          result,
          photoCode: photoCode || null,
          verified: (result as Record<string, unknown>).verified === true,
          resultObjectKey: typeof body.resultObjectKey === "string" ? body.resultObjectKey.slice(0, 1024) : null,
          errorCode: null,
          errorMessage: null,
          startedAt: existing.startedAt ?? now,
          completedAt: now,
        },
      })
      return ok({ taskID, status: "SUCCEEDED" })
    }

    await verificationTasks.update({
      where: { taskID },
      data: {
        status: "FAILED",
        errorCode: typeof body.errorCode === "string" ? body.errorCode.slice(0, 100) : "ocr_failed",
        errorMessage: typeof body.errorMessage === "string" ? body.errorMessage.slice(0, 2000) : "Verification failed",
        startedAt: existing.startedAt ?? now,
        completedAt: now,
      },
    })
    return ok({ taskID, status: "FAILED" })
  } catch (error) {
    console.log("[photoCode/verify/task/callback] error:", error)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
