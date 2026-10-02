import { clamp } from './math'

export type CameraMode = 'chase' | 'bow' | 'span'

const MODES: CameraMode[] = ['chase', 'bow', 'span']

export class Helm {
  throttle = 0
  rudder = 0
  lookYaw = 0
  lookPitch = 0
  hornEdge = false
  resetEdge = false
  cameraMode: CameraMode = 'chase'
  started = false

  private keys = new Set<string>()
  private rudderHeld = false
  private throttleHeld = false
  private rudderPointer = 0
  private throttlePointer = 0
  private lookDrag = false
  private lastX = 0
  private lastY = 0
  private hornWas = false

  constructor(canvas: HTMLCanvasElement, rudderPad: HTMLElement, throttlePad: HTMLElement, hornButton: HTMLButtonElement) {
    window.addEventListener('keydown', (event) => {
      if (!this.started) return
      if (event.repeat && this.keys.has(event.code)) return
      this.keys.add(event.code)
      if (event.code === 'KeyC') {
        const index = MODES.indexOf(this.cameraMode)
        this.cameraMode = MODES[(index + 1) % MODES.length]
      }
      if (event.code === 'KeyR') this.resetEdge = true
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault()
      }
    })
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code)
    })
    window.addEventListener('blur', () => this.keys.clear())

    this.bindPad(rudderPad, 'x')
    this.bindPad(throttlePad, 'y')
    hornButton.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      this.hornWas = false
      this.keys.add('KeyH')
    })
    const releaseHorn = () => this.keys.delete('KeyH')
    hornButton.addEventListener('pointerup', releaseHorn)
    hornButton.addEventListener('pointercancel', releaseHorn)
    hornButton.addEventListener('pointerleave', (event) => {
      if (event.buttons === 0) releaseHorn()
    })

    canvas.addEventListener('pointerdown', (event) => {
      if (!this.started) return
      if ((event.target as HTMLElement).closest('#pads, #intro, button')) return
      this.lookDrag = true
      this.lastX = event.clientX
      this.lastY = event.clientY
      canvas.setPointerCapture(event.pointerId)
    })
    canvas.addEventListener('pointermove', (event) => {
      if (!this.lookDrag) return
      const dx = event.clientX - this.lastX
      const dy = event.clientY - this.lastY
      this.lastX = event.clientX
      this.lastY = event.clientY
      this.lookYaw = clamp(this.lookYaw - dx * 0.0032, -1.15, 1.15)
      this.lookPitch = clamp(this.lookPitch - dy * 0.0024, -0.45, 0.55)
    })
    const endLook = () => {
      this.lookDrag = false
    }
    canvas.addEventListener('pointerup', endLook)
    canvas.addEventListener('pointercancel', endLook)
  }

  private bindPad(pad: HTMLElement, axis: 'x' | 'y'): void {
    const move = (event: PointerEvent) => {
      const rect = pad.getBoundingClientRect()
      if (axis === 'x') {
        const next = ((event.clientX - rect.left) / rect.width) * 2 - 1
        this.rudderPointer = clamp(next, -1, 1)
        this.rudderHeld = true
      } else {
        const t = 1 - (event.clientY - rect.top) / rect.height
        this.throttlePointer = clamp(t * 1.3 - 0.3, -0.3, 1)
        this.throttleHeld = true
      }
    }
    pad.addEventListener('pointerdown', (event) => {
      if (!this.started) return
      event.preventDefault()
      move(event)
      try {
        pad.setPointerCapture(event.pointerId)
      } catch {
        // Capture is optional; the pointerdown sample already set the lever.
      }
    })
    pad.addEventListener('pointermove', (event) => {
      const captured = (() => {
        try {
          return pad.hasPointerCapture(event.pointerId)
        } catch {
          return false
        }
      })()
      if (!captured && (event.buttons & 1) === 0) return
      move(event)
    })
    const release = () => {
      if (axis === 'x') this.rudderHeld = false
      else this.throttleHeld = false
    }
    pad.addEventListener('pointerup', release)
    pad.addEventListener('pointercancel', release)
  }

  update(dt: number): void {
    let rudderTarget = 0
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) rudderTarget -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) rudderTarget += 1
    if (this.rudderHeld) rudderTarget = this.rudderPointer
    const rudderLambda = this.rudderHeld || rudderTarget !== 0 ? 10 : 6
    this.rudder += (rudderTarget - this.rudder) * (1 - Math.exp(-rudderLambda * dt))
    if (Math.abs(this.rudder) < 0.001) this.rudder = 0

    let throttleTarget = this.throttle
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) throttleTarget += dt * 0.62
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) throttleTarget -= dt * 0.78
    if (this.throttleHeld) throttleTarget = this.throttlePointer
    throttleTarget = clamp(throttleTarget, -0.3, 1)
    const throttleLambda = this.throttleHeld ? 12 : 5
    this.throttle += (throttleTarget - this.throttle) * (1 - Math.exp(-throttleLambda * dt))

    const horn = this.keys.has('KeyH') || this.keys.has('Space')
    this.hornEdge = horn && !this.hornWas
    this.hornWas = horn

    if (!this.lookDrag) {
      this.lookYaw += (0 - this.lookYaw) * (1 - Math.exp(-1.35 * dt))
      this.lookPitch += (0 - this.lookPitch) * (1 - Math.exp(-1.35 * dt))
    }
  }

  consumeReset(): boolean {
    const reset = this.resetEdge
    this.resetEdge = false
    return reset
  }
}
