import { StrictMode, useLayoutEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MechanicalBar, type MechanicalBarProps } from '../src/components/mechanical-bar'
import '../src/index.css'

declare global {
  interface Window {
    barTest: {
      steps: number[][]
      configure: (props: MechanicalBarProps) => void
      unmount: () => void
    }
  }
}
window.barTest = { steps: [[], []], configure: () => {}, unmount: () => {} }
export function Harness() {
  const [props, setProps] = useState<MechanicalBarProps>({})
  const [mounted, setMounted] = useState(true)
  useLayoutEffect(() => {
    window.barTest.configure = setProps
    window.barTest.unmount = () => setMounted(false)
  }, [])
  return <main style={{ padding: 24 }}>
    {mounted && <MechanicalBar aria-label="First" {...props} onStep={delta => window.barTest.steps[0].push(delta)} />}
    <MechanicalBar aria-label="Second" onStep={delta => window.barTest.steps[1].push(delta)} />
    <button id="outside">Outside</button>
  </main>
}
createRoot(document.getElementById('root')!).render(<StrictMode><Harness /></StrictMode>)
