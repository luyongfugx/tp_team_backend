import { NextResponse } from "next/server"
import type { TeamMember, TeamRole, User } from "@prisma/client"
import { authenticate } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type AuthedUser = User

export function ok(data: Record<string, unknown> = {}) {
  return NextResponse.json(data)
}

export function bad(message = "参数不正确", status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function readBody(req: Request) {
  try {
    return (await req.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function requireUser(req: Request) {
  const result = await authenticate(req)
  return result?.user ?? null
}

export function normalizeEmail(email: unknown) {
  return typeof email === "string" ? email.toLowerCase().trim() : ""
}

export function roleIDToRole(roleID: unknown): TeamRole {
  if (roleID === 1 || roleID === "1") return "OWNER"
  if (roleID === 2 || roleID === "2") return "ADMIN"
  return "MEMBER"
}

export function roleToID(role: TeamRole) {
  if (role === "OWNER") return 1
  if (role === "ADMIN") return 2
  return 3
}

export function roleToName(role: TeamRole) {
  if (role === "OWNER") return "创建者"
  if (role === "ADMIN") return "管理员"
  return "普通成员"
}

export function canManage(member: Pick<TeamMember, "role"> | null | undefined) {
  return member?.role === "OWNER" || member?.role === "ADMIN"
}

export async function getTeamMember(groupID: unknown, userID: string) {
  if (typeof groupID !== "string" || !groupID) return null
  return prisma.teamMember.findUnique({
    where: { groupID_userID: { groupID, userID } },
  })
}

export async function requireTeamMember(groupID: unknown, userID: string) {
  const member = await getTeamMember(groupID, userID)
  if (!member) return null
  return member
}

export async function requireTeamManager(groupID: unknown, userID: string) {
  const member = await getTeamMember(groupID, userID)
  if (!canManage(member)) return null
  return member
}

export function asStringArray(value: unknown) {
  if (typeof value === "string") return [value]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

export function asNumberArray(value: unknown) {
  if (typeof value === "number" || typeof value === "string") {
    const numberValue = Number(value)
    return Number.isFinite(numberValue) ? [numberValue] : []
  }
  if (!Array.isArray(value)) return []
  return value.map(Number).filter((item) => Number.isFinite(item))
}

export function pageArgs(body: Record<string, unknown>) {
  const pageIndex = Math.max(Number(body.pageIndex ?? 1), 1)
  const pageSize = Math.min(Math.max(Number(body.pageSize ?? 20), 1), 100)
  return { skip: (pageIndex - 1) * pageSize, take: pageSize }
}

export function rangeWhere(value: unknown) {
  if (!value || typeof value !== "object") return undefined
  const range = value as { startTimeStamp?: unknown; endTimeStamp?: unknown }
  const start = range.startTimeStamp == null ? undefined : BigInt(Number(range.startTimeStamp))
  const end = range.endTimeStamp == null ? undefined : BigInt(Number(range.endTimeStamp))
  if (start == null && end == null) return undefined
  return { gte: start, lte: end }
}

export function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, item) => {
      if (typeof item === "bigint") return Number(item)
      if (item && typeof item === "object" && typeof item.toNumber === "function") {
        return item.toNumber()
      }
      return item
    }),
  )
}
