import { useEffect, useId, useRef, type PointerEvent } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useLatest, useMechanicalFeedback, useReducedMotion, type MechanicalControlProps } from '../../lib/use-mechanical-feedback'
import type { StepDirection } from '../mechanical-bar/motion'
import { WheelMotion } from './motion'
import '../../styles/shared.css'
import './gear-wheel.css'

export interface GearWheelProps extends MechanicalControlProps {
  onStep?: (delta: StepDirection) => void
}

export function GearWheel({ onStep, sound = true, volume = 0.18, disabled = false,
  className, style, 'aria-label': label = 'Gear wheel' }: GearWheelProps) {
  const button = useRef<HTMLButtonElement>(null)
  const rotor = useRef<HTMLSpanElement>(null)
  const motion = useRef(new WheelMotion())
  const frame = useRef<number | null>(null)
  const lastFrame = useRef<number | null>(null)
  const drag = useRef<{ id: number; y: number; origin: number; moved: boolean; time: number } | null>(null)
  const suppressClick = useRef(false)
  const feedback = useMechanicalFeedback(sound, volume, disabled)
  const reduced = useReducedMotion()
  const latest = useLatest({ onStep, disabled, reduced, feedback })
  const help = useId()

  const paint = () => {
    if (rotor.current) rotor.current.style.transform = `rotate(${motion.current.position * 9}deg)`
  }
  const emit = (steps: StepDirection[]) => {
    if (latest.current.disabled) return
    for (const direction of steps) {
      latest.current.feedback.click()
      latest.current.onStep?.(direction)
    }
  }
  const animate = () => {
    if (frame.current !== null) return
    const tick = (now: number) => {
      frame.current = null
      const dt = lastFrame.current === null ? 1 / 60 : (now - lastFrame.current) / 1000
      lastFrame.current = now
      emit(motion.current.advance(dt, latest.current.reduced))
      paint()
      if (motion.current.moving && !drag.current) frame.current = requestAnimationFrame(tick)
      else lastFrame.current = null
    }
    frame.current = requestAnimationFrame(tick)
  }
  const cancel = () => {
    const active = drag.current
    drag.current = null
    if (active && button.current?.hasPointerCapture(active.id)) button.current.releasePointerCapture(active.id)
    motion.current.stop()
    animate()
  }
  const step = (direction: StepDirection) => {
    if (latest.current.disabled || drag.current) return
    latest.current.feedback.unlock()
    motion.current.step(direction)
    animate()
  }
  const actions = useLatest({ cancel, step })

  useEffect(() => {
    const element = button.current!
    let remainder = 0
    const wheel = (event: WheelEvent) => {
      if (latest.current.disabled) return
      event.preventDefault()
      remainder += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 240 : 1)
      const count = Math.min(8, Math.floor(Math.abs(remainder) / 32))
      const direction = Math.sign(remainder) as StepDirection
      for (let i = 0; i < count; i++) actions.current.step(direction)
      remainder -= count * 32 * direction
      remainder = Math.max(-256, Math.min(256, remainder))
    }
    const stop = () => actions.current.cancel()
    const visibility = () => { if (document.hidden) stop() }
    element.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
      drag.current = null
      element.removeEventListener('wheel', wheel)
      window.removeEventListener('blur', stop)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [actions, latest])
  useEffect(() => { if (disabled) actions.current.cancel() }, [disabled, actions])

  const finish = (event: PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const active = drag.current
    if (!active || event.pointerId !== active.id) return
    drag.current = null
    suppressClick.current = active.moved || cancelled
    if (event.currentTarget.hasPointerCapture(active.id)) event.currentTarget.releasePointerCapture(active.id)
    if (cancelled) motion.current.stop()
    else motion.current.release(reduced, performance.now() - active.time > 90)
    animate()
  }

  return <div data-mechanical-ui="gear" data-disabled={disabled} className={cn('gear-wheel', className)} style={style}>
    <span id={help} className="sr-only">Drag vertically, scroll, or use arrow keys. Click to advance one tooth.</span>
    <span className="gear-wheel__index" aria-hidden="true" />
    <Button ref={button} type="button" variant="ghost" className="gear-wheel__control" disabled={disabled}
      aria-label={label} aria-describedby={help} onBlur={cancel}
      onKeyDown={event => {
        const direction = ['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : null
        if (direction && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault(); event.stopPropagation(); step(direction)
        }
      }}
      onClick={() => { if (suppressClick.current) suppressClick.current = false; else step(1) }}
      onPointerDown={event => {
        if (disabled || event.button !== 0 || drag.current) return
        feedback.unlock()
        button.current?.focus({ preventScroll: true })
        if (frame.current !== null) cancelAnimationFrame(frame.current)
        frame.current = null; lastFrame.current = null
        motion.current.stop(); suppressClick.current = false
        drag.current = { id: event.pointerId, y: event.clientY, origin: motion.current.position, moved: false, time: performance.now() }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event => {
        const active = drag.current
        if (!active || active.id !== event.pointerId) return
        const distance = active.y - event.clientY
        active.moved ||= Math.abs(distance) > 3
        const now = performance.now()
        emit(motion.current.drag(active.origin + distance / 8, (now - active.time) / 1000))
        active.time = now; paint()
      }}
      onPointerUp={event => finish(event, false)} onPointerCancel={event => finish(event, true)}
      onLostPointerCapture={event => { if (drag.current?.id === event.pointerId) finish(event, true) }}>
      <span className="gear-wheel__rotor" ref={rotor} aria-hidden="true">
        {Array.from({ length: 40 }, (_, i) => <i key={i} className="gear-wheel__tooth" style={{ transform: `rotate(${i * 9}deg) translateY(-88px)` }} />)}
        <span className="gear-wheel__rim" />
        {Array.from({ length: 20 }, (_, i) => <i key={i} className="gear-wheel__mark" style={{ transform: `rotate(${i * 18}deg) translateY(-67px)` }} />)}
        <span className="gear-wheel__witness" />
      </span>
    </Button>
  </div>
}
