export type VerificationDayCounts = {
  total: number; success: number; failure: number; processing: number; unknown: number
}
export type VerificationStatusGroup = {
  status: string; verified: boolean | null; _count: { _all: number }
}
const DAY_MS = 86_400_000
const BEIJING_OFFSET_MS = 8 * 3_600_000
export function beijingDay(now: Date) {
  return new Date(now.getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 10)
}
export function verificationSummaryDates(date: string | null, now = new Date()) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const utc = Date.parse(`${date}T00:00:00.000Z`)
  if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 10) !== date || date > beijingDay(now)) return null
  const start = new Date(utc - BEIJING_OFFSET_MS)
  const end = new Date(start.getTime() + DAY_MS)
  const previousStart = new Date(start.getTime() - 7 * DAY_MS)
  const previousEnd = new Date(previousStart.getTime() + DAY_MS)
  return { date, previousDate: beijingDay(previousStart), start, end, previousStart, previousEnd }
}
export function summarizeVerificationGroups(groups: VerificationStatusGroup[]): VerificationDayCounts {
  const result: VerificationDayCounts = { total: 0, success: 0, failure: 0, processing: 0, unknown: 0 }
  for (const { status, verified, _count } of groups) {
    const count = _count._all
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid verification aggregate')
    result.total += count
    if (status === 'SUCCEEDED' && verified === true) result.success += count
    else if (status === 'FAILED' || (status === 'SUCCEEDED' && verified === false)) result.failure += count
    else if (status === 'PENDING' || status === 'PROCESSING') result.processing += count
    else result.unknown += count
  }
  if (!Number.isSafeInteger(result.total)) throw new Error('Verification aggregate overflow')
  return result
}
