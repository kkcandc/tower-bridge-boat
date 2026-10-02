import { PerspectiveCamera } from 'three'
import type { CameraMode } from './helm'
import { insideSolid } from './layout'
import { damp } from './math'
import { waterHeight } from './waves'
import type { BoatState } from './boat'

export class CameraRig {
  private x = 0
  private y = 6
  private z = -20
  private fov = 58

  constructor(private readonly camera: PerspectiveCamera) {
    this.camera.fov = 58
    this.camera.near = 0.2
    this.camera.far = 1800
    this.camera.updateProjectionMatrix()
  }

  snap(state: BoatState): void {
    this.x = state.x - state.forwardX * 9
    this.z = state.z - state.forwardZ * 9
    this.y = state.y + 3.4
    this.place(state, 0, 0, 'chase', 1)
  }

  update(dt: number, state: BoatState, mode: CameraMode, lookYaw: number, lookPitch: number, time: number): void {
    const yaw = state.yaw + (mode === 'bow' ? lookYaw * 0.35 : lookYaw)
    const forwardX = Math.sin(yaw)
    const forwardZ = Math.cos(yaw)
    let distance = mode === 'span' ? 16 : 8.4
    const height = mode === 'span' ? 7.2 : 3.25
    let desiredX = state.x - forwardX * distance
    let desiredZ = state.z - forwardZ * distance
    if (mode === 'bow') {
      desiredX = state.x + state.forwardX * 2.35
      desiredZ = state.z + state.forwardZ * 2.35
    } else {
      for (let i = 0; i < 5; i++) {
        if (!insideSolid(desiredX, desiredZ)) break
        distance *= 0.7
        desiredX = state.x - forwardX * distance
        desiredZ = state.z - forwardZ * distance
      }
    }
    let desiredY = state.y + (mode === 'bow' ? 1.55 : height) + lookPitch * (mode === 'bow' ? 0.8 : 2.4)
    desiredY = Math.max(desiredY, waterHeight(desiredX, desiredZ, time) + 0.85)
    const lambda = mode === 'bow' ? 6 : 2.6
    this.x = damp(this.x, desiredX, lambda, dt)
    this.y = damp(this.y, desiredY, lambda, dt)
    this.z = damp(this.z, desiredZ, lambda, dt)
    const speedBoost = Math.min(Math.abs(state.speed), 12) * (mode === 'span' ? 0.35 : 0.7)
    const targetFov = (mode === 'span' ? 64 : mode === 'bow' ? 62 : 56) + speedBoost
    this.fov = damp(this.fov, targetFov, 2.2, dt)
    this.place(state, lookYaw, lookPitch, mode, time)
  }

  private place(state: BoatState, lookYaw: number, lookPitch: number, mode: CameraMode, _time: number): void {
    this.camera.position.set(this.x, this.y, this.z)
    this.camera.fov = this.fov
    this.camera.updateProjectionMatrix()
    const lookDistance = mode === 'bow' ? 28 : 18
    const rightX = Math.cos(state.yaw)
    const rightZ = -Math.sin(state.yaw)
    const side = mode === 'bow' ? lookYaw * 10 : 0
    this.camera.up.set(0, 1, 0)
    this.camera.lookAt(
      state.x + state.forwardX * lookDistance + rightX * side,
      state.y + 1.2 + lookPitch * (mode === 'bow' ? 6 : 1.5),
      state.z + state.forwardZ * lookDistance + rightZ * side,
    )
  }
}
