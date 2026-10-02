import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Quaternion,
  Shape,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { DECK_Y, TOWER_CENTER_X } from './layout'

type Bucket = Record<string, BufferGeometry[]>

const materials = {
  stone: new MeshStandardMaterial({ color: '#b7a894', roughness: 0.84, metalness: 0.02 }),
  stoneDark: new MeshStandardMaterial({ color: '#8f8476', roughness: 0.9, metalness: 0.03 }),
  stoneLight: new MeshStandardMaterial({ color: '#ebe3d6', roughness: 0.78, metalness: 0.02 }),
  blue: new MeshStandardMaterial({ color: '#1f6fbe', roughness: 0.28, metalness: 0.62 }),
  white: new MeshStandardMaterial({ color: '#f3eee4', roughness: 0.48, metalness: 0.08 }),
  iron: new MeshStandardMaterial({ color: '#2c343c', roughness: 0.55, metalness: 0.72 }),
  road: new MeshStandardMaterial({ color: '#3c4148', roughness: 0.9, metalness: 0.05 }),
  recess: new MeshStandardMaterial({ color: '#1a1714', roughness: 0.95, metalness: 0.0 }),
}

const lampMaterial = new MeshStandardMaterial({
  color: '#000000',
  emissive: new Color('#ffc27a'),
  emissiveIntensity: 6,
  roughness: 1,
})

const windowMaterial = new MeshStandardMaterial({
  color: '#120e0b',
  emissive: new Color('#ffb15e'),
  emissiveIntensity: 1.7,
  roughness: 0.35,
  metalness: 0.05,
})

function stamp(
  geometry: BufferGeometry,
  position: Vector3,
  rotation = new Quaternion(),
  scale = new Vector3(1, 1, 1),
): BufferGeometry {
  geometry.applyMatrix4(new Matrix4().compose(position, rotation, scale))
  return geometry
}

function box(bucket: Bucket, key: string, w: number, h: number, d: number, x: number, y: number, z: number): void {
  bucket[key].push(stamp(new BoxGeometry(w, h, d), new Vector3(x, y, z)))
}

function pointedArch(width: number, height: number, depth: number): BufferGeometry {
  const shape = new Shape()
  const half = width / 2
  const spring = height * 0.46
  shape.moveTo(-half, 0)
  shape.lineTo(half, 0)
  shape.lineTo(half, spring)
  shape.quadraticCurveTo(half * 0.2, height * 1.02, 0, height)
  shape.quadraticCurveTo(-half * 0.2, height * 1.02, -half, spring)
  shape.lineTo(-half, 0)
  const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 8 })
  geometry.translate(0, 0, -depth / 2)
  return geometry
}

function chain(bucket: Bucket, start: Vector3, end: Vector3, sag: number): Vector3[] {
  const points: Vector3[] = []
  const steps = 22
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const point = new Vector3().lerpVectors(start, end, t)
    point.y -= Math.sin(t * Math.PI) * sag
    points.push(point)
  }
  const curve = new CatmullRomCurve3(points)
  bucket.blue.push(new TubeGeometry(curve, 36, 0.22, 6, false))
  bucket.white.push(new TubeGeometry(curve, 28, 0.07, 5, false).translate(0, 0.16, 0))
  return points
}

function tower(bucket: Bucket, windows: Vector3[], lamps: Vector3[], side: number): void {
  const cx = side * TOWER_CENTER_X
  box(bucket, 'stoneDark', 20, 7.5, 32, cx, -1.4, 0)
  box(bucket, 'stone', 15.2, 34, 22, cx, 19.2, 0)
  box(bucket, 'stoneLight', 17.4, 1.15, 24.6, cx, 36.6, 0)
  box(bucket, 'stone', 13.4, 12, 18.5, cx, 42.4, 0)
  box(bucket, 'stoneLight', 15.2, 1.05, 20.4, cx, 48.6, 0)

  const corners: Array<[number, number]> = [
    [7.6, 11.4],
    [7.6, -11.4],
    [-7.6, 11.4],
    [-7.6, -11.4],
  ]
  for (const [ox, oz] of corners) {
    const x = cx + ox
    const z = oz
    bucket.stone.push(stamp(new CylinderGeometry(1.55, 1.75, 52, 10), new Vector3(x, 26, z)))
    bucket.stoneLight.push(stamp(new ConeGeometry(2.15, 5.2, 10), new Vector3(x, 54.2, z)))
    bucket.white.push(stamp(new CylinderGeometry(0.12, 0.12, 2.4, 6), new Vector3(x, 57.6, z)))
    bucket.blue.push(stamp(new SphereGeometry(0.22, 8, 6), new Vector3(x, 59, z)))
  }
  bucket.stoneLight.push(stamp(new ConeGeometry(1.3, 9.5, 8), new Vector3(cx, 58.5, 0)))
  bucket.white.push(stamp(new CylinderGeometry(0.1, 0.1, 2.8, 6), new Vector3(cx, 64.4, 0)))

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    box(bucket, 'stoneLight', 1.1, 1.35, 1.1, cx + Math.cos(angle) * 6.2, 49.5, Math.sin(angle) * 8.4)
  }

  for (const face of [-1, 1]) {
    const arch = pointedArch(8.4, 15.5, 0.55)
    bucket.recess.push(stamp(arch, new Vector3(cx, 1.2, face * 11.35)))
    for (let row = 0; row < 8; row++) {
      for (let col = -2; col <= 2; col++) {
        if (row < 3 && Math.abs(col) <= 1) continue
        windows.push(new Vector3(cx + col * 2.15, 15.5 + row * 3.7, face * 11.25))
      }
    }
    for (const ox of [-6.3, 6.3]) {
      box(bucket, 'stoneLight', 0.55, 30, 0.7, cx + ox, 20, face * 11.2)
    }
  }

  for (const face of [-1, 1]) {
    const arch = pointedArch(7.2, 12.4, 0.6)
    arch.rotateY(Math.PI / 2)
    const x = cx + face * side * 7.7
    bucket.recess.push(stamp(arch, new Vector3(x, 4.2, 0)))
  }

  for (const y of [12, 22, 32, 44]) {
    lamps.push(new Vector3(cx + 8.4, y, 12.2))
    lamps.push(new Vector3(cx - 8.4, y, -12.2))
  }
}

function buildBuckets(): { group: Group; lamps: Vector3[]; windows: Vector3[] } {
  const bucket: Bucket = {
    stone: [],
    stoneDark: [],
    stoneLight: [],
    blue: [],
    white: [],
    iron: [],
    road: [],
    recess: [],
  }
  const windows: Vector3[] = []
  const lamps: Vector3[] = []

  tower(bucket, windows, lamps, 1)
  tower(bucket, windows, lamps, -1)

  const deckZ = 11.5
  box(bucket, 'road', 53.2, 0.42, deckZ, 0, DECK_Y, 0)
  box(bucket, 'white', 0.28, 0.7, deckZ, 0, DECK_Y + 0.2, 0)
  box(bucket, 'blue', 53.6, 0.55, 0.28, 0, DECK_Y + 0.7, 5.55)
  box(bucket, 'blue', 53.6, 0.55, 0.28, 0, DECK_Y + 0.7, -5.55)
  box(bucket, 'white', 53.6, 0.12, 0.34, 0, DECK_Y + 1.02, 5.55)
  box(bucket, 'white', 53.6, 0.12, 0.34, 0, DECK_Y + 1.02, -5.55)

  for (const z of [-4.2, 0, 4.2]) {
    box(bucket, 'iron', 52, 0.32, 0.32, 0, DECK_Y - 0.85, z)
  }
  for (let x = -24; x <= 24; x += 4) {
    box(bucket, 'iron', 0.28, 0.7, 10.2, x, DECK_Y - 1.15, 0)
  }

  for (const z of [-4.15, 4.15]) {
    box(bucket, 'blue', 55.5, 2.5, 2.15, 0, 41.2, z)
    box(bucket, 'white', 55.8, 0.28, 2.45, 0, 42.55, z)
    box(bucket, 'white', 55.8, 0.22, 2.45, 0, 39.85, z)
    box(bucket, 'iron', 54.5, 0.35, 0.35, 0, 43.15, z)
    for (let x = -24; x <= 24; x += 3.2) {
      windows.push(new Vector3(x, 41.15, z + Math.sign(z) * 1.05))
    }
  }
  box(bucket, 'iron', 54, 0.2, 5.2, 0, 43.4, 0)

  for (const side of [-1, 1]) {
    const x0 = side * 42
    const x1 = side * 70
    for (const z of [-5.2, 5.2]) {
      const points = chain(bucket, new Vector3(x0, 47.5, z), new Vector3(x1, 13.5, z), 7.2)
      for (let i = 2; i < points.length - 1; i += 2) {
        const point = points[i]
        const drop = point.y - (DECK_Y + 0.4)
        if (drop > 1.2) {
          bucket.iron.push(stamp(new CylinderGeometry(0.045, 0.045, drop, 4), new Vector3(point.x, point.y - drop / 2, point.z)))
        }
      }
    }
    box(bucket, 'road', 26, 0.38, 9.5, side * 57, DECK_Y - 0.2, 0)
    box(bucket, 'blue', 26, 0.45, 0.22, side * 57, DECK_Y + 0.45, 4.5)
    box(bucket, 'blue', 26, 0.45, 0.22, side * 57, DECK_Y + 0.45, -4.5)
    box(bucket, 'stone', 12, 16, 20, side * 74, 8, 0)
    box(bucket, 'stoneLight', 8, 10, 12, side * 74, 18, 0)
    bucket.stoneLight.push(stamp(new ConeGeometry(3.4, 5.5, 8), new Vector3(side * 74, 25.5, 0)))
    const gate = pointedArch(6.2, 9.5, 1)
    gate.rotateY(Math.PI / 2)
    bucket.recess.push(stamp(gate, new Vector3(side * 68.2, 1.5, 0)))
  }

  for (let x = -24; x <= 24; x += 6) {
    lamps.push(new Vector3(x, DECK_Y + 1.35, 5.7))
    lamps.push(new Vector3(x, DECK_Y + 1.35, -5.7))
  }
  for (let x = -20; x <= 20; x += 8) {
    lamps.push(new Vector3(x, 43.3, 5.4))
    lamps.push(new Vector3(x, 43.3, -5.4))
  }

  const group = new Group()
  group.name = 'tower-bridge'
  const entries: Array<[string, MeshStandardMaterial]> = [
    ['stone', materials.stone],
    ['stoneDark', materials.stoneDark],
    ['stoneLight', materials.stoneLight],
    ['blue', materials.blue],
    ['white', materials.white],
    ['iron', materials.iron],
    ['road', materials.road],
    ['recess', materials.recess],
  ]
  for (const [key, material] of entries) {
    const merged = mergeGeometries(bucket[key], false)
    if (!merged) continue
    const mesh = new Mesh(merged, material)
    mesh.castShadow = key !== 'recess'
    mesh.receiveShadow = true
    group.add(mesh)
  }

  if (windows.length) {
    const windowMesh = new InstancedMesh(new BoxGeometry(0.62, 1.35, 0.18), windowMaterial, windows.length)
    const dummy = new Object3D()
    windows.forEach((position, index) => {
      dummy.position.copy(position)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      windowMesh.setMatrixAt(index, dummy.matrix)
    })
    windowMesh.instanceMatrix.needsUpdate = true
    windowMesh.castShadow = false
    group.add(windowMesh)
  }

  if (lamps.length) {
    const lampMesh = new InstancedMesh(new SphereGeometry(0.42, 8, 6), lampMaterial, lamps.length)
    const dummy = new Object3D()
    lamps.forEach((position, index) => {
      dummy.position.copy(position)
      dummy.updateMatrix()
      lampMesh.setMatrixAt(index, dummy.matrix)
    })
    lampMesh.instanceMatrix.needsUpdate = true
    group.add(lampMesh)
  }

  const lights: Array<[number, number, number, number, number]> = [
    [0, DECK_Y - 1.6, 0, 3.5, 26],
    [-20, 40.5, 4, 4.5, 24],
    [20, 40.5, -4, 4.5, 24],
    [-TOWER_CENTER_X, 24, 8, 5, 20],
    [TOWER_CENTER_X, 24, 8, 5, 20],
  ]
  for (const [x, y, z, intensity, distance] of lights) {
    const light = new PointLight('#ffc08a', intensity, distance, 2)
    light.position.set(x, y, z)
    group.add(light)
  }

  return { group, lamps, windows }
}

export function createBridge(): Group {
  return buildBuckets().group
}
