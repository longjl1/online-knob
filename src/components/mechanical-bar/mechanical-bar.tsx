import { useId, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MechanicalAudio } from './audio'
import { DetentMotion, lensWeight, wrap, type StepDirection } from './motion'
import './mechanical-bar.css'
import '../../styles/shared.css'

export interface MechanicalBarProps {
  /** Fires on an actual tooth crossing: -1 is left, +1 is right. */
  onStep?: (delta: StepDirection) => void
  sound?: boolean
  /** Master gain, clamped to 0–1. */
  volume?: number
  disabled?: boolean
  className?: string
  style?: CSSProperties & { [key: `--bar-${string}`]: string | number }
  'aria-label'?: string
  /** Off by default so embedded controls never steal focus. */
  autoFocus?: boolean
}

type Controller = {
  press: (direction: StepDirection) => void
  keyDown: (direction: StepDirection) => void
  keyUp: (direction: StepDirection) => void
  cancel: () => void
  refresh: () => void
  configure: () => void
}

export function MechanicalBar({
  onStep,
  sound = true,
  volume = 0.22,
  disabled = false,
  className,
  style,
  'aria-label': label = '机械刻度条',
  autoFocus = false,
}: MechanicalBarProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLDivElement>(null)
  const controller = useRef<Controller | null>(null)
  const options = useRef({ onStep, sound, volume, disabled })
  const helpId = useId()

  useLayoutEffect(() => {
    options.current = { onStep, sound, volume, disabled }
    controller.current?.configure()
  }, [onStep, sound, volume, disabled])

  useLayoutEffect(() => {
    const root = rootRef.current!
    const field = fieldRef.current!
    const motion = new DetentMotion()
    const audio = new MechanicalAudio()
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let teeth: HTMLSpanElement[] = []
    let pitch = 10
    let baseHeight = 32
    let baseWidth = 2
    let magnification = 2.4
    let radius = 72
    let frame: number | null = null
    let previousTime: number | null = null
    let held: StepDirection | null = null
    let repeated = false
    let repeatTimer: ReturnType<typeof setTimeout> | null = null
    let disposed = false

    const paint = () => {
      const span = teeth.length * pitch
      const phase = (motion.position % teeth.length) * pitch
      const middle = Math.floor(teeth.length / 2)
      for (let i = 0; i < teeth.length; i++) {
        const x = wrap((i - middle) * pitch + phase + span / 2, span) - span / 2
        const weight = lensWeight(x, radius)
        const height = (1 + (magnification - 1) * weight) * ((i - middle) % 5 === 0 ? 1 : 0.88)
        const width = 1 + 0.65 * weight
        const accent = Math.max(0, 1 - Math.abs(x) / (pitch * 1.2))
        const tooth = teeth[i]
        tooth.style.transform = `translate(${x - baseWidth / 2}px, -50%) scale(${width}, ${height})`
        tooth.style.opacity = String(0.36 + 0.64 * weight)
        tooth.style.setProperty('--tooth-accent', `${accent * 100}%`)
      }
    }

    const emit = (steps: StepDirection[]) => {
      for (const direction of steps) {
        if (disposed || options.current.disabled) break
        audio.click()
        options.current.onStep?.(direction)
      }
    }

    const tick = (time: number) => {
      frame = null
      if (disposed) return
      const dt = previousTime === null ? 1 / 60 : (time - previousTime) / 1000
      previousTime = time
      const steps = motion.advance(dt, media.matches)
      paint()
      emit(steps)
      if (!disposed && motion.moving) frame = requestAnimationFrame(tick)
      else previousTime = null
    }

    const animate = () => {
      if (frame === null && !disposed) frame = requestAnimationFrame(tick)
    }

    const clearRepeat = () => {
      if (repeatTimer !== null) clearTimeout(repeatTimer)
      repeatTimer = null
      held = null
    }

    const cancel = () => {
      clearRepeat()
      repeated = false
      motion.release()
      animate()
    }

    const press = (direction: StepDirection) => {
      if (options.current.disabled) return
      audio.unlock()
      motion.step(direction)
      animate()
    }

    const scheduleRepeat = (delay: number) => {
      repeatTimer = setTimeout(() => {
        if (held === null || options.current.disabled || document.hidden) return
        repeated = true
        press(held)
        scheduleRepeat(72)
      }, delay)
    }

    const refresh = () => {
      const css = getComputedStyle(root)
      const number = (name: string, fallback: number, min: number, max: number) => {
        const value = parseFloat(css.getPropertyValue(name))
        return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
      }
      pitch = number('--bar-spacing', 10, 4, 40)
      baseHeight = number('--bar-height', 32, 4, 100)
      baseWidth = number('--bar-width', 2, 1, pitch / 2)
      magnification = number('--bar-magnification', 2.4, 1, 4)
      radius = number('--bar-lens-radius', 72, 10, 250)
      const count = Math.ceil(root.clientWidth / pitch / 5) * 5 + 15
      if (count !== teeth.length) {
        teeth = Array.from({ length: count }, () => {
          const tooth = document.createElement('span')
          tooth.className = 'mechanical-bar__tooth'
          return tooth
        })
        field.replaceChildren(...teeth)
      }
      for (const tooth of teeth) {
        tooth.style.height = `${baseHeight}px`
        tooth.style.width = `${baseWidth}px`
      }
      paint()
    }

    const configure = () => {
      audio.configure(options.current.sound && !options.current.disabled, options.current.volume)
      if (options.current.disabled) cancel()
    }

    controller.current = {
      press,
      keyDown(direction) {
        if (options.current.disabled || held === direction) return
        const reversing = held !== null
        clearRepeat()
        held = direction
        repeated = false
        audio.unlock()
        if (reversing) motion.reverse(direction)
        else motion.step(direction)
        animate()
        scheduleRepeat(280)
      },
      keyUp(direction) {
        if (held !== direction) return
        clearRepeat()
        if (repeated) {
          motion.release()
          animate()
        }
        repeated = false
      },
      cancel, refresh, configure,
    }

    const visibility = () => { if (document.hidden) cancel() }
    const onMotionPreference = () => { cancel(); animate() }
    const observer = new ResizeObserver(refresh)
    observer.observe(root)
    window.addEventListener('blur', cancel)
    document.addEventListener('visibilitychange', visibility)
    media.addEventListener('change', onMotionPreference)
    configure()
    refresh()

    return () => {
      disposed = true
      clearRepeat()
      if (frame !== null) cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('blur', cancel)
      document.removeEventListener('visibilitychange', visibility)
      media.removeEventListener('change', onMotionPreference)
      audio.dispose()
      field.replaceChildren()
      controller.current = null
    }
  }, [])

  useLayoutEffect(() => { controller.current?.refresh() }, [className, style])

  const keyboard = (event: KeyboardEvent<HTMLDivElement>, down: boolean) => {
    if (disabled || (down && (event.altKey || event.ctrlKey || event.metaKey))) return
    const direction = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : null
    if (direction === null) return
    event.preventDefault()
    event.stopPropagation()
    if (down) {
      if (!event.repeat) controller.current?.keyDown(direction)
    } else controller.current?.keyUp(direction)
  }

  return (
    <div
      ref={rootRef}
      data-mechanical-ui="bar"
      role="group"
      aria-label={label}
      aria-describedby={helpId}
      aria-disabled={disabled || undefined}
      className={cn('mechanical-bar', className)}
      style={style}
      data-disabled={disabled}
      onKeyDown={(event) => keyboard(event, true)}
      onKeyUp={(event) => keyboard(event, false)}
      onBlur={() => controller.current?.cancel()}
    >
      <span id={helpId} className="sr-only">使用左右方向键移动刻度，长按可连续移动；也可点击左半或右半。</span>
      <div ref={fieldRef} className="mechanical-bar__field" aria-hidden="true" />
      <Button type="button" variant="ghost" disabled={disabled} autoFocus={autoFocus}
        aria-label={`${label}：向左移动`}
        className="mechanical-bar__hit mechanical-bar__hit--left"
        onClick={() => controller.current?.press(-1)} />
      <Button type="button" variant="ghost" disabled={disabled}
        aria-label={`${label}：向右移动`}
        className="mechanical-bar__hit mechanical-bar__hit--right"
        onClick={() => controller.current?.press(1)} />
    </div>
  )
}
