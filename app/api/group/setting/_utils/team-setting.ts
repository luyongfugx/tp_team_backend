import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const TEAM_SETTING_NAME_RE = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/

type TeamSettingRecord = {
  id: string
  groupID: string
  name: string
  value: Prisma.JsonValue | null
  createdAt: Date
  updatedAt: Date
}

type TeamSettingDelegate = {
  findMany: (args: unknown) => Promise<TeamSettingRecord[]>
  findUnique: (args: unknown) => Promise<TeamSettingRecord | null>
  create: (args: unknown) => Promise<TeamSettingRecord>
  upsert: (args: unknown) => Promise<TeamSettingRecord>
  deleteMany: (args: unknown) => Promise<unknown>
}

export function teamSetting() {
  return (prisma as never as { teamSetting: TeamSettingDelegate }).teamSetting
}

export function settingValueInput(value: unknown) {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue)
}

export function normalizeSettingName(value: unknown) {
  if (typeof value !== "string") return ""
  return value.trim()
}

export function isValidSettingName(name: string) {
  return TEAM_SETTING_NAME_RE.test(name)
}

export function settingPayload(setting: TeamSettingRecord) {
  return {
    id: setting.id,
    groupID: setting.groupID,
    name: setting.name,
    value: setting.value,
    createdAt: setting.createdAt,
    updatedAt: setting.updatedAt,
  }
}

export function settingPayloads(settings: TeamSettingRecord[]) {
  return settings.map(settingPayload)
}

export function settingOk(data: Record<string, unknown> = {}) {
  return NextResponse.json({
    code: 200,
    message: "操作成功",
    data,
  })
}

export function settingError(message = "参数不正确", code = 400, status = code) {
  return NextResponse.json(
    {
      code,
      message,
      data: null,
    },
    { status },
  )
}

export function settingServerError() {
  return settingError("服务器错误，请稍后再试", 500)
}
