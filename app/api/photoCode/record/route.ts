import { NextResponse } from "next/server"
import { bad, ok, readBody, requireUser } from "@/app/api/_utils/api"
import { enrichCaptureTeamInfo, fetchTrustedPhotoRecord } from "@/lib/photoRecord"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    const body = await readBody(req)
    const photoCode = typeof body.photoCode === "string"
      ? body.photoCode.toUpperCase().replace(/[^A-Z0-9]/g, "")
      : ""
    if (photoCode.length !== 12) return bad("照片码必须是12位数字或大写字母")
    const record = await fetchTrustedPhotoRecord(photoCode)
    if (!record) return bad("未找到该照片码对应的拍摄记录", 404)
    return ok(user ? await enrichCaptureTeamInfo(record, user.id) : record)
  } catch (error) {
    console.log("[photoCode/record] error:", error)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
