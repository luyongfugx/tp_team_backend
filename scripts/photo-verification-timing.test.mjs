import assert from 'node:assert/strict'
import { test } from 'node:test'
import { recognitionTotalMs, formatRecognitionTime } from '../lib/photo-verification-timing.ts'

test('uses recorded wall time without summing overlapping steps', () => {
  const result = { timings: { totalMs: 2510, steps: [{ durationMs: 2000 }, { durationMs: 2000 }] } }
  assert.equal(recognitionTotalMs(result), 2510)
  assert.equal(formatRecognitionTime(recognitionTotalMs(result)), '2.51 s')
  assert.equal(formatRecognitionTime(0), '0.00 s')
})
test('missing or malformed legacy timings never appear as zero', () => {
  for (const result of [null, {}, { timings: null }, { timings: { totalMs: -1 } }, { timings: { totalMs: '100' } }, { timings: { totalMs: Infinity } }]) {
    assert.equal(recognitionTotalMs(result), null)
    assert.equal(formatRecognitionTime(recognitionTotalMs(result)), '—')
  }
})
