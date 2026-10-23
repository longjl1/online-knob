import { useEffect, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useLatest, useMechanicalFeedback, useReducedMotion, type MechanicalControlProps } from '../../lib/use-mechanical-feedback'
import type { StepDirection } from '../mechanical-bar/motion'
import { formatFlipValue } from './value'
import '../../styles/shared.css'
import './mechanical-flip.css'

export interface MechanicalFlipProps extends MechanicalControlProps {
  value: number
  digits?: number
  /** Omit for a display-only counter. Supply to enable arrows and side clicks. */
  onStep?: (direction: StepDirection) => void
}

export function MechanicalFlip({ value, digits = 4, onStep, sound = true, volume = 0.16,
  disabled = false, className, style, 'aria-label': label = 'Mechanical counter' }: MechanicalFlipProps) {
  const formatted = formatFlipValue(value, digits)
  const [displayed, setDisplayed] = useState(formatted)
  const [destination, setDestination] = useState<string | null>(null)
  const reduced = useReducedMotion()
  const feedback = useMechanicalFeedback(sound, volume, disabled)
  const latest = useLatest({ feedback, disabled })
  const help = useId()

  useEffect(() => {
    if (reduced || displayed.length !== formatted.length || disabled) {
      // Synchronize the physical flap faces after an external value/motion-mode change.
      // oxlint-disable-next-line react/set-state-in-effect
      setDisplayed(formatted); setDestination(null)
    } else if (!destination && formatted !== displayed) setDestination(formatted)
  }, [formatted, displayed, destination, reduced, disabled])

  useEffect(() => {
    if (!destination) return
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 0; i < destination.length; i++) {
      if (destination[i] !== displayed[i]) timers.push(setTimeout(() => latest.current.feedback.click('flip'), i * 35 + 155))
    }
    timers.push(setTimeout(() => { setDisplayed(destination); setDestination(null) }, 360 + destination.length * 35))
    return () => timers.forEach(clearTimeout)
  }, [destination, displayed, latest])

  const step = (direction: StepDirection) => {
    if (disabled) return
    feedback.unlock()
    onStep?.(direction)
    if (reduced) feedback.click('flip')
  }
  const from = displayed.length === formatted.length ? displayed : formatted
  const to = destination ?? from

  return <div data-mechanical-ui="flip" data-disabled={disabled} data-flipping={destination !== null}
    className={cn('mechanical-flip', className)} style={style} role="group" aria-label={label}
    onKeyDown={event => {
      if (!onStep || disabled || event.altKey || event.ctrlKey || event.metaKey) return
      const direction = ['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : null
      if (direction) { event.preventDefault(); event.stopPropagation(); step(direction) }
    }}>
    <span className="sr-only" aria-live="polite" aria-atomic="true">{formatted}</span>
    <span id={help} className="sr-only">Use arrow keys or click either half to change the counter.</span>
    <div className="mechanical-flip__case" aria-hidden="true">
      {Array.from(to).map((character, i) => {
        const changing = destination !== null && character !== from[i]
        return <div key={`${to.length}-${i}`} className="mechanical-flip__tile" style={{ '--flip-delay': `${i * 35}ms` } as React.CSSProperties}>
          <span className="mechanical-flip__half mechanical-flip__upper"><b>{character}</b></span>
          <span className="mechanical-flip__half mechanical-flip__lower"><b>{from[i]}</b></span>
          {changing && <span key={`top-${destination}`} className="mechanical-flip__half mechanical-flip__upper mechanical-flip__fall"><b>{from[i]}</b></span>}
          {changing && <span key={`bottom-${destination}`} className="mechanical-flip__half mechanical-flip__lower mechanical-flip__land"><b>{character}</b></span>}
          <span className="mechanical-flip__hinge" />
        </div>
      })}
    </div>
    {onStep && <>
      <Button type="button" variant="ghost" className="mechanical-flip__hit mechanical-flip__hit--left" disabled={disabled}
        aria-label={`${label}: decrease`} aria-describedby={help} onClick={() => step(-1)} />
      <Button type="button" variant="ghost" className="mechanical-flip__hit mechanical-flip__hit--right" disabled={disabled}
        aria-label={`${label}: increase`} aria-describedby={help} onClick={() => step(1)} />
    </>}
  </div>
}
