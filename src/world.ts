import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { BANK_X } from './layout'
import { waterHeight } from './waves'

export type World = {
  group: Group
  update: (time: number) => void
}

function facadeTexture(seed: number): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.fillStyle = '#241f1c'
  ctx.fillRect(0, 0, 128, 256)
  let n = seed
  const rand = () => {
    n = (n * 16807) % 2147483647
    return (n & 65535) / 65535
  }
  for (let y = 10; y < 250; y += 22) {
    for (let x = 8; x < 120; x += 16) {
      const lit = rand() > 0.38
      ctx.fillStyle = lit ? (rand() > 0.45 ? '#ffb15a' : '#ffe0b0') : '#2c261f'
      ctx.fillRect(x, y, 8, 12)
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  return texture
}

function signTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 160
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.fillStyle = '#3a2418'
  ctx.fillRect(0, 0, 512, 160)
  ctx.fillStyle = '#f0d7a2'
  ctx.font = '600 54px Palatino, Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('THE TIDE BELL', 256, 80)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export function createWorld(): World {
  const group = new Group()
  const stone = new MeshStandardMaterial({ color: '#b7ab9c', roughness: 0.88, metalness: 0.02 })
  const stoneDark = new MeshStandardMaterial({ color: '#6d655c', roughness: 0.9 })
  const coping = new MeshStandardMaterial({ color: '#e5dccb', roughness: 0.7 })
  const groundMat = new MeshStandardMaterial({ color: '#1a1c18', roughness: 1 })
  const geos: BufferGeometry[] = []
  const darkGeos: BufferGeometry[] = []
  const copeGeos: BufferGeometry[] = []

  for (const side of [-1, 1]) {
    const x = side * (BANK_X + 2.2)
    const wall = new BoxGeometry(3.2, 5.2, 520)
    wall.translate(x, 2.2, -10)
    geos.push(wall)
    const cap = new BoxGeometry(3.8, 0.45, 520)
    cap.translate(x, 4.9, -10)
    copeGeos.push(cap)
    const rail = new BoxGeometry(0.16, 0.7, 520)
    rail.translate(side * (BANK_X - 0.2), 5.45, -10)
    darkGeos.push(rail)
    const ground = new Mesh(new PlaneGeometry(80, 560), groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.set(side * (BANK_X + 42), 0.02, -10)
    ground.receiveShadow = true
    group.add(ground)
  }

  const keepMat = new MeshStandardMaterial({ color: '#cbbfa8', roughness: 0.86 })
  const keep = new Mesh(new BoxGeometry(18, 16, 18), keepMat)
  keep.position.set(-BANK_X - 22, 8, -36)
  keep.castShadow = true
  keep.receiveShadow = true
  group.add(keep)
  for (const [ox, oz] of [
    [-8, -8],
    [8, -8],
    [-8, 8],
    [8, 8],
  ] as const) {
    const turret = new Mesh(new CylinderGeometry(2.3, 2.6, 22, 8), keepMat)
    turret.position.set(-BANK_X - 22 + ox, 11, -36 + oz)
    turret.castShadow = true
    group.add(turret)
    const cap = new Mesh(new ConeGeometry(3.1, 4.2, 8), coping)
    cap.position.set(-BANK_X - 22 + ox, 23.2, -36 + oz)
    group.add(cap)
  }

  const facades = [facadeTexture(3), facadeTexture(11), facadeTexture(19)]
  const blocks: Array<[number, number, number, number, number, number]> = []
  for (const side of [-1, 1]) {
    for (let i = 0; i < 14; i++) {
      const depth = 8 + ((i * 3) % 5)
      const height = 7 + ((i * 5) % 11)
      const width = 10 + ((i * 2) % 6)
      const z = -200 + i * 28
      blocks.push([side * (BANK_X + 8 + depth / 2), height / 2, z, width, height, depth])
    }
  }
  blocks.forEach((block, index) => {
    const [x, y, z, w, h, d] = block
    const material = new MeshStandardMaterial({
      color: '#2a2623',
      map: facades[index % facades.length],
      emissive: new Color('#ffb56a'),
      emissiveMap: facades[index % facades.length],
      emissiveIntensity: 0.55,
      roughness: 0.82,
    })
    const mesh = new Mesh(new BoxGeometry(d, h, w), material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  })

  const pub = new Mesh(
    new BoxGeometry(12, 8, 9),
    new MeshStandardMaterial({
      color: '#3a2a24',
      map: facades[1],
      emissive: new Color('#ffc48a'),
      emissiveMap: facades[1],
      emissiveIntensity: 0.7,
      roughness: 0.78,
    }),
  )
  pub.position.set(BANK_X + 10, 4, -78)
  pub.castShadow = true
  group.add(pub)
  const sign = new Mesh(
    new BoxGeometry(0.2, 1.1, 3.4),
    new MeshStandardMaterial({ map: signTexture(), roughness: 0.6 }),
  )
  sign.position.set(BANK_X + 3.7, 6.2, -78)
  group.add(sign)

  const skylineMat = new MeshStandardMaterial({
    color: '#141820',
    emissive: new Color('#ffb15a'),
    emissiveIntensity: 0.15,
    roughness: 0.7,
  })
  for (let i = 0; i < 9; i++) {
    const h = 18 + ((i * 17) % 40)
    const tower = new Mesh(new BoxGeometry(8, h, 8), skylineMat)
    tower.position.set(-28 + i * 7, h / 2, 230 + (i % 3) * 18)
    group.add(tower)
  }
  const wedge = new Mesh(new ConeGeometry(6, 48, 4), skylineMat)
  wedge.position.set(18, 24, 280)
  wedge.rotation.y = Math.PI / 4
  group.add(wedge)

  const mergedWall = mergeGeometries(geos, false)
  const mergedDark = mergeGeometries(darkGeos, false)
  const mergedCope = mergeGeometries(copeGeos, false)
  if (mergedWall) {
    const mesh = new Mesh(mergedWall, stone)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }
  if (mergedDark) group.add(new Mesh(mergedDark, stoneDark))
  if (mergedCope) {
    const mesh = new Mesh(mergedCope, coping)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }

  const lampPosts: Array<[number, number]> = []
  for (let z = -220; z <= 180; z += 26) {
    lampPosts.push([BANK_X - 0.4, z])
    lampPosts.push([-BANK_X + 0.4, z])
  }
  const post = new InstancedMesh(
    new CylinderGeometry(0.08, 0.1, 4.2, 6),
    new MeshStandardMaterial({ color: '#2a2e33', roughness: 0.5, metalness: 0.4 }),
    lampPosts.length,
  )
  const glow = new InstancedMesh(
    new SphereGeometry(0.16, 8, 6),
    new MeshStandardMaterial({
      color: '#000000',
      emissive: new Color('#ffc27a'),
      emissiveIntensity: 3.4,
      roughness: 1,
    }),
    lampPosts.length,
  )
  const dummy = new Object3D()
  lampPosts.forEach(([x, z], index) => {
    dummy.position.set(x, 2.4, z)
    dummy.updateMatrix()
    post.setMatrixAt(index, dummy.matrix)
    dummy.position.set(x, 4.55, z)
    dummy.updateMatrix()
    glow.setMatrixAt(index, dummy.matrix)
  })
  post.instanceMatrix.needsUpdate = true
  glow.instanceMatrix.needsUpdate = true
  post.castShadow = true
  group.add(post, glow)

  const buoyMat = new MeshStandardMaterial({ color: '#c23b3b', roughness: 0.45, metalness: 0.1 })
  const buoyGreen = new MeshStandardMaterial({ color: '#1f8a56', roughness: 0.45, metalness: 0.1 })
  const buoys: Mesh[] = []
  for (const z of [-40, -78, -118, -150]) {
    for (const side of [-1, 1]) {
      const buoy = new Mesh(new CylinderGeometry(0.55, 0.7, 1.3, 8), side < 0 ? buoyGreen : buoyMat)
      buoy.position.set(side * 16, 0, z)
      const lamp = new Mesh(
        new SphereGeometry(0.12, 8, 6),
        new MeshStandardMaterial({
          color: '#000',
          emissive: side < 0 ? new Color('#7dffb0') : new Color('#ffb0a4'),
          emissiveIntensity: 2.5,
        }),
      )
      lamp.position.y = 0.8
      buoy.add(lamp)
      buoy.castShadow = true
      group.add(buoy)
      buoys.push(buoy)
    }
  }

  const gullMat = new MeshStandardMaterial({ color: '#efeae2', roughness: 0.6 })
  const gulls: Array<{ root: Group; wingL: Mesh; wingR: Mesh; phase: number; radius: number; height: number; speed: number; centerZ: number }> = []
  for (let i = 0; i < 7; i++) {
    const root = new Group()
    const body = new Mesh(new SphereGeometry(0.16, 8, 6), gullMat)
    body.scale.set(0.7, 0.45, 1.5)
    const wingGeo = new BoxGeometry(0.85, 0.03, 0.22)
    const wingL = new Mesh(wingGeo, gullMat)
    const wingR = new Mesh(wingGeo, gullMat)
    wingL.position.x = -0.5
    wingR.position.x = 0.5
    root.add(body, wingL, wingR)
    group.add(root)
    gulls.push({
      root,
      wingL,
      wingR,
      phase: i * 1.3,
      radius: 18 + (i % 3) * 8,
      height: 10 + (i % 4) * 3,
      speed: 0.18 + (i % 3) * 0.05,
      centerZ: -30 + i * 12,
    })
  }

  const bargeMat = new MeshStandardMaterial({ color: '#3e4650', roughness: 0.7, metalness: 0.25 })
  const bargeCabin = new MeshStandardMaterial({ color: '#d9d0c2', roughness: 0.6 })
  const barges: Array<{ mesh: Group; z: number; x: number; dir: number }> = []
  for (const spec of [
    { x: 8, z: 40, dir: 1 },
    { x: -10, z: 120, dir: -1 },
  ]) {
    const mesh = new Group()
    const hull = new Mesh(new BoxGeometry(3.6, 1.15, 14), bargeMat)
    hull.position.y = 0.2
    hull.castShadow = true
    const cabin = new Mesh(new BoxGeometry(2.4, 1.3, 3.2), bargeCabin)
    cabin.position.set(0, 1.15, -2)
    cabin.castShadow = true
    const lamp = new Mesh(
      new SphereGeometry(0.12, 8, 6),
      new MeshStandardMaterial({ color: '#000', emissive: '#fff1c9', emissiveIntensity: 3 }),
    )
    lamp.position.set(0, 1.1, 6.4)
    mesh.add(hull, cabin, lamp)
    mesh.position.set(spec.x, 0, spec.z)
    group.add(mesh)
    barges.push({ mesh, z: spec.z, x: spec.x, dir: spec.dir })
  }

  return {
    group,
    update(time: number) {
      for (const buoy of buoys) {
        buoy.position.y = waterHeight(buoy.position.x, buoy.position.z, time) + 0.35
        buoy.rotation.z = Math.sin(time * 1.3 + buoy.position.z) * 0.08
      }
      for (const gull of gulls) {
        const angle = time * gull.speed + gull.phase
        gull.root.position.set(Math.cos(angle) * gull.radius, gull.height + Math.sin(time * 1.4 + gull.phase) * 0.8, gull.centerZ + Math.sin(angle) * 14)
        gull.root.rotation.y = -angle + Math.PI / 2
        const flap = Math.sin(time * 7 + gull.phase) * 0.45
        gull.wingL.rotation.z = flap
        gull.wingR.rotation.z = -flap
      }
      for (const barge of barges) {
        barge.z += barge.dir * 0.016
        if (barge.z > 200) barge.z = 20
        if (barge.z < 10) barge.z = 190
        barge.mesh.position.set(barge.x, waterHeight(barge.x, barge.z, time) + 0.15, barge.z)
        barge.mesh.rotation.y = barge.dir > 0 ? 0 : Math.PI
      }
    },
  }
}
