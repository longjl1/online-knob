/** Each mounted bar owns its audio context; nothing is created before a gesture. */
export class MechanicalAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private enabled = true
  private volume = 0.22
  private disposed = false

  configure(enabled: boolean, volume: number) {
    this.enabled = enabled
    this.volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.22
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(enabled ? this.volume : 0, this.context.currentTime, 0.005)
    }
  }

  unlock() {
    if (this.disposed || !this.enabled || this.volume === 0) return
    try {
      if (!this.context) {
        if (typeof window.AudioContext !== 'function') return
        const context = new AudioContext()
        this.context = context
        this.master = context.createGain()
        this.master.gain.value = this.volume
        this.master.connect(context.destination)
        this.noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.035), context.sampleRate)
        const samples = this.noise.getChannelData(0)
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {})
    } catch {
      // Audio policies or unavailable hardware must never interrupt the control.
    }
  }

  click() {
    const context = this.context
    if (!this.enabled || this.disposed || !context || context.state !== 'running' || !this.master || !this.noise) return
    const now = context.currentTime
    const noise = context.createBufferSource()
    noise.buffer = this.noise
    const filter = context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 2600 + Math.random() * 250
    filter.Q.value = 0.75
    const tick = context.createGain()
    tick.gain.setValueAtTime(0, now)
    tick.gain.linearRampToValueAtTime(0.72, now + 0.001)
    tick.gain.exponentialRampToValueAtTime(0.001, now + 0.028)
    noise.connect(filter).connect(tick).connect(this.master)
    noise.start(now)
    noise.stop(now + 0.035)
    noise.onended = () => { noise.disconnect(); filter.disconnect(); tick.disconnect() }

    const body = context.createOscillator()
    body.type = 'triangle'
    body.frequency.setValueAtTime(185, now)
    body.frequency.exponentialRampToValueAtTime(75, now + 0.026)
    const knock = context.createGain()
    knock.gain.setValueAtTime(0, now)
    knock.gain.linearRampToValueAtTime(0.48, now + 0.001)
    knock.gain.exponentialRampToValueAtTime(0.001, now + 0.032)
    body.connect(knock).connect(this.master)
    body.start(now)
    body.stop(now + 0.035)
    body.onended = () => { body.disconnect(); knock.disconnect() }
  }

  dispose() {
    this.disposed = true
    this.master?.disconnect()
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {})
    this.context = null
    this.master = null
    this.noise = null
  }
}
