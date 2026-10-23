import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

// Capture real component interactions using deterministic browser time at 25 FPS.
const names = ['bar', 'gear', 'flip', 'spring']
const selected = process.argv[2] ?? 'all'
if (selected !== 'all' && !names.includes(selected)) throw new Error('Choose bar, gear, flip, spring, or all.')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  for (const name of selected === 'all' ? names : [selected]) {
    const output = new URL(`../tests/artifacts/gif-frames/${name}/`, import.meta.url)
    await mkdir(output, { recursive: true })
    await writeFile(new URL('capture.json',output), JSON.stringify({complete:false}))
    const page = await browser.newPage({ viewport: { width: 720, height: 320 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' })
    await page.clock.install({ time: new Date('2026-10-24T00:00:00Z') })
    const url = new URL(process.env.DEMO_URL || 'http://127.0.0.1:5173/')
    url.searchParams.set('demo', name)
    await page.goto(url.href)
    await page.locator('[data-mechanical-ui]').waitFor()
    await page.clock.pauseAt(new Date('2026-10-24T00:00:01Z'))
    const target = page.locator('[data-mechanical-ui] button').last()
    const bounds = await target.boundingBox()
    const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2
    if (name === 'gear' || name === 'flip') await target.focus()
    for (let i = 0; i < 190; i++) {
      if (name === 'bar') {
        if (i === 10 || i === 25) await page.keyboard.press('ArrowRight')
        if (i === 40 || i === 55) await page.keyboard.press('ArrowLeft')
        if (i === 70) await page.keyboard.down('ArrowRight')
        if (i === 110) await page.keyboard.up('ArrowRight')
        if (i === 125) await page.keyboard.down('ArrowLeft')
        if (i === 165) await page.keyboard.up('ArrowLeft')
      } else if (name === 'gear') {
        if (i === 10 || i === 25) await page.keyboard.press('ArrowRight')
        if (i === 45 || i === 110) { await page.mouse.move(x,y); await page.mouse.down() }
        if (i >= 46 && i <= 60) await page.mouse.move(x,y-(i-45)*7)
        if (i >= 111 && i <= 130) await page.mouse.move(x,y+(i-110)*5)
        if (i === 61 || i === 131) await page.mouse.up()
      } else if (name === 'flip') {
        if ([10,28,46,64,82,100,118,136].includes(i)) await page.keyboard.press('ArrowRight')
        if (i === 160) await page.keyboard.press('ArrowLeft')
      } else {
        if (i === 15 || i === 75 || i === 135) { await page.mouse.move(x,y); await page.mouse.down() }
        if (i >= 16 && i <= 30) await page.mouse.move(x+(i-15)*3,y)
        if (i >= 76 && i <= 100) await page.mouse.move(x+(i-75)*11,y)
        if (i >= 136 && i <= 155) await page.mouse.move(x+(i-135)*14,y)
        if (i === 35 || i === 108 || i === 162) await page.mouse.up()
      }
      await page.clock.runFor(40)
      // CSS and rAF use different clocks. Advance native flap animations alongside rAF.
      await page.evaluate(() => {
        for (const animation of document.getAnimations()) {
          if (animation.playState !== 'paused') { animation.pause(); animation.currentTime = 0 }
          animation.currentTime = Number(animation.currentTime) + 40
        }
      })
      await page.screenshot({ path: new URL(`frame-${String(i).padStart(4,'0')}.png`,output).pathname })
    }
    await writeFile(new URL('capture.json',output), JSON.stringify({ complete:true, frames:190, duration:40, width:720, height:320, component:name }))
    await page.close()
    console.log(`${name}: captured 190 frames at 25 FPS`)
  }
} finally { await browser.close() }
