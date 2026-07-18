import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { badFor, readBody, requireTeamMember, requireUser, serverError } from "@/app/api/_utils/api"
import { isSuperAdmin } from "@/app/api/_utils/admin"
import { resolvePhotoURL } from "@/app/web/photo-url"

function safeFilename(value: string | null | undefined, fallback: string) {
  const name = (value || fallback).replace(/[\\/:*?"<>|]+/g, "_").trim()
  return name || fallback
}

function safeZipPath(value: string) {
  return value.replace(/^\/+/, "").replace(/\/+/g, "/")
}

function photoDateFolder(photo: { timestamp: bigint | number; takePhotoFormatTime: string; createdAt: Date }) {
  const millis = Number(photo.timestamp)
  const date = Number.isFinite(millis) && millis > 0
    ? new Date(millis)
    : new Date(Date.parse(photo.takePhotoFormatTime.replace(" ", "T")))
  const normalized = Number.isNaN(date.getTime()) ? photo.createdAt : date
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(normalized)
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "00"
  return `${get("year")}-${get("month")}-${get("day")}`
}

function asPhotoIDs(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0)))
}

const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i += 1) {
  let c = i
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[i] = c >>> 0
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980)
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { dosDate, dosTime }
}

function u16(value: number) {
  const buffer = Buffer.alloc(2)
  buffer.writeUInt16LE(value)
  return buffer
}

function u32(value: number) {
  const buffer = Buffer.alloc(4)
  buffer.writeUInt32LE(value >>> 0)
  return buffer
}

function createZip(files: Array<{ name: string; data: Buffer; date?: Date }>) {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8")
    const { dosDate, dosTime } = dosDateTime(file.date)
    const crc = crc32(file.data)
    const size = file.data.length
    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(size),
      u32(size),
      u16(name.length),
      u16(0),
      name,
      file.data,
    ])
    locals.push(local)

    centrals.push(Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(size),
      u32(size),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]))
    offset += local.length
  }

  const centralOffset = offset
  const central = Buffer.concat(centrals)
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(centralOffset),
    u16(0),
  ])
  return Buffer.concat([...locals, central, end])
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return badFor(req, "未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const projectIDValue = body.projectID == null ? null : Number(body.projectID)
    const userID = typeof body.userID === "string" ? body.userID : ""
    const photoIDs = asPhotoIDs(body.photoIDs)
    if (!groupID || photoIDs.length === 0) return badFor(req, "参数不正确")
    if (projectIDValue != null && (!Number.isFinite(projectIDValue) || projectIDValue <= 0)) return badFor(req, "项目不正确")
    if (!isSuperAdmin(user) && !(await requireTeamMember(groupID, user.id))) return badFor(req, "无团队访问权限", 403)

    const team = await prisma.team.findFirst({
      where: { groupID, deletedAt: null },
      select: { groupName: true },
    })
    if (!team) return badFor(req, "团队不存在", 404)

    const project = projectIDValue == null
      ? null
      : await prisma.project.findFirst({
          where: { groupID, projectID: projectIDValue, deletedAt: null },
          select: { projectID: true, projectName: true },
        })
    if (projectIDValue != null && !project) return badFor(req, "项目不存在", 404)

    const member = userID
      ? await prisma.teamMember.findUnique({
          where: { groupID_userID: { groupID, userID } },
          select: {
            userID: true,
            user: { select: { email: true, userName: true } },
          },
        })
      : null
    if (userID && !member) return badFor(req, "成员不存在", 404)

    const photos = await prisma.photo.findMany({
      where: {
        groupID,
        photoID: { in: photoIDs },
        deletedAt: null,
        ...(projectIDValue == null ? {} : { projectID: projectIDValue }),
        ...(userID ? { userID } : {}),
      },
      select: {
        photoID: true,
        timestamp: true,
        takePhotoFormatTime: true,
        largeURL: true,
        smallURL: true,
        localPhotoName: true,
        ossFileName: true,
        createdAt: true,
      },
      orderBy: { timestamp: "desc" },
    })
    if (photos.length === 0) return badFor(req, "照片不存在", 404)

    const usedNames = new Map<string, number>()
    const files: Array<{ name: string; data: Buffer; date: Date }> = []
    for (const photo of photos) {
      const imageURL = resolvePhotoURL(photo.largeURL || photo.smallURL)
      if (!imageURL || !/^https?:\/\//i.test(imageURL)) continue
      const upstream = await fetch(imageURL)
      if (!upstream.ok) continue
      const data = Buffer.from(await upstream.arrayBuffer())
      const sourceName = photo.localPhotoName || photo.ossFileName?.split("/").pop()
      const baseName = safeFilename(sourceName, `${photo.photoID}.jpg`)
      const count = usedNames.get(baseName) || 0
      usedNames.set(baseName, count + 1)
      const fileName = count === 0 ? baseName : baseName.replace(/(\.[^.]+)?$/, `-${count + 1}$1`)
      files.push({ name: safeZipPath(`${photoDateFolder(photo)}/${fileName}`), data, date: photo.createdAt })
    }
    if (files.length === 0) return badFor(req, "图片下载失败", 502)

    const zip = createZip(files)
    const subjectName = project?.projectName || member?.user.userName || member?.user.email || team.groupName
    const suffix = project ? "项目所有照片.zip" : member ? "成员所有照片.zip" : "团队所有照片.zip"
    const filename = safeFilename(`${subjectName}${suffix}`, suffix)
    return new NextResponse(zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(zip.length),
      },
    })
  } catch (err) {
    console.log("[app/admin/team-photos/download] error:", err)
    return serverError(req)
  }
}
