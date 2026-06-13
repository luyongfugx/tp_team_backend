import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, ok, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"
import { selectedPhotoWhere } from "@/app/api/_utils/photo"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    if (!(await requireTeamMember(groupID, user.id))) return bad("无团队访问权限", 403)
    const photoCount = await prisma.photo.count({ where: selectedPhotoWhere(body, groupID) })
    const shareKey = randomUUID()
    const origin = new URL(req.url).origin
    const url = `${origin}/share/${shareKey}`
    await prisma.photoShare.create({
      data: {
        groupID,
        shareKey,
        url,
        keepUpdate: Boolean(body.keepUpdate),
        willExpire: Boolean(body.willExpire),
        expiresAt: body.willExpire ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined,
        fromPlace: typeof body.fromPlace === "string" ? body.fromPlace : undefined,
        customMsg: typeof body.customMsg === "string" ? body.customMsg : undefined,
        rangeSelected: body.rangeSelected,
        selectedPhotoIDs: body.selectedPhotoIDs,
        unSelectedPhotoIDs: body.unSelectedPhotoIDs,
        filters: body,
        photoCount,
        createdByUserID: user.id,
      },
    })
    return ok({ url, photoCount, successEmails: body.shareEmails ?? [], failEmails: [], shareKey })
  } catch (err) {
    console.log("[app/photo/share/v1] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
