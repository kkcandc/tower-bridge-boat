export class RiverAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private engineGain: GainNode | null = null
  private engineFilter: BiquadFilterNode | null = null
  private engine: OscillatorNode | null = null
  private engine2: OscillatorNode | null = null
  private waterGain: GainNode | null = null
  private started = false

  resume(): void {
    if (!this.context) this.build()
    void this.context?.resume()
    this.started = true
  }

  private build(): void {
    const context = new AudioContext()
    const master = context.createGain()
    master.gain.value = 0.8
    master.connect(context.destination)

    const engine = context.createOscillator()
    engine.type = 'sawtooth'
    engine.frequency.value = 46
    const engine2 = context.createOscillator()
    engine2.type = 'triangle'
    engine2.frequency.value = 23
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 180
    filter.Q.value = 0.7
    const engineGain = context.createGain()
    engineGain.gain.value = 0
    engine.connect(filter)
    engine2.connect(filter)
    filter.connect(engineGain)
    engineGain.connect(master)
    engine.start()
    engine2.start()

    const length = context.sampleRate * 2
    const buffer = context.createBuffer(1, length, context.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      last = last * 0.96 + white * 0.04
      data[i] = last * 3.2
    }
    const noise = context.createBufferSource()
    noise.buffer = buffer
    noise.loop = true
    const band = context.createBiquadFilter()
    band.type = 'lowpass'
    band.frequency.value = 420
    const waterGain = context.createGain()
    waterGain.gain.value = 0
    noise.connect(band)
    band.connect(waterGain)
    waterGain.connect(master)
    noise.start()

    this.context = context
    this.master = master
    this.engine = engine
    this.engine2 = engine2
    this.engineFilter = filter
    this.engineGain = engineGain
    this.waterGain = waterGain
  }

  update(speed: number, throttle: number): void {
    if (!this.started || !this.context || !this.engine || !this.engine2 || !this.engineGain || !this.engineFilter || !this.waterGain) {
      return
    }
    const now = this.context.currentTime
    const rate = 42 + Math.abs(throttle) * 78 + Math.abs(speed) * 3.4
    this.engine.frequency.setTargetAtTime(rate, now, 0.08)
    this.engine2.frequency.setTargetAtTime(rate * 0.5, now, 0.08)
    this.engineFilter.frequency.setTargetAtTime(150 + Math.abs(speed) * 26 + Math.abs(throttle) * 80, now, 0.08)
    this.engineGain.gain.setTargetAtTime(0.012 + Math.abs(throttle) * 0.045 + Math.min(Math.abs(speed), 12) * 0.002, now, 0.1)
    this.waterGain.gain.setTargetAtTime(0.018 + Math.min(Math.abs(speed), 12) * 0.006, now, 0.2)
  }

  horn(): void {
    if (!this.context || !this.master) return
    const now = this.context.currentTime
    const filter = this.context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 720
    const gain = this.context.createGain()
    filter.connect(gain)
    gain.connect(this.master)
    for (const frequency of [146, 196]) {
      const osc = this.context.createOscillator()
      osc.type = frequency === 146 ? 'sawtooth' : 'triangle'
      osc.frequency.value = frequency
      osc.connect(filter)
      osc.start(now)
      osc.stop(now + 0.72)
    }
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7)
  }

  victory(): void {
    if (!this.context || !this.master) return
    const now = this.context.currentTime
    ;[523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const osc = this.context!.createOscillator()
      const gain = this.context!.createGain()
      osc.type = 'sine'
      osc.frequency.value = frequency
      osc.connect(gain)
      gain.connect(this.master!)
      const start = now + index * 0.045
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.045, start + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.5)
      osc.start(start)
      osc.stop(start + 1.55)
    })
  }

  gull(): void {
    if (!this.context || !this.master) return
    const now = this.context.currentTime
    const osc = this.context.createOscillator()
    const gain = this.context.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880 + Math.random() * 220, now)
    osc.frequency.exponentialRampToValueAtTime(1400 + Math.random() * 400, now + 0.18)
    osc.connect(gain)
    gain.connect(this.master)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.018, now + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28)
    osc.start(now)
    osc.stop(now + 0.3)
  }
}
