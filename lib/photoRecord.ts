import { prisma } from "@/lib/prisma"

function mediaIDFromInfo(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ""
  const mediaID = (value as Record<string, unknown>).mediaID
  return typeof mediaID === "string" ? mediaID.trim() : ""
}

export async function fetchTrustedPhotoRecord(photoCode: string) {
  const baseURL = process.env.TP_OCR_BASE_URL?.trim()
  const apiKey = process.env.TP_OCR_API_KEY?.trim()
  if (!baseURL || !apiKey) throw new Error("TP OCR task service is not configured")
  const response = await fetch(new URL("/v1/photo-record", baseURL), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({ photoCode }),
    cache: "no-store",
  })
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`TP OCR photo record lookup failed (${response.status}): ${(await response.text()).slice(0, 500)}`)
  }
  const value = await response.json()
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export async function enrichCaptureTeamInfo(rawResult: Record<string, unknown>, userID: string) {
  const captureValue = rawResult.captureRecord
  if (!captureValue || typeof captureValue !== "object" || Array.isArray(captureValue)) return rawResult
  const captureRecord = { ...(captureValue as Record<string, unknown>) }
  if (String(captureRecord.groupName ?? "").trim() && String(captureRecord.projectName ?? "").trim()) return rawResult
  const photoCodeValue = rawResult.photoCode
  const photoCode = typeof photoCodeValue === "string"
    ? photoCodeValue.trim()
    : photoCodeValue && typeof photoCodeValue === "object" && !Array.isArray(photoCodeValue)
      ? String((photoCodeValue as Record<string, unknown>).recognized ?? "").trim()
      : ""
  const mediaID = String(captureRecord.mediaID ?? "").trim()
  let photo = photoCode
    ? await prisma.photo.findFirst({
        where: { userID, antiFakeCode: photoCode, deletedAt: null },
        select: { groupID: true, projectID: true, projectName: true, team: { select: { groupName: true } } },
        orderBy: { createdAt: "desc" },
      })
    : null
  if (!photo && mediaID) {
    const recentPhotos = await prisma.photo.findMany({
      where: { userID, deletedAt: null },
      select: { groupID: true, projectID: true, projectName: true, mediaInfo: true, team: { select: { groupName: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    })
    photo = recentPhotos.find((item) => mediaIDFromInfo(item.mediaInfo) === mediaID) ?? null
  }
  const captureTimestamp = Number(captureRecord.timestamp)
  if (!photo && Number.isFinite(captureTimestamp) && captureTimestamp > 0) {
    const nearbyPhotos = await prisma.photo.findMany({
      where: {
        userID,
        deletedAt: null,
        timestamp: {
          gte: BigInt(Math.trunc(captureTimestamp - 60_000)),
          lte: BigInt(Math.trunc(captureTimestamp + 60_000)),
        },
      },
      select: { groupID: true, projectID: true, projectName: true, timestamp: true, team: { select: { groupName: true } } },
      take: 20,
    })
    photo = nearbyPhotos.sort((left, right) =>
      Math.abs(Number(left.timestamp) - captureTimestamp) - Math.abs(Number(right.timestamp) - captureTimestamp)
    )[0] ?? null
  }
  if (!photo) return rawResult
  captureRecord.groupID = photo.groupID
  captureRecord.groupName = photo.team.groupName
  captureRecord.projectID = photo.projectID
  captureRecord.projectName = photo.projectName ?? ""
  return { ...rawResult, captureRecord }
}
