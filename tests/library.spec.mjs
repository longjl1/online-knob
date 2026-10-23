import { test, expect } from '@playwright/test'
const gear = page => page.getByRole('button', { name: 'Gear wheel', exact: true })
const spring = page => page.getByRole('button', { name: 'Spring pull', exact: true })
const state = page => page.evaluate(() => ({gear: window.mechanicalTests.gear, flip: window.mechanicalTests.flip, triggers: window.mechanicalTests.triggers, progress: window.mechanicalTests.progress}))
const harness = async page => { await page.goto('/tests/library-harness.html'); await expect(gear(page)).toBeVisible() }
async function drag(page, target, dx, dy, frames = 12) {
  const box = await target.boundingBox()
  const x = box.x + box.width / 2, y = box.y + box.height / 2
  await page.mouse.move(x, y); await page.mouse.down()
  for (let i = 1; i <= frames; i++) { await page.mouse.move(x + dx * i / frames, y + dy * i / frames); await page.waitForTimeout(12) }
}

test('clean white showcase renders four independent components on desktop and mobile', async ({ page }) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('/')
  await expect(page.locator('[data-mechanical-ui]')).toHaveCount(4)
  expect(await page.locator('html').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)')
  await page.screenshot({path:'tests/artifacts/library-desktop.png',fullPage:true})
  await page.setViewportSize({width:375,height:812})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(375)
  await page.screenshot({path:'tests/artifacts/library-mobile.png',fullPage:true})
  expect(errors).toEqual([])
})

test('gear supports single detents, pointer inertia, scrolling and focus isolation', async ({page})=>{
  await harness(page)
  await gear(page).click()
  await expect.poll(async()=> (await state(page)).gear).toEqual([1])
  await page.waitForTimeout(500)
  expect((await state(page)).gear).toEqual([1])
  await drag(page,gear(page),0,-100)
  const released=(await state(page)).gear.length
  await page.mouse.up()
  await expect.poll(async()=> (await state(page)).gear.length).toBeGreaterThan(released)
  await page.waitForTimeout(1500)
  const settled=(await state(page)).gear.length
  await page.waitForTimeout(200)
  expect((await state(page)).gear.length).toBe(settled)
  await gear(page).hover();await page.mouse.wheel(0,-96)
  await expect.poll(async()=> (await state(page)).gear.filter(x=>x===-1).length).toBeGreaterThanOrEqual(3)
  await page.locator('#outside').focus();await page.keyboard.press('ArrowRight')
  expect((await state(page)).flip).toEqual([])
})

test('split flap animates changed digits and converges to latest controlled value', async({page})=>{
  await harness(page)
  await page.getByRole('button',{name:'Mechanical counter: increase'}).click()
  await expect(page.locator('[data-mechanical-ui="flip"]')).toHaveAttribute('data-flipping','true')
  await expect(page.locator('.mechanical-flip__land')).toHaveCount(1)
  await page.evaluate(()=>window.mechanicalTests.setValue(1099))
  await page.evaluate(()=>window.mechanicalTests.setValue(2103))
  await expect(page.locator('.mechanical-flip [aria-live]')).toHaveText('2103')
  await expect.poll(()=>page.locator('.mechanical-flip__upper:not(.mechanical-flip__fall) b').allTextContents()).toEqual(['2','1','0','3'])
  await expect(page.locator('[data-mechanical-ui="flip"]')).toHaveAttribute('data-flipping','false')
  await page.evaluate(()=>window.mechanicalTests.setDigits(2))
  await expect(page.locator('.mechanical-flip__tile')).toHaveCount(2)
  await expect(page.locator('.mechanical-flip [aria-live]')).toHaveText('03')
})

test('spring cancels short pulls, arms past the marker and triggers once on release',async({page})=>{
  await harness(page)
  await drag(page,spring(page),35,0)
  await page.mouse.up();await page.waitForTimeout(500)
  expect((await state(page)).triggers).toBe(0)
  await drag(page,spring(page),270,0)
  await expect(page.locator('[data-mechanical-ui="spring"]')).toHaveAttribute('data-armed','true')
  expect((await state(page)).triggers).toBe(0)
  await page.mouse.up()
  await expect.poll(async()=> (await state(page)).triggers).toBe(1)
  await page.waitForTimeout(800)
  expect((await state(page)).triggers).toBe(1)
  expect(await spring(page).evaluate(el=>getComputedStyle(el).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)')
})

test('spring keyboard hold, Enter and Escape preserve deliberate activation',async({page})=>{
  await harness(page);await spring(page).focus()
  await page.keyboard.down('Space');await page.waitForTimeout(650);await page.keyboard.up('Space')
  await expect.poll(async()=> (await state(page)).triggers).toBe(1)
  await page.keyboard.press('Enter')
  await expect.poll(async()=> (await state(page)).triggers).toBe(2)
  await page.keyboard.down('Space');await page.waitForTimeout(650);await page.keyboard.press('Escape');await page.keyboard.up('Space')
  await page.waitForTimeout(400)
  expect((await state(page)).triggers).toBe(2)
})

test('disabled controls and cancellation on focus loss do not trigger actions',async({page})=>{
  await harness(page)
  await drag(page,spring(page),270,0)
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')))
  await page.mouse.up();await page.waitForTimeout(400)
  expect((await state(page)).triggers).toBe(0)
  await page.evaluate(()=>window.mechanicalTests.configure({disabled:true}))
  await expect(gear(page)).toBeDisabled();await expect(spring(page)).toBeDisabled()
  await expect(page.getByRole('button',{name:'Mechanical counter: increase'})).toBeDisabled()
})

test('reduced motion removes gear inertia, flip travel and spring rebound',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await harness(page)
  await drag(page,gear(page),0,-80);await page.mouse.up();await page.waitForTimeout(80)
  const count=(await state(page)).gear.length
  await page.waitForTimeout(300);expect((await state(page)).gear.length).toBe(count)
  await page.getByRole('button',{name:'Mechanical counter: increase'}).click()
  await expect(page.locator('.mechanical-flip [aria-live]')).toHaveText('0043')
  await expect(page.locator('.mechanical-flip__land')).toHaveCount(0)
  await spring(page).focus();await page.keyboard.press('Enter');await page.waitForTimeout(80)
  expect(await spring(page).evaluate(el=>getComputedStyle(el).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)')
})

test('active animation cleanup closes audio contexts and leaves no callbacks',async({page})=>{
  await page.addInitScript(()=>{
    window.audioCounts={created:0,closed:0,starts:0}; const Native=window.AudioContext
    window.AudioContext=class extends Native {
      constructor(...args){super(...args);window.audioCounts.created++}
      close(){window.audioCounts.closed++;return super.close()}
      createBufferSource(){const node=super.createBufferSource();const start=node.start.bind(node);node.start=(...args)=>{window.audioCounts.starts++;return start(...args)};return node}
    }
  })
  await harness(page)
  await gear(page).click();await page.waitForTimeout(150)
  await page.getByRole('button',{name:'Mechanical counter: increase'}).click();await page.waitForTimeout(250)
  await spring(page).focus();await page.keyboard.press('Enter')
  await expect.poll(()=>page.evaluate(()=>window.audioCounts.created)).toBe(3)
  expect(await page.evaluate(()=>window.audioCounts.starts)).toBeGreaterThanOrEqual(3)
  await page.evaluate(()=>window.mechanicalTests.configure({sound:false}))
  await page.waitForTimeout(600)
  const sounds=await page.evaluate(()=>window.audioCounts.starts)
  await gear(page).click();await page.waitForTimeout(300)
  expect(await page.evaluate(()=>window.audioCounts.starts)).toBe(sounds)
  await page.evaluate(()=>window.mechanicalTests.unmount())
  await expect(page.locator('[data-mechanical-ui]')).toHaveCount(0)
  await expect.poll(()=>page.evaluate(()=>window.audioCounts.closed)).toBe(3)
  const final=await state(page);await page.waitForTimeout(500);expect(await state(page)).toEqual(final)
})

test('touch drags rotate the wheel and release an armed spring at phone width',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})
  const page=await context.newPage()
  try {
    await page.goto('http://127.0.0.1:5173/tests/library-harness.html')
    const client=await context.newCDPSession(page)
    async function touchDrag(target,dx,dy) {
      await target.scrollIntoViewIfNeeded()
      const b=await target.boundingBox(), x=b.x+b.width/2,y=b.y+b.height/2
      await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]})
      for(let i=1;i<=12;i++) {
        await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/12,y:y+dy*i/12}]})
        await page.waitForTimeout(15)
      }
      await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
    }
    await touchDrag(gear(page),0,-80)
    await expect.poll(async()=> (await state(page)).gear.length).toBeGreaterThan(5)
    await touchDrag(spring(page),260,0)
    await expect.poll(async()=> (await state(page)).triggers).toBe(1)
    await page.evaluate(()=>window.mechanicalTests.setDigits(6))
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390)
  } finally { await context.close() }
})
