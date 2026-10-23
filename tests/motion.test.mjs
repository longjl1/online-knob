import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DetentMotion, lensWeight, wrap } from '../src/components/mechanical-bar/motion.ts'

function settle(motion, fps = 60) {
  const steps = []
  for (let i = 0; i < fps * 3 && motion.moving; i++) steps.push(...motion.advance(1 / fps))
  assert.equal(motion.moving, false)
  return steps
}

test('one step emits once, including the rebound, at 60/120/144 Hz', () => {
  for (const fps of [60, 120, 144]) {
    for (const direction of [-1, 1]) {
      const motion = new DetentMotion()
      motion.step(direction)
      assert.deepEqual(settle(motion, fps), [direction])
      assert.equal(motion.position, direction)
    }
  }
})

test('fast reversal remains continuous and settles in the new direction', () => {
  const motion = new DetentMotion()
  motion.step(1)
  motion.advance(0.04)
  const position = motion.position
  motion.reverse(-1)
  motion.advance(1 / 144)
  assert.ok(Math.abs(motion.position - position) < 0.15, 'no teleport on reversal')
  settle(motion)
  assert.equal(motion.position, -1)
})

test('release snaps to the nearest tooth without extra bounce events', () => {
  const motion = new DetentMotion()
  for (let i = 0; i < 20; i++) {
    motion.step(1)
    for (let j = 0; j < 4; j++) motion.advance(1 / 60)
  }
  const nearest = Math.round(motion.position)
  motion.release()
  const steps = settle(motion)
  assert.equal(motion.position, nearest)
  assert.ok(steps.length <= 1)
})

test('reduced motion snaps immediately, with one event per crossed tooth', () => {
  const motion = new DetentMotion()
  motion.step(-1)
  assert.deepEqual(motion.advance(0, true), [-1])
  assert.equal(motion.moving, false)
})

test('long running movement rebases without losing events or visual rhythm', () => {
  const motion = new DetentMotion()
  let total = 0
  for (let i = 0; i < 25_006; i++) {
    motion.step(1)
    total += motion.advance(0, true).reduce((a, b) => a + b, 0)
  }
  assert.equal(total, 25_006)
  assert.ok(motion.position < 10_001)
  assert.equal(wrap(motion.position, 5), wrap(total, 5))
})

test('lens is symmetric and continuous; negative wrap is seamless', () => {
  assert.equal(lensWeight(0, 72), 1)
  assert.equal(lensWeight(-24, 72), lensWeight(24, 72))
  assert.ok(lensWeight(24, 72) > lensWeight(72, 72))
  assert.equal(wrap(-1, 750), 749)
  assert.equal(wrap(751, 750), 1)
})
