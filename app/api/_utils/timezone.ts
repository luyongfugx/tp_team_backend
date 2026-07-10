const DEFAULT_TIME_ZONE = "Asia/Shanghai"

type TimeZoneInput = unknown

function parseOffsetMinutes(timeZone: string) {
  const trimmed = timeZone.trim()
  if (/^(GMT|UTC|Z)$/i.test(trimmed)) return 0

  const match = trimmed.match(/^(?:GMT|UTC)?([+-])(\d{1,2})(?::?(\d{2}))?$/i)
  if (!match) return null

  const hours = Number(match[2])
  const minutes = Number(match[3] ?? 0)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) {
    return null
  }

  const sign = match[1] === "-" ? -1 : 1
  return sign * (hours * 60 + minutes)
}

function isValidIanaTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

function timezoneOffsetMillis(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0)
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
  return asUTC - date.getTime()
}

function zonedMidnightUTC(timeZone: string, y: number, m: number, d: number) {
  let utc = Date.UTC(y, m - 1, d, 0, 0, 0, 0)
  utc -= timezoneOffsetMillis(timeZone, new Date(utc))
  utc -= timezoneOffsetMillis(timeZone, new Date(utc)) - timezoneOffsetMillis(timeZone, new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)))
  return utc
}

function ianaDayRange(timeZone: string, timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp))
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0)
  const start = zonedMidnightUTC(timeZone, get("year"), get("month"), get("day"))
  const end = zonedMidnightUTC(timeZone, get("year"), get("month"), get("day") + 1) - 1
  return { gte: BigInt(start), lte: BigInt(end) }
}

function fixedOffsetDayRange(offsetMinutes: number, timestamp: number) {
  const offsetMillis = offsetMinutes * 60 * 1000
  const shiftedNow = new Date(timestamp + offsetMillis)
  const start = Date.UTC(
    shiftedNow.getUTCFullYear(),
    shiftedNow.getUTCMonth(),
    shiftedNow.getUTCDate(),
    0,
    0,
    0,
    0,
  ) - offsetMillis
  const end = start + 24 * 60 * 60 * 1000 - 1
  return { gte: BigInt(start), lte: BigInt(end) }
}

function normalizeTimestamp(input: TimeZoneInput) {
  const timestamp = Number(input)
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now()
}

export function normalizeTimeZone(input: TimeZoneInput) {
  const timeZone = typeof input === "string" && input.trim().length > 0
    ? input.trim()
    : DEFAULT_TIME_ZONE
  if (parseOffsetMinutes(timeZone) != null || isValidIanaTimeZone(timeZone)) {
    return timeZone
  }
  return DEFAULT_TIME_ZONE
}

export function dayRangeForTimeZone(input: TimeZoneInput, timestampInput?: TimeZoneInput) {
  const timeZone = normalizeTimeZone(input)
  const timestamp = normalizeTimestamp(timestampInput)
  const offsetMinutes = parseOffsetMinutes(timeZone)
  if (offsetMinutes != null) {
    return fixedOffsetDayRange(offsetMinutes, timestamp)
  }
  return ianaDayRange(timeZone, timestamp)
}

export function todayRangeForTimeZone(input: TimeZoneInput) {
  return dayRangeForTimeZone(input)
}
