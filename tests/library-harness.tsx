import { StrictMode, useLayoutEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { GearWheel, MechanicalFlip, SpringPull, type MechanicalControlProps } from '../src/index'
import '../src/index.css'

declare global {
  interface Window {
    mechanicalTests: {
      gear: number[]; flip: number[]; triggers: number; progress: number
      configure: (props: MechanicalControlProps) => void
      setValue: (value: number) => void; setDigits: (digits: number) => void; unmount: () => void
    }
  }
}
window.mechanicalTests = { gear: [], flip: [], triggers: 0, progress: 0,
  configure: () => {}, setValue: () => {}, setDigits: () => {}, unmount: () => {} }
export function LibraryHarness() {
  const [config, setConfig] = useState<MechanicalControlProps>({})
  const [value, setValue] = useState(42)
  const [digits, setDigits] = useState(4)
  const [mounted, setMounted] = useState(true)
  useLayoutEffect(() => {
    Object.assign(window.mechanicalTests, { configure: setConfig, setValue, setDigits, unmount: () => setMounted(false) })
  }, [])
  return <main style={{ display: 'flex', gap: 30, flexWrap: 'wrap', padding: 30 }}>
    {mounted && <>
      <GearWheel {...config} onStep={d => window.mechanicalTests.gear.push(d)} />
      <MechanicalFlip {...config} value={value} digits={digits} onStep={d => {
        window.mechanicalTests.flip.push(d); setValue(v => v + d)
      }} />
      <SpringPull {...config} onTrigger={() => window.mechanicalTests.triggers++}
        onPullChange={p => { window.mechanicalTests.progress = p }} />
    </>}
    <button id="outside">Outside</button>
  </main>
}
createRoot(document.getElementById('root')!).render(<StrictMode><LibraryHarness /></StrictMode>)
