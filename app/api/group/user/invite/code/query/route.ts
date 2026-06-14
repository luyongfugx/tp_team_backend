import { NextResponse } from "next/server"
import type { TeamRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { readBody, roleToID, roleToName } from "@/app/api/_utils/api"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
}

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders })
}

function normalizeInviteCode(value: unknown) {
  if (typeof value !== "string") return ""
  const code = value.trim()
  return /^\d{6}$/.test(code) ? code : ""
}

type UserSummary = {
  id: string
  userName: string | null
  shortName: string | null
  avatar: string | null
  email: string
}

type InviteWithTeam = {
  id: string
  groupID: string
  email: string
  inviterID?: string | null
  role: TeamRole
  roleID: number
  uuID: string | null
  inviteCode: string | null
  acceptedAt: Date | null
  expiresAt: Date | null
  createdAt: Date
  team: {
    groupID: string
    groupName: string
    deletedAt: Date | null
    owner: UserSummary
    _count: { members: number }
  }
}

async function queryInvite(code: string) {
  const invite = (await prisma.teamEmailInvite.findFirst({
    where: { inviteCode: code } as never,
    include: {
      team: {
        include: {
          owner: { select: { id: true, userName: true, shortName: true, avatar: true, email: true } },
          _count: { select: { members: true } },
        },
      },
    },
  })) as InviteWithTeam | null
  if (!invite || invite.team.deletedAt) return null

  const inviter = invite.inviterID
    ? await prisma.user.findUnique({
        where: { id: invite.inviterID },
        select: { id: true, userName: true, shortName: true, avatar: true, email: true },
      })
    : null
  const invitedUser = await prisma.user.findUnique({
    where: { email: invite.email },
    select: { id: true, userName: true, shortName: true, avatar: true, email: true },
  })
  const now = Date.now()
  const isExpired = Boolean(invite.expiresAt && invite.expiresAt.getTime() <= now)
  const isAccepted = Boolean(invite.acceptedAt)

  return {
    inviteCode: invite.inviteCode,
    inviteLinkWay: "EMAIL",
    role: roleToName(invite.role),
    roleID: roleToID(invite.role),
    isExpired,
    isAccepted,
    canJoin: !isExpired && !isAccepted,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt,
    inviter: inviter ?? invite.team.owner,
    invitedUser: invitedUser ?? {
      id: null,
      userName: null,
      shortName: null,
      avatar: null,
      email: invite.email,
    },
    team: {
      groupID: invite.team.groupID,
      groupName: invite.team.groupName,
      memberNum: invite.team._count.members,
      owner: invite.team.owner,
    },
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: Request) {
  try {
    const code = normalizeInviteCode(new URL(req.url).searchParams.get("code"))
    if (!code) return json({ error: "请输入有效的邀请码" }, 400)

    const invite = await queryInvite(code)
    if (!invite) return json({ error: "邀请不存在或已失效" }, 404)
    return json({ invite })
  } catch (err) {
    console.log("[app/group/user/invite/code/query] error:", err)
    return json({ error: "服务器错误，请稍后再试" }, 500)
  }
}

export async function POST(req: Request) {
  try {
    const body = await readBody(req)
    const code = normalizeInviteCode(body.code)
    if (!code) return json({ error: "请输入有效的邀请码" }, 400)

    const invite = await queryInvite(code)
    if (!invite) return json({ error: "邀请不存在或已失效" }, 404)
    return json({ invite })
  } catch (err) {
    console.log("[app/group/user/invite/code/query] error:", err)
    return json({ error: "服务器错误，请稍后再试" }, 500)
  }
}
