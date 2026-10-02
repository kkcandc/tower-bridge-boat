import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  SpotLight,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three'
import { BANK_X, SOLIDS, START_X, START_Z, riverLogLine } from './layout'
import { damp } from './math'
import { waterHeight } from './waves'
import type { Helm } from './helm'

export type BoatState = {
  x: number
  y: number
  z: number
  yaw: number
  speed: number
  throttle: number
  rudder: number
  knots: number
  heading: number
  cleared: boolean
  justCleared: boolean
  bumped: boolean
  log: string
  forwardX: number
  forwardZ: number
}

const KNOTS = 1.943844

function hullGeometry(): BufferGeometry {
  const length = 8.6
  const stations = 24
  const slices = 16
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const grid: number[][] = []
  const cream = new Color('#f0e2cf')
  const boot = new Color('#1d3f66')
  const bottom = new Color('#7a2430')

  for (let i = 0; i <= stations; i++) {
    const t = i / stations
    const z = -length / 2 + t * length
    const bow = Math.pow(Math.min(1, Math.max(0, (t - 0.58) / 0.42)), 0.9)
    const stern = Math.pow(Math.min(1, Math.max(0, (0.14 - t) / 0.14)), 0.7)
    const halfBeam = 1.12 * (1 - bow * 0.93) * (1 - stern * 0.38)
    const sheer = 0.46 + Math.sin(t * Math.PI) * 0.06 + bow * 0.1
    const keel = 0.62 * (1 - bow * 0.45)
    const row: number[] = []
    for (let j = 0; j <= slices; j++) {
      const u = j / slices
      const around = Math.sin(u * Math.PI)
      const across = Math.cos(u * Math.PI)
      const flare = 0.38 + 0.62 * (1 - around)
      const x = across * halfBeam * flare
      const y = sheer * (1 - around) - keel * Math.pow(around, 1.05)
      positions.push(x, y, z)
      const tone = y > 0.06 ? cream : Math.abs(y) < 0.07 ? boot : bottom
      colors.push(tone.r, tone.g, tone.b)
      row.push(positions.length / 3 - 1)
    }
    grid.push(row)
  }

  for (let i = 0; i < stations; i++) {
    for (let j = 0; j < slices; j++) {
      const a = grid[i][j]
      const b = grid[i + 1][j]
      const c = grid[i + 1][j + 1]
      const d = grid[i][j + 1]
      indices.push(a, d, b, b, d, c)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function nameTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.fillStyle = '#1b3a58'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#e6d3a1'
  ctx.lineWidth = 8
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20)
  ctx.fillStyle = '#f4ead8'
  ctx.font = '600 64px Palatino, Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('HALCYON', canvas.width / 2, canvas.height / 2 + 2)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function pushOut(x: number, z: number): { x: number; z: number; hit: boolean } {
  let hit = false
  let nextX = x
  let nextZ = z
  if (nextX > BANK_X) {
    nextX = BANK_X
    hit = true
  } else if (nextX < -BANK_X) {
    nextX = -BANK_X
    hit = true
  }
  for (const box of SOLIDS) {
    if (nextX > box.minX && nextX < box.maxX && nextZ > box.minZ && nextZ < box.maxZ) {
      const left = nextX - box.minX
      const right = box.maxX - nextX
      const near = nextZ - box.minZ
      const far = box.maxZ - nextZ
      const min = Math.min(left, right, near, far)
      if (min === left) nextX = box.minX
      else if (min === right) nextX = box.maxX
      else if (min === near) nextZ = box.minZ
      else nextZ = box.maxZ
      hit = true
    }
  }
  if (nextZ > 280) {
    nextZ = 280
    hit = true
  } else if (nextZ < -230) {
    nextZ = -230
    hit = true
  }
  return { x: nextX, z: nextZ, hit }
}

export class Launch {
  readonly group = new Group()
  private yaw = 0
  private speed = 0
  private vx = 0
  private vz = 0
  private x = START_X
  private z = START_Z
  private heave = 0
  private pitch = 0
  private roll = 0
  private cleared = false
  private bumpCooldown = 0
  private readonly yawQ = new Quaternion()
  private readonly pitchQ = new Quaternion()
  private readonly rollQ = new Quaternion()
  private readonly axisY = new Vector3(0, 1, 0)
  private readonly axisX = new Vector3(1, 0, 0)
  private readonly axisZ = new Vector3(0, 0, 1)

  constructor() {
    const hull = new Mesh(
      hullGeometry(),
      new MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0.04 }),
    )
    hull.castShadow = true
    hull.receiveShadow = true
    this.group.add(hull)

    const deck = new Mesh(
      new BoxGeometry(1.7, 0.08, 6.4),
      new MeshStandardMaterial({ color: '#6a4630', roughness: 0.72, metalness: 0.02 }),
    )
    deck.position.set(0, 0.46, -0.15)
    deck.castShadow = true
    this.group.add(deck)

    const cabin = new Mesh(
      new BoxGeometry(1.42, 0.7, 2.35),
      new MeshStandardMaterial({ color: '#f6f0e4', roughness: 0.52, metalness: 0.02 }),
    )
    cabin.position.set(0, 0.84, -0.45)
    cabin.castShadow = true
    this.group.add(cabin)

    const glass = new MeshStandardMaterial({
      color: '#17343f',
      emissive: new Color('#ffb56a'),
      emissiveIntensity: 0.4,
      roughness: 0.08,
      metalness: 0.12,
    })
    const windshield = new Mesh(new BoxGeometry(1.35, 0.48, 0.06), glass)
    windshield.position.set(0, 1.22, 0.7)
    windshield.rotation.x = -0.42
    const portGlass = new Mesh(new BoxGeometry(0.06, 0.36, 1.15), glass)
    portGlass.position.set(-0.7, 1.02, -0.4)
    const starGlass = portGlass.clone()
    starGlass.position.x = 0.7
    this.group.add(windshield, portGlass, starGlass)

    const brass = new MeshStandardMaterial({ color: '#b08d57', roughness: 0.3, metalness: 0.84 })
    const rail = new Mesh(new TorusGeometry(0.62, 0.025, 8, 20), brass)
    rail.rotation.x = Math.PI / 2
    rail.scale.set(1.05, 1.8, 1)
    rail.position.set(0, 0.62, 0.1)
    this.group.add(rail)

    const name = new Mesh(
      new BoxGeometry(1.46, 0.32, 0.05),
      new MeshStandardMaterial({ map: nameTexture(), roughness: 0.55 }),
    )
    name.position.set(0, 0.62, -4.15)
    this.group.add(name)

    const fenderMat = new MeshStandardMaterial({ color: '#1c1f24', roughness: 0.72 })
    for (const [fx, fz] of [
      [-1.02, 1.5],
      [1.02, 1.5],
      [-0.98, -1.3],
      [0.98, -1.3],
    ] as const) {
      const fender = new Mesh(new SphereGeometry(0.15, 10, 8), fenderMat)
      fender.scale.y = 1.35
      fender.position.set(fx, 0.12, fz)
      this.group.add(fender)
    }

    const port = new Mesh(
      new SphereGeometry(0.07, 8, 6),
      new MeshStandardMaterial({ color: '#ff2d2d', emissive: '#ff2d2d', emissiveIntensity: 2.4 }),
    )
    port.position.set(-0.95, 0.7, 3.15)
    const starboard = new Mesh(
      new SphereGeometry(0.07, 8, 6),
      new MeshStandardMaterial({ color: '#22d15c', emissive: '#22d15c', emissiveIntensity: 2.4 }),
    )
    starboard.position.set(0.95, 0.7, 3.15)
    this.group.add(port, starboard)

    const spot = new SpotLight('#ffe1b5', 12, 52, Math.PI / 7.5, 0.45, 1.1)
    spot.position.set(0, 1.2, 2.2)
    spot.target.position.set(0, 0.15, 20)
    this.group.add(spot, spot.target)
  }

  reset(): void {
    this.x = START_X
    this.z = START_Z
    this.yaw = 0
    this.speed = 0
    this.vx = 0
    this.vz = 0
    this.cleared = false
    this.heave = waterHeight(this.x, this.z, 0)
    this.applyPose()
  }

  update(dt: number, helm: Helm, time: number): BoatState {
    const drive = helm.throttle >= 0 ? helm.throttle * 9.5 : helm.throttle * 4.2
    const drag = this.speed * 0.28 + this.speed * Math.abs(this.speed) * 0.045
    this.speed += (drive - drag) * dt
    const steer = 0.08 + Math.min(Math.abs(this.speed), 10) * 0.055
    const astern = this.speed < -0.25 ? -1 : 1
    this.yaw += helm.rudder * steer * astern * dt

    this.vx = damp(this.vx, Math.sin(this.yaw) * this.speed, 3.4, dt)
    this.vz = damp(this.vz, Math.cos(this.yaw) * this.speed, 3.4, dt)
    this.x += this.vx * dt
    this.z += this.vz * dt

    const resolved = pushOut(this.x, this.z)
    let bumped = false
    if (resolved.hit) {
      this.x = resolved.x
      this.z = resolved.z
      this.speed *= -0.22
      this.vx *= -0.15
      this.vz *= -0.15
      if (this.bumpCooldown <= 0) bumped = true
      this.bumpCooldown = 0.45
    }
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt)

    const bow = this.sample(0, 3.15, time)
    const stern = this.sample(0, -3.15, time)
    const portH = this.sample(-0.9, 0, time)
    const starboardH = this.sample(0.9, 0, time)
    this.heave = damp(this.heave, (bow + stern + portH + starboardH) / 4, 2.4, dt)
    this.pitch = damp(this.pitch, -Math.atan2(bow - stern, 6.3), 2.6, dt)
    this.roll = damp(this.roll, Math.atan2(starboardH - portH, 1.8), 2.6, dt)
    this.applyPose()

    const actual = Math.hypot(this.vx, this.vz)
    const log = riverLogLine(this.x, this.z, this.cleared)
    const justCleared = log.cleared && !this.cleared
    this.cleared = log.cleared
    const signed = this.speed < 0 ? -actual : actual

    return {
      x: this.x,
      y: this.heave,
      z: this.z,
      yaw: this.yaw,
      speed: signed,
      throttle: helm.throttle,
      rudder: helm.rudder,
      knots: actual * KNOTS,
      heading: compass(this.yaw),
      cleared: this.cleared,
      justCleared,
      bumped,
      log: log.text,
      forwardX: Math.sin(this.yaw),
      forwardZ: Math.cos(this.yaw),
    }
  }

  private sample(localX: number, localZ: number, time: number): number {
    const cos = Math.cos(this.yaw)
    const sin = Math.sin(this.yaw)
    const x = this.x + localX * cos + localZ * sin
    const z = this.z - localX * sin + localZ * cos
    return waterHeight(x, z, time)
  }

  private applyPose(): void {
    this.group.position.set(this.x, this.heave, this.z)
    this.yawQ.setFromAxisAngle(this.axisY, this.yaw)
    this.pitchQ.setFromAxisAngle(this.axisX, this.pitch)
    this.rollQ.setFromAxisAngle(this.axisZ, this.roll)
    this.group.quaternion.copy(this.yawQ).multiply(this.pitchQ).multiply(this.rollQ)
  }
}

function compass(yaw: number): number {
  const degrees = Math.atan2(Math.cos(yaw), -Math.sin(yaw)) * (180 / Math.PI)
  return (degrees + 360) % 360
}
