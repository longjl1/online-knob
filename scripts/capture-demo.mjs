import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'

// Capture the actual preview with deterministic browser time at 25 FPS.
// Start `npm run dev` first. Frames are local build artifacts, not source assets.
const output = new URL('../tests/artifacts/gif-frames/', import.meta.url)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })

try {
  const page = await browser.newPage({
    viewport: { width: 880, height: 360 },
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  })
  await page.clock.install({ time: new Date('2026-10-24T00:00:00Z') })
  await page.goto(process.env.DEMO_URL || 'http://127.0.0.1:5173/')
  await page.locator('.mechanical-bar__tooth').first().waitFor()
  await page.clock.pauseAt(new Date('2026-10-24T00:00:01Z'))

  for (let i = 0; i < 190; i++) {
    if (i === 10 || i === 25) await page.keyboard.press('ArrowRight')
    if (i === 40 || i === 55) await page.keyboard.press('ArrowLeft')
    if (i === 70) await page.keyboard.down('ArrowRight')
    if (i === 110) await page.keyboard.up('ArrowRight')
    if (i === 125) await page.keyboard.down('ArrowLeft')
    if (i === 165) await page.keyboard.up('ArrowLeft')
    await page.clock.runFor(40)
    await page.screenshot({ path: new URL(`frame-${String(i).padStart(4, '0')}.png`, output).pathname })
  }
  console.log(`Captured 190 frames at 25 FPS in ${output.pathname}`)
} finally {
  await browser.close()
}
