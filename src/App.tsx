import { useState } from 'react'
import { MechanicalBar, GearWheel, MechanicalFlip, SpringPull } from './index'
import { Button } from './components/ui/button'
import './showcase.css'

export default function App() {
  const [sound, setSound] = useState(true)
  const [flip, setFlip] = useState(42)
  const demo = new URLSearchParams(window.location.search).get('demo')
  const controls = {
    bar: <MechanicalBar style={{ '--bar-color': '#737d86' }} sound={sound} autoFocus={demo === 'bar'} />,
    gear: <GearWheel sound={sound} />,
    flip: <MechanicalFlip sound={sound} value={flip} onStep={d => setFlip(v => v + d)} />,
    spring: <SpringPull sound={sound} />,
  }
  if (demo && demo in controls) return <main className="preview">{controls[demo as keyof typeof controls]}</main>
  return <main className="showcase" aria-label="Mechanical UI component collection">
    <div className="showcase__panel">
      {Object.entries(controls).map(([id, control]) => <section className="showcase__stage" key={id} aria-label={id}>
        {control}
      </section>)}
    </div>
    <Button variant="ghost" className="showcase__sound" aria-label="Mechanical sounds" aria-pressed={sound}
      title={sound ? 'Mute mechanical sounds' : 'Enable mechanical sounds'} onClick={() => setSound(v => !v)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4Z" />
        {sound ? <><path d="M15 8a6 6 0 0 1 0 8" /><path d="M18 5a10 10 0 0 1 0 14" /></> : <path d="m16 9 6 6m0-6-6 6" />}
      </svg>
    </Button>
  </main>
}
