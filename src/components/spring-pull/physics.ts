export function pullResistance(distance: number, travel: number) {
  const d = Math.max(0, distance)
  return Math.min(1, d / (d + Math.max(1, travel) * 0.45))
}

export function normalizeThreshold(value: number) {
  return Number.isFinite(value) ? Math.max(0.25, Math.min(0.95, value)) : 0.72
}

export class ReturnSpring {
  position = 0
  velocity = 0
  get moving() { return this.position !== 0 || this.velocity !== 0 }
  advance(seconds: number, reduced: boolean) {
    if (reduced) { this.position = 0; this.velocity = 0; return }
    let remaining = Math.min(seconds, 0.05)
    while (remaining > 0) {
      const dt = Math.min(remaining, 1 / 240)
      this.velocity += (-this.position * 360 - this.velocity * 25) * dt
      this.position += this.velocity * dt
      remaining -= dt
    }
    if (Math.abs(this.position) < 0.0005 && Math.abs(this.velocity) < 0.005) {
      this.position = 0; this.velocity = 0
    }
  }
}
