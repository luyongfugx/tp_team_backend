import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { bad, ok, readBody, requireUser } from "@/app/api/_utils/api"
import { prisma } from "@/lib/prisma"
import {
  publicVerificationTask,
  submitPhotoVerificationTask,
  validateVerificationImageURL,
} from "@/lib/photoVerification"

const verificationTasks = (prisma as unknown as { photoVerificationTask: any }).photoVerificationTask

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const image = validateVerificationImageURL(body.imageUrl ?? body.imageURL, user.id)
    if (!image) return bad("参数不正确")

    const taskID = randomUUID()
    let task = await verificationTasks.create({
      data: {
        taskID,
        userID: user.id,
        imageUrl: image.imageUrl,
        imageObjectKey: image.objectKey,
        status: "PENDING",
      },
    })

    try {
      await submitPhotoVerificationTask(taskID, image.imageUrl)
      await verificationTasks.updateMany({
        where: { taskID, status: "PENDING" },
        data: { status: "PROCESSING", startedAt: new Date() },
      })
      task = await verificationTasks.findUnique({ where: { taskID } })
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1000) : "OCR task submission failed"
      task = await verificationTasks.update({
        where: { taskID },
        data: {
          status: "FAILED",
          errorCode: "ocr_submit_failed",
          errorMessage: message,
          completedAt: new Date(),
        },
      })
    }

    return ok(publicVerificationTask(task))
  } catch (error) {
    console.log("[photoCode/verify/task] error:", error)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
