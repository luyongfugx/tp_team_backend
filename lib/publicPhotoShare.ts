import { prisma } from "@/lib/prisma"
import { signedVerificationImageURL } from "@/lib/cosSignedUrl"

export type PublicPhotoShare = {
  photoCode: string
  imageUrl: string
  verified: boolean
  timeVerified: boolean
  addressVerified: boolean
  contentVerified: boolean
  photoCodeVerified: boolean
  captureTime: string
  timestamp: number | null
  address: string
  latitude: number | null
  longitude: number | null
  positionType: string
  locationAccuracyMeters: number | null
  groupName: string
  projectName: string
  deviceModel: string
  os: string
  versionCode: string
  timezone: string
  imageWidth: number | null
  imageHeight: number | null
  completedAt: number | null
}

const verificationTasks = (prisma as unknown as { photoVerificationTask: any }).photoVerificationTask

export function normalizePublicPhotoCode(value: unknown) {
  if (typeof value !== "string") return null
  const code = value.trim().toUpperCase()
  return /^[A-Z0-9]{12}$/.test(code) ? code : null
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function finiteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const number = typeof value === "number" ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function coordinatePair(value: unknown) {
  const parts = textValue(value).split(/[,，]/).map((part) => Number(part.trim()))
  if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) {
    return { latitude: null, longitude: null }
  }
  const [latitude, longitude] = parts
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { latitude: null, longitude: null }
  }
  return { latitude, longitude }
}

export async function getPublicPhotoShare(rawPhotoCode: unknown): Promise<PublicPhotoShare | null> {
  const photoCode = normalizePublicPhotoCode(rawPhotoCode)
  if (!photoCode) return null

  const task = await verificationTasks.findFirst({
    where: { photoCode, status: "SUCCEEDED" },
    select: {
      imageObjectKey: true,
      verified: true,
      result: true,
      completedAt: true,
    },
    orderBy: { completedAt: "desc" },
  })
  if (!task) return null

  const result = objectValue(task.result)
  const capture = objectValue(result?.captureRecord)
  if (!capture) return null
  const timeResult = objectValue(result?.time)
  const addressResult = objectValue(result?.address)
  const contentResult = objectValue(result?.content)
  const photoCodeResult = objectValue(result?.photoCode)
  const coordinates = coordinatePair(capture.latlng)
  const timestamp = finiteNumber(capture.timestamp)
  const accuracy = finiteNumber(capture.locationAccuracyMeters)
  const imageWidth = finiteNumber(capture.imageWidth)
  const imageHeight = finiteNumber(capture.imageHeight)
  const overallVerified = task.verified === true
  const verificationFlag = (container: Record<string, unknown> | null, key: string) =>
    typeof container?.[key] === "boolean" ? container[key] === true : overallVerified

  return {
    photoCode,
    imageUrl: signedVerificationImageURL(textValue(task.imageObjectKey)),
    verified: overallVerified,
    timeVerified: verificationFlag(timeResult, "verified"),
    addressVerified: verificationFlag(addressResult, "verified"),
    contentVerified: verificationFlag(contentResult, "verified"),
    photoCodeVerified: verificationFlag(photoCodeResult, "matched"),
    captureTime: textValue(capture.captureTime),
    timestamp,
    address: textValue(capture.address),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    positionType: textValue(capture.positionType),
    locationAccuracyMeters: accuracy,
    groupName: textValue(capture.groupName),
    projectName: textValue(capture.projectName),
    deviceModel: textValue(capture.deviceModel),
    os: textValue(capture.os),
    versionCode: textValue(capture.versionCode),
    timezone: textValue(capture.timezoneAbbreviation) || textValue(capture.timezoneID),
    imageWidth,
    imageHeight,
    completedAt: task.completedAt instanceof Date ? task.completedAt.getTime() : null,
  }
}
