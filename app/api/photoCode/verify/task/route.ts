import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { bad, ok, readBody, requireUser } from "@/app/api/_utils/api"
import { prisma } from "@/lib/prisma"
import {
  initialVerificationProgress,
  publicVerificationTask,
  submitPhotoVerificationTask,
  validateVerificationImageURL,
} from "@/lib/photoVerification"

const verificationTasks = (prisma as unknown as { photoVerificationTask: any }).photoVerificationTask

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    const body = await readBody(req)
    const image = validateVerificationImageURL(body.imageUrl ?? body.imageURL)
    if (!image) return bad("参数不正确")

    const taskID = randomUUID()
    let task = await verificationTasks.create({
      data: {
        taskID,
        userID: user?.id ?? null,
        imageUrl: image.imageUrl,
        imageObjectKey: image.objectKey,
        status: "PENDING",
        verificationProgress: initialVerificationProgress(),
      },
    })

    try {
      await submitPhotoVerificationTask(taskID, image.imageUrl)
      // OCR acknowledges only after accepting the background task. Its progress
      // callback owns PROCESSING/startedAt; return the persisted initial snapshot
      // without an extra update + read on the creation critical path.
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1000) : "OCR task submission failed"
      await verificationTasks.updateMany({
        // An acknowledgement can fail after OCR already called back successfully.
        where: { taskID, status: "PENDING" },
        data: {
          status: "FAILED",
          errorCode: "502",
          errorMessage: message,
          verificationProgress: {
            currentStage: "PHOTO_CODE",
            stages: [
              { key: "PHOTO_CODE", status: "FAILED" },
              { key: "TIME", status: "PENDING" },
              { key: "ADDRESS", status: "PENDING" },
              { key: "PHOTO_INFO", status: "PENDING" },
            ],
            updatedAt: Date.now(),
          },
          completedAt: new Date(),
        },
      })
      task = await verificationTasks.findUnique({ where: { taskID } })
    }

    return ok(publicVerificationTask(task))
  } catch (error) {
    console.log("[photoCode/verify/task] error:", error)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
