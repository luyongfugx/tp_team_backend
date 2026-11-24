import test from 'node:test'
import assert from 'node:assert/strict'
import { beijingDay, verificationSummaryDates, summarizeVerificationGroups } from '../lib/photo-verification-summary'

test('Beijing day uses inclusive start and exclusive end, crossing month and year boundaries', () => {
  const d = verificationSummaryDates('2026-01-02', new Date('2026-11-24T00:00:00Z'))!
  assert.equal(d.start.toISOString(), '2026-01-01T16:00:00.000Z')
  assert.equal(d.end.toISOString(), '2026-01-02T16:00:00.000Z')
  assert.equal(d.previousDate, '2025-12-26')
  assert.equal(d.previousStart.toISOString(), '2025-12-25T16:00:00.000Z')
  assert.equal(d.previousEnd.toISOString(), '2025-12-26T16:00:00.000Z')
  assert.equal(beijingDay(new Date('2026-11-23T16:00:00Z')), '2026-11-24')
})
test('Reject malformed, impossible, future, and injected dates; permit leap days and today', () => {
  const now = new Date('2026-11-24T00:00:00Z')
  for (const date of [null, '', '2026-2-01', '2026-02-29', '2026-11-25', '2026-13-01', '2026-11-24 OR 1=1']) {
    assert.equal(verificationSummaryDates(date, now), null, String(date))
  }
  assert.ok(verificationSummaryDates('2024-02-29', now))
  assert.ok(verificationSummaryDates('2026-11-24', now))
})
test('Verified false is failure; pending and unclassified results never become failures', () => {
  const group = (status: string, verified: boolean | null, count: number) => ({ status, verified, _count: { _all: count } })
  assert.deepEqual(summarizeVerificationGroups([
    group('SUCCEEDED', true, 10), group('SUCCEEDED', false, 2), group('FAILED', null, 3),
    group('FAILED', true, 1), group('PENDING', null, 4), group('PROCESSING', null, 5),
    group('SUCCEEDED', null, 6), group('FUTURE_STATUS', null, 7),
  ]), { total: 38, success: 10, failure: 6, processing: 9, unknown: 13 })
  assert.deepEqual(summarizeVerificationGroups([]), { total: 0, success: 0, failure: 0, processing: 0, unknown: 0 })
  assert.throws(() => summarizeVerificationGroups([group('FAILED', null, -1)]))
  assert.throws(() => summarizeVerificationGroups([group('FAILED', null, Number.MAX_SAFE_INTEGER), group('FAILED', null, 1)]))
})
