import { prisma } from "@/lib/prisma"
import { badFor, jsonSafe, ok, requireUser, serverError } from "@/app/api/_utils/api"
import { isSuperAdmin } from "@/app/api/_utils/admin"
import { resolvePhotoURL } from "@/app/web/photo-url"

function jsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function textValue(container: Record<string, unknown> | null, ...keys: string[]) {
  for (const key of keys) {
    const value = container?.[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

function numberValue(container: Record<string, unknown> | null, ...keys: string[]) {
  for (const key of keys) {
    const value = container?.[key]
    if (value === null || value === undefined || value === "") continue
    const number = typeof value === "number" ? value : Number(value)
    if (Number.isFinite(number)) return number
  }
  return null
}

export async function GET(req: Request, context: { params: Promise<{ photoID: string }> }) {
  try {
    const user = await requireUser(req)
    if (!user) return badFor(req, "未授权或登录已过期", 401)
    if (!isSuperAdmin(user)) return badFor(req, "无总管理员权限", 403)

    const { photoID } = await context.params
    if (!photoID || photoID.length > 191) return badFor(req)
    const photo = await prisma.photo.findFirst({
      where: { photoID, deletedAt: null, mediaType: 0, antiFakeCode: { not: "" }, largeURL: { not: "" } },
      select: {
        photoID: true,
        antiFakeCode: true,
        timestamp: true,
        takePhotoFormatTime: true,
        takePhotoTimezoneID: true,
        largeURL: true,
        smallURL: true,
        ossFileName: true,
        localPhotoName: true,
        location: true,
        lat: true,
        lng: true,
        userName: true,
        userShortName: true,
        projectName: true,
        addressInfo: true,
        systemInfo: true,
        mediaInfo: true,
        createdAt: true,
        team: { select: { groupID: true, groupName: true } },
        user: { select: { id: true, email: true, userName: true, shortName: true } },
      },
    })
    if (!photo) return badFor(req, "照片不存在", 404)

    const addressInfo = jsonObject(photo.addressInfo)
    const systemInfo = jsonObject(photo.systemInfo)
    const mediaInfo = jsonObject(photo.mediaInfo)
    const imageURL = resolvePhotoURL(photo.largeURL || photo.smallURL)
    return ok(jsonSafe({
      photo: {
        photoID: photo.photoID,
        photoCode: photo.antiFakeCode,
        imageURL,
        downloadURL: `/api/web/photos/download?photoID=${encodeURIComponent(photo.photoID)}`,
        captureTime: photo.takePhotoFormatTime,
        timestamp: photo.timestamp,
        timeZone: photo.takePhotoTimezoneID,
        location: photo.location,
        latitude: photo.lat == null ? null : Number(photo.lat),
        longitude: photo.lng == null ? null : Number(photo.lng),
        positionType: textValue(addressInfo, "positionType"),
        locationAccuracyMeters: numberValue(addressInfo, "locationAccuracyMeters", "accuracy", "horizontalAccuracy"),
        userName: photo.userName || photo.user.userName || photo.user.shortName,
        userEmail: photo.user.email,
        projectName: photo.projectName,
        team: photo.team,
        deviceModel: textValue(systemInfo, "deviceModel", "model"),
        os: textValue(systemInfo, "os", "systemVersion"),
        versionCode: textValue(systemInfo, "versionCode", "appVersion"),
        imageWidth: numberValue(mediaInfo, "imageWidth", "width"),
        imageHeight: numberValue(mediaInfo, "imageHeight", "height"),
        fileSize: numberValue(mediaInfo, "fileSize", "size"),
        localPhotoName: photo.localPhotoName,
        ossFileName: photo.ossFileName,
        createdAt: photo.createdAt,
      },
    }))
  } catch (error) {
    console.log("[app/admin/photo-code-photos/detail] error:", error)
    return serverError(req)
  }
}
