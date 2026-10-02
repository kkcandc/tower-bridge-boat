export type Wave = {
  dirX: number
  dirZ: number
  amplitude: number
  length: number
  steepness: number
  speed: number
}

function unit(wave: Wave): Wave {
  const len = Math.hypot(wave.dirX, wave.dirZ) || 1
  return { ...wave, dirX: wave.dirX / len, dirZ: wave.dirZ / len }
}

/** Geometric swell. High-frequency ripple lives in the water shader only. */
export const WAVES: readonly Wave[] = [
  { dirX: 1, dirZ: 0.16, amplitude: 0.2, length: 46, steepness: 0.34, speed: 1.15 },
  { dirX: 0.12, dirZ: 1, amplitude: 0.11, length: 24, steepness: 0.36, speed: 1.45 },
  { dirX: -0.82, dirZ: 0.35, amplitude: 0.055, length: 15, steepness: 0.4, speed: 1.85 },
  { dirX: 0.45, dirZ: -0.9, amplitude: 0.04, length: 18, steepness: 0.28, speed: 1.3 },
  { dirX: -0.2, dirZ: -1, amplitude: 0.07, length: 32, steepness: 0.22, speed: 0.95 },
].map(unit)

export function waveNumber(wave: Wave): number {
  return (Math.PI * 2) / wave.length
}

export function waterHeight(x: number, z: number, time: number): number {
  let y = 0
  for (const wave of WAVES) {
    const k = waveNumber(wave)
    const phase = k * (wave.dirX * x + wave.dirZ * z) - wave.speed * time
    y += wave.amplitude * Math.sin(phase)
  }
  return y
}
