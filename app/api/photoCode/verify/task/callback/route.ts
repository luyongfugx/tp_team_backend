import { NextResponse } from "next/server"
import { normalizeVerificationErrorCode } from "@/lib/verificationErrorCodes"
import { bad, ok, readBody } from "@/app/api/_utils/api"
import { prisma } from "@/lib/prisma"
import {
  callbackSecretMatches,
  completedVerificationProgress,
  mergeVerificationProgress,
} from "@/lib/photoVerification"
import { enrichCaptureTeamInfo } from "@/lib/photoRecord"

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
      const progress = mergeVerificationProgress(existing.verificationProgress, body.stage, body.stageStatus)
      await verificationTasks.updateMany({
        where: { taskID, status: { in: ["PENDING", "PROCESSING"] } },
        data: {
          status: "PROCESSING",
          startedAt: existing.startedAt ?? now,
          ...(progress ? { verificationProgress: progress } : {}),
        },
      })
      return ok({ taskID, status: "PROCESSING" })
    }

    if (status === "SUCCEEDED") {
      const rawResult = body.result && typeof body.result === "object" && !Array.isArray(body.result)
        ? body.result as Record<string, unknown>
        : {}
      const result = await enrichCaptureTeamInfo(rawResult, existing.userID)
      const verificationPassed = (result as Record<string, unknown>).verified === true
      const rawResultErrorCode = (result as Record<string, unknown>).errorCode
      const resultErrorCode = rawResultErrorCode == null
        ? null
        : normalizeVerificationErrorCode(rawResultErrorCode).slice(0, 100)
      const effectiveErrorCode = verificationPassed ? null : (resultErrorCode || "500")
      if (effectiveErrorCode) (result as Record<string, unknown>).errorCode = effectiveErrorCode
      const resultErrorMessage = typeof (result as Record<string, unknown>).errorMessage === "string"
        ? String((result as Record<string, unknown>).errorMessage).slice(0, 2000)
        : null
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
          verified: verificationPassed,
          resultObjectKey: typeof body.resultObjectKey === "string" ? body.resultObjectKey.slice(0, 1024) : null,
          errorCode: effectiveErrorCode,
          errorMessage: verificationPassed ? null : resultErrorMessage,
          startedAt: existing.startedAt ?? now,
          completedAt: now,
          verificationProgress: completedVerificationProgress(),
        },
      })
      return ok({ taskID, status: "SUCCEEDED" })
    }

    const failureResult = body.result && typeof body.result === "object" ? body.result : undefined
    const failedProgress = mergeVerificationProgress(existing.verificationProgress, body.stage, "FAILED")
    await verificationTasks.update({
      where: { taskID },
      data: {
        status: "FAILED",
        result: failureResult,
        verified: false,
        errorCode: normalizeVerificationErrorCode(body.errorCode).slice(0, 100),
        errorMessage: typeof body.errorMessage === "string" ? body.errorMessage.slice(0, 2000) : "Verification failed",
        startedAt: existing.startedAt ?? now,
        completedAt: now,
        ...(failedProgress ? { verificationProgress: failedProgress } : {}),
      },
    })
    return ok({ taskID, status: "FAILED" })
  } catch (error) {
    console.log("[photoCode/verify/task/callback] error:", error)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
