import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canMarkYouTubeAutomationDayUploaded,
  getYouTubeAutomationDayLockReason,
  isYouTubeAutomationDayOpen,
} from '../lib/youtube-automation-state.ts'
import { isYouTubeProductionQueuedStage } from '../lib/youtube-automation-production-state.ts'

test('locked and future YouTube days cannot be rendered', () => {
  assert.equal(isYouTubeAutomationDayOpen({ dayNumber: 2, status: 'locked' }, 1), false)
  assert.equal(isYouTubeAutomationDayOpen({ dayNumber: 2, status: 'open' }, 1), false)
})

test('the current open YouTube day can be rendered', () => {
  assert.equal(isYouTubeAutomationDayOpen({ dayNumber: 2, status: 'open' }, 2), true)
  assert.equal(isYouTubeAutomationDayOpen({ dayNumber: 1, status: 'failed' }, 2), true)
})

test('plan upgrade locks take precedence over an open day', () => {
  assert.equal(getYouTubeAutomationDayLockReason({ dayNumber: 2, status: 'open', requiresUpgrade: true }), 'upgrade')
  assert.equal(getYouTubeAutomationDayLockReason({ dayNumber: 2, status: 'locked', requiresUpgrade: true }, true), 'upgrade')
  assert.equal(getYouTubeAutomationDayLockReason({ dayNumber: 2, status: 'open' }, true), 'schedule')
  assert.equal(getYouTubeAutomationDayLockReason({ dayNumber: 2, status: 'open' }), null)
})

test('upload marking requires a completed accessible video', () => {
  assert.equal(canMarkYouTubeAutomationDayUploaded({ dayNumber: 1, status: 'completed', mp4Url: 'https://example.com/video.mp4' }, 1), true)
  assert.equal(canMarkYouTubeAutomationDayUploaded({ dayNumber: 1, status: 'rendering', mp4Url: 'https://example.com/video.mp4' }, 1), false)
  assert.equal(canMarkYouTubeAutomationDayUploaded({ dayNumber: 1, status: 'completed', mp4Url: null }, 1), false)
  assert.equal(canMarkYouTubeAutomationDayUploaded({ dayNumber: 2, status: 'completed', mp4Url: 'https://example.com/video.mp4' }, 1), false)
})

test('queued renders are distinct from running renders for stale recovery', () => {
  assert.equal(isYouTubeProductionQueuedStage('영상 제작 대기열 등록됨'), true)
  assert.equal(isYouTubeProductionQueuedStage('스크립트 생성 준비 중'), true)
  assert.equal(isYouTubeProductionQueuedStage('영상 제작 작업 실행 중'), false)
})
