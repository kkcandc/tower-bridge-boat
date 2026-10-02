/** Metres. The opening is the centre bascule span of Tower Bridge. */

export const TOWER_CENTER_X = 36
export const TOWER_HALF_X = 9
export const TOWER_HALF_Z = 14
export const SPAN_HALF_X = TOWER_CENTER_X - TOWER_HALF_X - 0.4
export const SPAN_HALF_Z = 8.4
export const DECK_Y = 8.75
export const BANK_X = 71
export const START_X = 0
export const START_Z = -168

export const VICTORY_LINE = 'Through the span. The river is yours'

export type Aabb = { minX: number; maxX: number; minZ: number; maxZ: number }

export const SOLIDS: readonly Aabb[] = [
  { minX: 26.6, maxX: 46.5, minZ: -15.2, maxZ: 15.2 },
  { minX: -46.5, maxX: -26.6, minZ: -15.2, maxZ: 15.2 },
  { minX: 64, maxX: 96, minZ: -18, maxZ: 18 },
  { minX: -96, maxX: -64, minZ: -18, maxZ: 18 },
]

export function distanceToSpan(x: number, z: number): number {
  const dx = Math.max(Math.abs(x) - SPAN_HALF_X, 0)
  const dz = Math.max(Math.abs(z) - SPAN_HALF_Z, 0)
  return Math.hypot(dx, dz)
}

export function isUnderSpan(x: number, z: number): boolean {
  return Math.abs(x) < SPAN_HALF_X && Math.abs(z) < SPAN_HALF_Z
}

export function aheadLine(meters: number): string {
  return `Tower Bridge, ${meters} m ahead`
}

export function riverLogLine(
  x: number,
  z: number,
  cleared: boolean,
): { text: string; cleared: boolean } {
  const nowCleared = cleared || isUnderSpan(x, z)
  if (nowCleared) return { text: VICTORY_LINE, cleared: true }
  const meters = Math.max(1, Math.round(distanceToSpan(x, z)))
  return { text: aheadLine(meters), cleared: false }
}

export function insideSolid(x: number, z: number): boolean {
  if (Math.abs(x) > BANK_X) return true
  return SOLIDS.some((box) => x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ)
}
