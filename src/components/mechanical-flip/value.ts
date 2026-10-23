export function formatFlipValue(value: number, digits: number) {
  const places = Math.max(1, Math.min(6, Math.trunc(digits) || 4))
  const limit = 10 ** places
  const number = Number.isFinite(value) ? ((Math.trunc(value) % limit) + limit) % limit : 0
  return String(number).padStart(places, '0')
}
