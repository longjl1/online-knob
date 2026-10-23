import { useEffect, useId, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useLatest, useMechanicalFeedback, useReducedMotion, type MechanicalControlProps } from '../../lib/use-mechanical-feedback'
import { normalizeThreshold, pullResistance, ReturnSpring } from './physics'
import '../../styles/shared.css'
import './spring-pull.css'

export interface SpringPullProps extends MechanicalControlProps {
  onTrigger?: () => void
  /** Called with normalized tension during user input, not the return animation. */
  onPullChange?: (progress: number) => void
  threshold?: number
}

export function SpringPull({ onTrigger, onPullChange, threshold = 0.72, sound = true,
  volume = 0.22, disabled = false, className, style, 'aria-label': label = 'Spring pull' }: SpringPullProps) {
  const root = useRef<HTMLDivElement>(null)
  const handle = useRef<HTMLButtonElement>(null)
  const coil = useRef<SVGPathElement>(null)
  const hint = useRef<HTMLSpanElement>(null)
  const spring = useRef(new ReturnSpring())
  const frame = useRef<number | null>(null)
  const lastFrame = useRef<number | null>(null)
  const pointer = useRef<{ id: number; x: number } | null>(null)
  const keyboard = useRef(false)
  const travel = useRef(160)
  const armed = useRef(false)
  const feedback = useMechanicalFeedback(sound, volume, disabled)
  const reduced = useReducedMotion()
  const latest = useLatest({ onTrigger, onPullChange, threshold: normalizeThreshold(threshold), disabled, reduced, feedback })
  const description = useId()

  const paint = () => {
    const progress = spring.current.position
    const displacement = progress * travel.current
    if (handle.current) handle.current.style.transform = `translateX(${displacement}px)`
    const length = Math.max(26, 45 + displacement)
    let path = 'M 24 64 L 31 64'
    for (let i = 0; i < 12; i++) {
      const start = 31 + (length - 14) * i / 12
      const end = 31 + (length - 14) * (i + 1) / 12
      const mid = (start + end) / 2
      path += ` Q ${mid} ${i % 2 ? 78 : 50} ${end} 64`
    }
    path += ` L ${24 + length} 64`
    coil.current?.setAttribute('d', path)
    const ready = progress >= latest.current.threshold && (pointer.current !== null || keyboard.current)
    root.current?.setAttribute('data-armed', String(ready))
    if (hint.current) hint.current.textContent = ready ? 'Release to activate' : 'Pull to arm'
    if (ready && !armed.current) latest.current.feedback.click()
    armed.current = ready
  }
  const report = () => latest.current.onPullChange?.(Math.max(0, Math.min(1, spring.current.position)))
  const animate = () => {
    if (frame.current !== null) return
    const tick = (now: number) => {
      frame.current = null
      const dt = lastFrame.current === null ? 1 / 60 : Math.min(0.04, (now - lastFrame.current) / 1000)
      lastFrame.current = now
      if (keyboard.current) {
        spring.current.position = Math.min(1, spring.current.position + dt * 1.5)
        spring.current.velocity = 0; report()
      } else spring.current.advance(dt, latest.current.reduced)
      paint()
      if ((keyboard.current || spring.current.moving) && !pointer.current) frame.current = requestAnimationFrame(tick)
      else lastFrame.current = null
    }
    frame.current = requestAnimationFrame(tick)
  }
  const release = (cancelled: boolean) => {
    const active = pointer.current !== null || keyboard.current
    const trigger = active && !cancelled && !latest.current.disabled && spring.current.position >= latest.current.threshold
    const current = pointer.current
    pointer.current = null; keyboard.current = false
    if (current && handle.current?.hasPointerCapture(current.id)) handle.current.releasePointerCapture(current.id)
    armed.current = false
    if (trigger) { latest.current.feedback.click('release'); latest.current.onTrigger?.() }
    latest.current.onPullChange?.(0)
    spring.current.velocity = 0
    animate()
  }
  const cancel = () => release(true)
  const actions = useLatest({ cancel, paint })

  useEffect(() => {
    const resize = () => {
      travel.current = Math.max(60, root.current!.clientWidth - 145)
      actions.current.paint()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(root.current!)
    resize()
    const stop = () => actions.current.cancel()
    const visibility = () => { if (document.hidden) stop() }
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null; pointer.current = null; keyboard.current = false
      observer.disconnect()
      window.removeEventListener('blur', stop)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [actions])
  useEffect(() => { if (disabled) actions.current.cancel() }, [disabled, actions])

  const activate = () => {
    if (disabled) return
    feedback.unlock()
    keyboard.current = true
    spring.current.position = 0.96
    paint(); release(false)
  }

  return <div ref={root} data-mechanical-ui="spring" data-disabled={disabled} data-armed="false"
    className={cn('spring-pull', className)} style={style}>
    <span id={description} className="sr-only">Pull right past the marker and release to activate. Hold Space and release, or press Enter. Escape cancels.</span>
    <div className="spring-pull__rail" aria-hidden="true" />
    <svg className="spring-pull__spring" aria-hidden="true"><path ref={coil} /></svg>
    <span className="spring-pull__anchor" aria-hidden="true" />
    <span className="spring-pull__threshold" style={{ left: `calc(72px + (100% - 145px) * ${normalizeThreshold(threshold)})` }} aria-hidden="true" />
    <span ref={hint} className="spring-pull__hint" aria-hidden="true">Pull to arm</span>
    <Button ref={handle} type="button" variant="ghost" disabled={disabled} className="spring-pull__handle"
      aria-label={label} aria-describedby={description} onBlur={cancel}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); cancel(); return }
        if (event.key === 'Enter') { event.preventDefault(); if (!event.repeat) activate(); return }
        if (event.key === ' ' && !event.repeat && !disabled && !pointer.current) {
          event.preventDefault(); feedback.unlock(); keyboard.current = true; animate()
        } else if (event.key === ' ') event.preventDefault()
      }}
      onKeyUp={event => { if (event.key === ' ') { event.preventDefault(); if (keyboard.current) release(false) } }}
      onClick={event => { if (event.detail === 0) activate() }}
      onPointerDown={event => {
        if (disabled || event.button !== 0 || pointer.current) return
        event.preventDefault(); handle.current?.focus({ preventScroll: true }); feedback.unlock()
        if (frame.current !== null) cancelAnimationFrame(frame.current)
        frame.current = null; lastFrame.current = null; keyboard.current = false
        pointer.current = { id: event.pointerId, x: event.clientX }
        spring.current.position = 0; spring.current.velocity = 0
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event => {
        if (pointer.current?.id !== event.pointerId) return
        spring.current.position = pullResistance(event.clientX - pointer.current.x, travel.current)
        paint(); report()
      }}
      onPointerUp={event => { if (pointer.current?.id === event.pointerId) release(false) }}
      onPointerCancel={event => { if (pointer.current?.id === event.pointerId) cancel() }}
      onLostPointerCapture={event => { if (pointer.current?.id === event.pointerId) cancel() }}>
      <span className="spring-pull__grip" aria-hidden="true" />
      <span className="spring-pull__arrow" aria-hidden="true">›</span>
    </Button>
  </div>
}
