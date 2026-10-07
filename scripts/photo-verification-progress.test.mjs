import assert from 'node:assert/strict'
import { test } from 'node:test'
import { initialVerificationProgress, mergeVerificationProgress, completedVerificationProgress } from '../lib/photoVerification.ts'

test('parallel progress preserves unfinished time recognition', () => {
  let progress = initialVerificationProgress()
  for (const [stage, status] of [
    ['PHOTO_CODE', 'COMPLETED'], ['TIME', 'RUNNING'],
    ['ADDRESS', 'RUNNING'], ['PHOTO_INFO', 'RUNNING'], ['ADDRESS', 'COMPLETED'],
  ]) progress = mergeVerificationProgress(progress, stage, status)
  assert.deepEqual(progress.stages.map(s => s.status), ['COMPLETED', 'RUNNING', 'COMPLETED', 'RUNNING'])
  progress = mergeVerificationProgress(progress, 'TIME', 'COMPLETED')
  assert.equal(progress.stages[3].status, 'RUNNING')
  assert.ok(completedVerificationProgress().stages.every(s => s.status === 'COMPLETED'))
})

test('parallel updates preserve failed stages and reject invalid events', () => {
  let progress = mergeVerificationProgress(initialVerificationProgress(), 'TIME', 'FAILED')
  progress = mergeVerificationProgress(progress, 'PHOTO_INFO', 'RUNNING')
  assert.equal(progress.stages[1].status, 'FAILED')
  assert.equal(mergeVerificationProgress(progress, 'unknown', 'RUNNING'), null)
})
