import { test, expect } from '@playwright/test'

const first = page => page.getByRole('group', { name: 'First', exact: true })
const steps = (page, index = 0) => page.evaluate(i => window.barTest.steps[i], index)
const configure = (page, props) => page.evaluate(p => window.barTest.configure(p), props)

async function harness(page) {
  await page.addInitScript(() => {
    window.audioStats = { created: 0, starts: 0, closed: 0 }
    const NativeAudioContext = window.AudioContext
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); window.audioStats.created++ }
      createBufferSource() {
        const source = super.createBufferSource()
        const start = source.start.bind(source)
        source.start = (...args) => { window.audioStats.starts++; return start(...args) }
        return source
      }
      close() { window.audioStats.closed++; return super.close() }
    }
  })
  await page.goto('/tests/harness.html')
  await expect(first(page)).toBeVisible()
}

test('preview contains only the bar, with a continuous magnified center', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading')).toHaveCount(0)
  await expect(page.locator('main')).toHaveText('使用左右方向键移动刻度，长按可连续移动；也可点击左半或右半。')
  const teeth = await page.locator('.mechanical-bar__tooth').evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect()
    return { x: box.x + box.width / 2, height: box.height }
  }))
  const box = await page.locator('.mechanical-bar').boundingBox()
  const center = box.x + box.width / 2
  const atCenter = teeth.find(tooth => Math.abs(tooth.x - center) < 1)
  const atSide = teeth.find(tooth => Math.abs(tooth.x - (center + 200)) < 1)
  expect(atCenter.height / atSide.height).toBeGreaterThan(2.2)
  await page.screenshot({ path: 'tests/artifacts/desktop.png' })
  expect(errors).toEqual([])
})

test('single steps, callback direction and sound stay synchronized without rebound clicks', async ({ page }) => {
  await harness(page)
  expect(await page.evaluate(() => window.audioStats.created)).toBe(0)
  await first(page).getByRole('button').first().focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => steps(page)).toEqual([1])
  await page.waitForTimeout(600)
  expect(await steps(page)).toEqual([1])
  await page.keyboard.press('ArrowLeft')
  await expect.poll(() => steps(page)).toEqual([1, -1])
  await page.waitForTimeout(600)
  expect(await steps(page)).toEqual([1, -1])
  expect(await page.evaluate(() => window.audioStats)).toMatchObject({ created: 1, starts: 2 })
})

test('holding repeats, releasing settles, rapid reversal moves both ways', async ({ page }) => {
  await harness(page)
  await first(page).getByRole('button').first().focus()
  const count = await first(page).locator('.mechanical-bar__tooth').count()
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(800)
  await page.keyboard.down('ArrowLeft')
  await page.keyboard.up('ArrowRight')
  await page.waitForTimeout(650)
  // Modifier keys pressed during a hold must not swallow the releasing keyup.
  await page.keyboard.down('Control')
  await page.keyboard.up('ArrowLeft')
  await page.keyboard.up('Control')
  await page.waitForTimeout(650)
  const recorded = await steps(page)
  expect(recorded.filter(x => x === 1).length).toBeGreaterThan(4)
  expect(recorded.filter(x => x === -1).length).toBeGreaterThan(3)
  await page.waitForTimeout(250)
  expect(await steps(page)).toEqual(recorded)
  expect(await first(page).locator('.mechanical-bar__tooth').count()).toBe(count)
})

test('pointer controls and multiple instances keep focus and events isolated', async ({ page }) => {
  await harness(page)
  await first(page).getByRole('button', { name: 'First：向右移动' }).click()
  await expect.poll(() => steps(page)).toEqual([1])
  await page.getByRole('button', { name: 'Second：向左移动' }).click()
  await expect.poll(() => steps(page, 1)).toEqual([-1])
  await page.keyboard.press('ArrowLeft')
  await expect.poll(() => steps(page, 1)).toEqual([-1, -1])
  expect(await steps(page)).toEqual([1])
  await page.locator('#outside').focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(400)
  expect(await steps(page)).toEqual([1])
  expect(await steps(page, 1)).toEqual([-1, -1])
})

test('focus loss cancels a held key and never resumes it', async ({ page }) => {
  await harness(page)
  await first(page).getByRole('button').first().focus()
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(500)
  await page.locator('#outside').focus()
  await page.waitForTimeout(600)
  const recorded = await steps(page)
  await page.waitForTimeout(300)
  expect(await steps(page)).toEqual(recorded)
  await page.keyboard.up('ArrowRight')
})

test('muting, disabling, and unmounting stop their resources', async ({ page }) => {
  await harness(page)
  await first(page).getByRole('button').first().focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => steps(page)).toEqual([1])
  await configure(page, { sound: false })
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => steps(page)).toEqual([1, 1])
  expect(await page.evaluate(() => window.audioStats.starts)).toBe(1)
  await configure(page, { disabled: true })
  await expect(first(page).getByRole('button').first()).toBeDisabled()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(400)
  expect(await steps(page)).toEqual([1, 1])
  await page.evaluate(() => window.barTest.unmount())
  await expect(first(page)).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => window.audioStats.closed)).toBe(1)
})

test('reduced motion, muted initialization, and narrow touch layout', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 320, height: 640 })
  await harness(page)
  await configure(page, { sound: false })
  await first(page).getByRole('button').first().focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => steps(page)).toEqual([1])
  const transforms = await first(page).locator('.mechanical-bar__tooth').evaluateAll(nodes => nodes.map(n => n.style.transform))
  await page.waitForTimeout(100)
  expect(await first(page).locator('.mechanical-bar__tooth').evaluateAll(nodes => nodes.map(n => n.style.transform))).toEqual(transforms)
  expect(await page.evaluate(() => window.audioStats.created)).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)
  await page.goto('/')
  await page.screenshot({ path: 'tests/artifacts/mobile.png' })
})

test('blocked audio does not block keyboard movement', async ({ page }) => {
  await page.addInitScript(() => {
    window.AudioContext = class { constructor() { throw new Error('Audio blocked') } }
  })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/tests/harness.html')
  await first(page).getByRole('button').first().focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => steps(page)).toEqual([1])
  expect(errors).toEqual([])
})

test('unmount during a held key cancels repeats and closes audio', async ({ page }) => {
  await harness(page)
  await first(page).getByRole('button').first().focus()
  await page.keyboard.down('ArrowRight')
  await expect.poll(async () => (await steps(page)).length).toBeGreaterThan(2)
  await page.evaluate(() => window.barTest.unmount())
  await expect(first(page)).toHaveCount(0)
  const recorded = await steps(page)
  await page.waitForTimeout(700)
  expect(await steps(page)).toEqual(recorded)
  expect(await page.evaluate(() => window.audioStats.closed)).toBe(1)
  await page.keyboard.up('ArrowRight')
})

test('touch taps work on each half at phone width', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto('/tests/harness.html')
  await first(page).getByRole('button', { name: 'First：向右移动' }).tap()
  await expect.poll(() => steps(page)).toEqual([1])
  await first(page).getByRole('button', { name: 'First：向左移动' }).tap()
  await expect.poll(() => steps(page)).toEqual([1, -1])
  await context.close()
})

test('window blur stops a hold and custom spacing can resize without overflow', async ({ page }) => {
  await harness(page)
  await configure(page, { className: 'max-w-[280px]', style: { '--bar-spacing': 8, '--bar-magnification': 2 } })
  await expect.poll(async () => (await first(page).boundingBox()).width).toBe(280)
  await first(page).getByRole('button').first().focus()
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(500)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.waitForTimeout(600)
  const recorded = await steps(page)
  await page.waitForTimeout(300)
  expect(await steps(page)).toEqual(recorded)
  await page.keyboard.up('ArrowRight')
})
