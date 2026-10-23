import { DetentMotion, type StepDirection } from '../mechanical-bar/motion'

export class WheelMotion {
  spring = new DetentMotion(40)
  coasting = false

  get position() { return this.spring.position }
  get moving() { return this.coasting || this.spring.moving }

  drag(position: number, seconds: number): StepDirection[] {
    const speed = (position - this.spring.position) / Math.max(0.008, seconds)
    this.spring.velocity = Math.max(-35, Math.min(35, speed))
    this.spring.position = position
    this.spring.target = position
    this.coasting = false
    return this.crossings()
  }

  private crossings(): StepDirection[] {
    const steps: StepDirection[] = []
    while (this.position - this.spring.detent >= 0.6) { this.spring.detent++; steps.push(1) }
    while (this.position - this.spring.detent <= -0.6) { this.spring.detent--; steps.push(-1) }
    return steps
  }

  release(reduced: boolean, stale: boolean) {
    this.coasting = !reduced && !stale && Math.abs(this.spring.velocity) > 2
    if (!this.coasting) this.stop()
  }

  stop() {
    this.coasting = false
    this.spring.velocity = 0
    this.spring.target = Math.round(this.position)
  }

  step(direction: StepDirection) {
    if (this.coasting || !Number.isInteger(this.spring.target)) this.stop()
    this.spring.step(direction)
  }

  advance(seconds: number, reduced: boolean): StepDirection[] {
    if (reduced && this.coasting) this.stop()
    if (!this.coasting) return this.spring.advance(seconds, reduced)
    const dt = Math.min(seconds, 0.04)
    this.spring.position += this.spring.velocity * dt
    this.spring.velocity *= Math.exp(-5 * dt)
    const steps = this.crossings()
    if (Math.abs(this.spring.velocity) < 0.8) {
      this.coasting = false
      this.spring.target = Math.round(this.position)
    }
    return steps
  }
}
