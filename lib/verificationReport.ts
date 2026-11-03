import { normalizeVerificationErrorCode } from "./verificationErrorCodes"

export type CheckState = "passed" | "mismatch" | "unavailable" | "not_checked"
export type ReportState = "passed" | "mismatch" | "partial" | "unavailable" | "unsupported" | "processing" | "error" | "record" | "not_found"
export type VerificationCheck = {
  key: "code" | "time" | "address" | "content"
  state: CheckState
  expected: string
  recognized: string
  reason: "match" | "difference" | "unreadable" | "reference_missing" | "not_checked"
}
export type CaptureRecord = {
  photoCode: string; captureTime: string; timestamp: number | null
  address: string; latitude: number | null; longitude: number | null
  timezone: string; timezoneID: string; deviceModel: string; os: string; appVersion: string
  source: string; accuracy: number | null; countryCode: string; coordinateSystem: string
}
export type VerificationReport = {
  mode: "verification" | "record"
  state: ReportState
  taskID: string | null
  photoCode: string
  imageUrl: string | null
  imageUnavailable: boolean
  completedAt: number | null
  capture: CaptureRecord | null
  checks: VerificationCheck[]
  reason: "unreadable" | "reference_missing" | "service" | "unsupported" | "none"
}

export const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {}
export const text = (v: unknown) => typeof v === "string" ? v.trim() : ""
const finite = (v: unknown): number | null => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null
export function normalizePhotoCode(v: unknown) { const code = text(v).toUpperCase(); return /^[A-Z0-9]{12}$/.test(code) ? code : null }
export function normalizeTaskID(v: unknown) { const id = text(v).toLowerCase(); return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id) ? id : null }

// Explicit allowlist: device IDs, account/team enrichment, raw OCR and storage keys stay private.
export function captureRecord(value: unknown, photoCode = ""): CaptureRecord | null {
  const c = object(value)
  if (!Object.keys(c).length) return null
  const coordinates = text(c.latlng).split(/[,，]/).map(p => p.trim())
  const lat = coordinates.length === 2 && coordinates[0] ? finite(coordinates[0]) : null
  const lng = coordinates.length === 2 && coordinates[1] ? finite(coordinates[1]) : null
  const valid = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  const timestamp = finite(c.timestamp)
  return {
    photoCode: normalizePhotoCode(c.photoCode) ?? photoCode,
    captureTime: text(c.captureTime), timestamp: timestamp !== null && timestamp > 0 ? timestamp : null,
    address: text(c.address), latitude: valid ? lat : null, longitude: valid ? lng : null,
    timezone: text(c.timezoneAbbreviation) || text(c.timezoneID), timezoneID: text(c.timezoneID),
    deviceModel: text(c.deviceModel), os: text(c.os), appVersion: text(c.appVersion) || text(c.versionCode),
    source: text(c.captureSource) || "Timeprint", accuracy: finite(c.locationAccuracyMeters),
    countryCode: text(c.countryCode).toUpperCase(), coordinateSystem: text(c.coordinateSystem).toUpperCase(),
  }
}

function sectionCheck(key: VerificationCheck["key"], raw: unknown, errorCode: string): VerificationCheck {
  const s = object(raw)
  const regions = Array.isArray(s.regions) ? s.regions.map(object) : []
  const recognized = key === "code" ? text(s.recognized) : [...new Set(regions.map(r => text(r.recognized)).filter(Boolean))].join("\n") || text(s.recognized)
  const expected = text(s.expected)
  const reason = [text(s.reason), text(s.status), ...regions.map(r => text(r.reason))].join(" ").toLowerCase()
  const checked = key === "code" ? s.matched : s.verified
  let state: CheckState = "unavailable"
  let explanation: VerificationCheck["reason"] = "unreadable"
  if (s.supported === false || /not_supported|unsupported|not_applicable|not_enabled|not_checked/.test(reason)) {
    state = "not_checked"; explanation = "not_checked"
  } else if (/reference.*(missing|invalid|unavailable)|missing.*reference|record_not_found/.test(reason) || (key === "content" && errorCode === "410")) {
    explanation = "reference_missing"
  } else if (checked === true && (key !== "code" || normalizePhotoCode(recognized))) {
    state = "passed"; explanation = "match"
  } else if (checked === false) {
    const unreadable = /not_recognized|unreadable|unavailable|extract.*fail|rect_missing|region_missing|insufficient/.test(reason)
    const explicitDifference = key === "code" ? errorCode === "409" && !!recognized :
      key === "time" ? !!recognized && !!expected && (errorCode === "412" || /difference_exceeded|mismatch/.test(reason) || regions.some(r => finite(r.timeDifferenceSeconds) !== null && finite(r.toleranceSeconds) !== null && Number(r.timeDifferenceSeconds) > Number(r.toleranceSeconds))) :
      key === "address" ? !!recognized && !!expected && (errorCode === "416" || /mismatch|below_threshold/.test(reason) || finite(s.similarity) !== null) :
      errorCode === "406" || /mismatch|different|tampered/.test(reason)
    if (!unreadable && explicitDifference) { state = "mismatch"; explanation = "difference" }
  }
  return { key, state, expected, recognized, reason: explanation }
}

export function verificationReport(rawTask: unknown): VerificationReport {
  const task = object(rawTask), result = object(task.result)
  const code = normalizePhotoCode(object(result.photoCode).recognized) ?? normalizePhotoCode(task.photoCode) ?? ""
  const errorCode = normalizeVerificationErrorCode(result.errorCode ?? task.errorCode)
  const checks = (["code", "time", "address", "content"] as const).map(key => sectionCheck(key, result[key === "code" ? "photoCode" : key], errorCode))
  const source = object(result.source)
  let state: ReportState
  let reason: VerificationReport["reason"] = "none"
  if (task.status === "PENDING" || task.status === "PROCESSING") state = "processing"
  else if (source.status === "unsupported" && source.confirmed === true) { state = "unsupported"; reason = "unsupported" }
  else if (task.status === "FAILED" && ["500", "502", "503"].includes(errorCode)) { state = "error"; reason = "service" }
  else if (checks.some(c => c.state === "mismatch")) state = "mismatch"
  else if (checks.every(c => c.state === "passed") && (result.verified === true || task.verified === true)) state = "passed"
  else if (checks.some(c => c.state === "passed")) state = "partial"
  else { state = "unavailable"; reason = errorCode === "410" ? "reference_missing" : "unreadable" }
  const completedAt = task.completedAt instanceof Date ? task.completedAt.getTime() : finite(task.completedAt)
  return { mode: "verification", state, taskID: normalizeTaskID(task.taskID), photoCode: code,
    imageUrl: null, imageUnavailable: false, completedAt, capture: captureRecord(result.captureRecord, code), checks, reason }
}

export function photoRecordReport(raw: unknown, code: string): VerificationReport {
  const payload = object(raw), capture = captureRecord(payload.captureRecord, code)
  const returnedCode = normalizePhotoCode(payload.photoCode)
  if ((returnedCode && returnedCode !== code) || (capture?.photoCode && capture.photoCode !== code)) return unavailableReport("record", "error", code)
  return { mode: "record", state: capture ? "record" : "not_found", taskID: null, photoCode: code,
    imageUrl: null, imageUnavailable: false, completedAt: null, capture, checks: [], reason: "none" }
}

export function unavailableReport(mode: VerificationReport["mode"], state: "not_found" | "error", code = ""): VerificationReport {
  return { mode, state, taskID: null, photoCode: code, imageUrl: null, imageUnavailable: false,
    completedAt: null, capture: null, checks: [], reason: state === "error" ? "service" : "none" }
}
