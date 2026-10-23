import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { MechanicalAudio, type MechanicalSound } from './mechanical-audio'

export interface MechanicalControlProps {
  sound?: boolean
  volume?: number
  disabled?: boolean
  className?: string
  style?: CSSProperties & { [key: `--${string}`]: string | number }
  'aria-label'?: string
}

export function useMechanicalFeedback(sound: boolean, volume: number, disabled: boolean) {
  const audio = useRef<MechanicalAudio | null>(null)
  useEffect(() => {
    audio.current = new MechanicalAudio()
    return () => { audio.current?.dispose(); audio.current = null }
  }, [])
  useEffect(() => { audio.current?.configure(sound && !disabled, volume) }, [sound, volume, disabled])
  const unlock = useCallback(() => audio.current?.unlock(), [])
  const click = useCallback((kind: MechanicalSound = 'tick') => audio.current?.click(kind), [])
  return { unlock, click }
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

export function useLatest<T>(value: T) {
  const ref = useRef(value)
  useLayoutEffect(() => { ref.current = value }, [value])
  return ref
}
