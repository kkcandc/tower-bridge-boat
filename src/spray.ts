import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, PointsMaterial } from 'three'
import type { BoatState } from './boat'

export class Spray {
  readonly points: Points
  private readonly positions: Float32Array
  private readonly velocities: Float32Array
  private readonly life: Float32Array
  private cursor = 0

  constructor() {
    const count = 90
    this.positions = new Float32Array(count * 3)
    this.velocities = new Float32Array(count * 3)
    this.life = new Float32Array(count)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3))
    const material = new PointsMaterial({
      color: '#e7eef2',
      size: 0.22,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    this.points = new Points(geometry, material)
    this.points.frustumCulled = false
  }

  update(dt: number, state: BoatState): void {
    const count = this.life.length
    const emit = Math.abs(state.speed) > 3.2 ? Math.ceil(Math.abs(state.speed) * 0.7) : 0
    for (let n = 0; n < emit; n++) {
      const i = this.cursor++ % count
      const side = n % 2 === 0 ? -0.7 : 0.7
      const rightX = Math.cos(state.yaw)
      const rightZ = -Math.sin(state.yaw)
      this.positions[i * 3] = state.x + state.forwardX * 3.5 + rightX * side
      this.positions[i * 3 + 1] = state.y + 0.15
      this.positions[i * 3 + 2] = state.z + state.forwardZ * 3.5 + rightZ * side
      this.velocities[i * 3] = -state.forwardX * state.speed * 0.15 + rightX * side * 1.4
      this.velocities[i * 3 + 1] = 1.4 + Math.random() * 0.8
      this.velocities[i * 3 + 2] = -state.forwardZ * state.speed * 0.15 + rightZ * side * 1.4
      this.life[i] = 0.45 + Math.random() * 0.25
    }
    for (let i = 0; i < count; i++) {
      if (this.life[i] <= 0) {
        this.positions[i * 3 + 1] = -10
        continue
      }
      this.life[i] -= dt
      this.velocities[i * 3 + 1] -= 4.5 * dt
      this.positions[i * 3] += this.velocities[i * 3] * dt
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt
    }
    const attribute = this.points.geometry.getAttribute('position') as BufferAttribute
    attribute.needsUpdate = true
  }
}
