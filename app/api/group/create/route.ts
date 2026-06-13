import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, jsonSafe, ok, readBody, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    if (typeof body.groupName !== "string" || !body.groupName.trim()) return bad()

    const team = await prisma.group.create({
      data: {
        groupName: body.groupName.trim(),
        ownerID: user.id,
        members: { create: { userID: user.id, role: "OWNER", roleID: 1 } },
      },
      include: { _count: { select: { members: true } }, projects: true },
    })

    return ok({
      groupInfo: jsonSafe({
        groupID: team.groupID,
        groupName: team.groupName,
        role: "创建者",
        roleID: 1,
        userSettings: null,
        projects: team.projects,
        memberNum: team._count.members,
        memberSubscriptionInfo: team.memberSubscriptionInfo,
        accessControl: team.accessControl,
        syncNum: team.syncNum,
        isNew: team.isNew,
      }),
    })
  } catch (err) {
    console.log("[app/group/create] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
