export type StepDirection = -1 | 1

/** Position is measured in teeth, rather than pixels, so resizing is seamless. */
export class DetentMotion {
  position = 0
  velocity = 0
  target = 0
  detent = 0

  step(direction: StepDirection) {
    this.target += direction
  }

  reverse(direction: StepDirection) {
    this.target = Math.round(this.position) + direction
    this.velocity *= 0.25
  }

  release() {
    this.target = Math.round(this.position)
    this.velocity = Math.max(-2, Math.min(2, this.velocity))
  }

  get moving() {
    return this.position !== this.target || this.velocity !== 0
  }

  advance(seconds: number, reducedMotion = false): StepDirection[] {
    const steps: StepDirection[] = []
    const reportCrossings = () => {
      // Hysteresis keeps the tiny spring rebound from sounding like another tooth.
      while (this.position - this.detent >= 0.6) {
        this.detent += 1
        steps.push(1)
      }
      while (this.position - this.detent <= -0.6) {
        this.detent -= 1
        steps.push(-1)
      }
    }

    if (reducedMotion) {
      this.position = this.target
      this.velocity = 0
      reportCrossings()
    } else {
      let remaining = Math.min(seconds, 0.05)
      while (remaining > 0) {
        const dt = Math.min(remaining, 1 / 240)
        const before = this.position - this.target
        this.velocity += ((this.target - this.position) * 620 - this.velocity * 38) * dt
        this.position += this.velocity * dt
        // Soften only an actual arrival at the target, never a direction change.
        if (before * (this.position - this.target) < 0) {
          this.velocity = Math.max(-2, Math.min(2, this.velocity))
        }
        reportCrossings()
        remaining -= dt
      }
      if (Math.abs(this.target - this.position) < 0.0005 && Math.abs(this.velocity) < 0.005) {
        this.position = this.target
        this.velocity = 0
        reportCrossings()
      }
    }

    // A multiple of the five-tooth visual rhythm preserves the exact appearance.
    if (Math.abs(this.position) > 10_000) {
      const shift = Math.trunc(this.position / 5) * 5
      this.position -= shift
      this.target -= shift
      this.detent -= shift
    }
    return steps
  }
}

export function wrap(value: number, length: number) {
  return ((value % length) + length) % length
}

export function lensWeight(distance: number, radius: number) {
  return Math.exp(-0.5 * (distance / radius) ** 2)
}
