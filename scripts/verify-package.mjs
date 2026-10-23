import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { createServer, build } from 'vite'
import { chromium } from '@playwright/test'

const root = fileURLToPath(new URL('../', import.meta.url))
const fixture = `${root}tests/artifacts/package-consumer`
await mkdir(fixture, { recursive:true })
const packed = JSON.parse(execFileSync('npm',['pack','--ignore-scripts','--json','--cache','/private/tmp/online-knob-npm-cache','--pack-destination',fixture],{cwd:root,encoding:'utf8'}))[0]
const target = `${fixture}/node_modules/@longjl1/mechanical-ui`
await mkdir(target,{recursive:true})
execFileSync('tar',['-xzf',`${fixture}/${packed.filename}`,'--strip-components=1','-C',target])
await writeFile(`${fixture}/package.json`,JSON.stringify({name:'mechanical-ui-consumer',private:true,type:'module'}))
await writeFile(`${fixture}/index.html`,'<!doctype html><html lang="en"><title>Package verification</title><div id="root"></div><script type="module" src="/main.tsx"></script></html>')
await writeFile(`${fixture}/tsconfig.json`,JSON.stringify({compilerOptions:{target:'ES2022',lib:['ES2022','DOM'],module:'ESNext',moduleResolution:'Bundler',jsx:'react-jsx',strict:true,noEmit:true,skipLibCheck:false,noUncheckedSideEffectImports:true,types:['react','react-dom']},include:['main.tsx','styles.d.ts']}))
await writeFile(`${fixture}/styles.d.ts`,"declare module '*.css' {}\n")
await writeFile(`${fixture}/main.tsx`, `import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MechanicalBar, type MechanicalControlProps } from '@longjl1/mechanical-ui'
import { GearWheel } from '@longjl1/mechanical-ui/gear-wheel'
import { MechanicalFlip } from '@longjl1/mechanical-ui/mechanical-flip'
import { SpringPull } from '@longjl1/mechanical-ui/spring-pull'
import type { MechanicalBarProps } from '@longjl1/mechanical-ui/mechanical-bar'
import '@longjl1/mechanical-ui/styles.css'
function Consumer() {
 const [value,setValue]=useState(42)
 const shared: MechanicalControlProps = {sound:false}
 const bar: MechanicalBarProps = {...shared,onStep:d=>setValue(v=>v+d)}
 return <main style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:40,padding:40,background:'#fff'}}>
  <MechanicalBar {...bar}/><GearWheel {...shared}/>
  <MechanicalFlip {...shared} value={value} onStep={d=>setValue(v=>v+d)}/>
  <SpringPull {...shared} onTrigger={()=>setValue(v=>v+1)}/>
 </main>
}
createRoot(document.getElementById('root')!).render(<Consumer />)
`)
execFileSync(process.execPath,[`${root}node_modules/typescript/bin/tsc`,'-p',`${fixture}/tsconfig.json`],{stdio:'inherit'})
await build({configFile:false,root:fixture,logLevel:'error',build:{outDir:'build'}})
const server = await createServer({configFile:false,root:fixture,logLevel:'error',server:{host:'127.0.0.1',port:5184,strictPort:true}})
await server.listen()
const browser = await chromium.launch({channel:'chrome',headless:true})
try {
 const page=await browser.newPage({viewport:{width:1000,height:600}})
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://127.0.0.1:5184/')
 await page.locator('.gear-wheel__control').waitFor()
 assert.equal(await page.locator('[data-mechanical-ui]').count(),4)
 const style=await page.locator('.gear-wheel__control').evaluate(e=>({width:getComputedStyle(e).width,radius:getComputedStyle(e).borderRadius}))
 assert.deepEqual(style,{width:'192px',radius:'50%'})
 await page.getByRole('button',{name:'Mechanical counter: increase'}).click()
 await page.waitForFunction(()=>document.querySelector('.mechanical-flip [aria-live]').textContent==='0043')
 await page.waitForTimeout(650)
 await page.screenshot({path:`${root}tests/artifacts/package-consumer.png`})
 assert.deepEqual(errors,[])
 console.log('Packed library: strict consumer types, production build, scoped CSS and browser interaction passed without Tailwind or source aliases.')
} finally { await browser.close();await server.close() }
