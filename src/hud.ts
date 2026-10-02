import type { CameraMode } from './helm'
import type { BoatState } from './boat'

const CARDINALS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
const PX = 3.15

export class Hud {
  private readonly knots: HTMLElement
  private readonly unit: HTMLElement
  private readonly heading: HTMLElement
  private readonly cardinal: HTMLElement
  private readonly log: HTMLElement
  private readonly note: HTMLElement
  private readonly throttle: HTMLElement
  private readonly rudderKnob: HTMLElement
  private readonly throttleKnob: HTMLElement
  private readonly tape: HTMLElement
  private readonly camera: HTMLElement
  private readonly trackBoat: HTMLElement
  private cleared = false

  constructor() {
    this.knots = must('knots')
    this.unit = must('knots-unit')
    this.heading = must('heading')
    this.cardinal = must('cardinal')
    this.log = must('log-line')
    this.note = must('log-note')
    this.throttle = must('throttle-fill')
    this.rudderKnob = must('rudder-knob')
    this.throttleKnob = must('throttle-knob')
    this.tape = must('tape')
    this.camera = must('camera-mode')
    this.trackBoat = must('track-boat')
    this.buildTape()
  }

  private buildTape(): void {
    for (let copy = 0; copy < 3; copy++) {
      for (let deg = 0; deg < 360; deg += 10) {
        const tick = document.createElement('div')
        tick.className = deg % 30 === 0 ? 'tick major' : 'tick'
        tick.style.left = `${(copy * 360 + deg) * PX}px`
        if (deg % 30 === 0) {
          const label = document.createElement('span')
          const cardinals = ['N', 'E', 'S', 'W']
          label.textContent = deg % 90 === 0 ? cardinals[deg / 90] : String(deg)
          tick.appendChild(label)
        }
        this.tape.appendChild(tick)
      }
    }
  }

  update(state: BoatState, mode: CameraMode): void {
    this.knots.textContent = state.knots.toFixed(1)
    this.unit.textContent = state.speed < -0.4 ? 'KN ASTERN' : 'KN'
    const heading = Math.round(state.heading) % 360
    this.heading.textContent = `${String(heading).padStart(3, '0')}°`
    this.cardinal.textContent = CARDINALS[Math.round(state.heading / 22.5) % 16] ?? 'N'
    if (this.log.textContent !== state.log) this.log.textContent = state.log
    const became = state.cleared && !this.cleared
    this.cleared = state.cleared
    this.log.classList.toggle('cleared', state.cleared)
    if (became) this.log.classList.add('flash')
    this.note.textContent = state.cleared
      ? 'East reach open. Ease her, or run on.'
      : 'Fair tide. Hold the centre span.'
    const throttleNorm = (state.throttle + 0.3) / 1.3
    this.throttle.style.height = `${Math.max(0, Math.min(1, throttleNorm)) * 100}%`
    this.rudderKnob.style.left = `${((state.rudder + 1) / 2) * 100}%`
    this.throttleKnob.style.bottom = `${throttleNorm * 100}%`
    this.tape.style.transform = `translateX(${-(360 + state.heading) * PX}px)`
    this.camera.textContent = mode === 'chase' ? 'CHASE' : mode === 'bow' ? 'BOW' : 'SPAN'
    const along = Math.max(0, Math.min(1, (state.z + 180) / 250))
    this.trackBoat.style.bottom = `${along * 100}%`
  }
}

function must(id: string): HTMLElement {
  const node = document.getElementById(id)
  if (!node) throw new Error(`Missing #${id}`)
  return node
}
