import { NextResponse } from "next/server"
import { bad, ok, readBody, requireUser } from "@/app/api/_utils/api"
import { prisma } from "@/lib/prisma"
import { failedVerificationProgress } from "@/lib/photoVerification"

const verificationTasks = (prisma as unknown as { photoVerificationTask: any }).photoVerificationTask

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)

    const body = await readBody(req)
    const taskID = typeof body.taskID === "string" ? body.taskID.trim() : ""
    if (!taskID || taskID.length > 100) return bad("参数不正确")

    const task = await verificationTasks.findFirst({ where: { taskID, userID: user.id } })
    if (!task) return bad("任务不存在", 404)

    const updated = await verificationTasks.updateMany({
      where: {
        taskID,
        userID: user.id,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      data: {
        status: "FAILED",
        verified: false,
        errorCode: "504",
        errorMessage: "Verification timed out on the client",
        verificationProgress: failedVerificationProgress(task.verificationProgress),
        completedAt: new Date(),
      },
    })

    return ok({ taskID, status: updated.count > 0 ? "FAILED" : task.status })
  } catch (error) {
    console.log("[photoCode/verify/task/timeout] error:", error)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
