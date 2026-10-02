import './style.css'
import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { RiverAudio } from './audio'
import { Launch, type BoatState } from './boat'
import { createBridge } from './bridge'
import { CameraRig } from './cameraRig'
import { Helm } from './helm'
import { Hud } from './hud'
import { createSky } from './sky'
import { Spray } from './spray'
import { RiverSurface } from './water'
import { createWorld } from './world'

const canvas = document.getElementById('scene')
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing canvas')

const quality: 'high' | 'low' =
  window.matchMedia('(pointer: coarse)').matches ||
  (navigator.hardwareConcurrency ?? 8) <= 4 ||
  softwareRenderer()
    ? 'low'
    : 'high'

const renderer = new WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' })
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = 0.96
renderer.shadowMap.enabled = true
renderer.shadowMap.type = PCFShadowMap
renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 1.6 : 1.15))

const scene = new Scene()
const horizon = new Color('#8f6d64')
scene.fog = new FogExp2(horizon, 0.00235)
scene.background = horizon
renderer.setClearColor(horizon, 1)

const moonDir = new Vector3(0.1, 0.36, 1).normalize()
const moonColor = new Color('#d5e2ff')

const camera = new PerspectiveCamera(56, 1, 0.2, 1800)
const sky = createSky(horizon, moonDir)
scene.add(sky)

const water = new RiverSurface(quality, moonDir, moonColor, horizon)
scene.add(water.mesh)
scene.add(createBridge())
const world = createWorld()
scene.add(world.group)
const launch = new Launch()
scene.add(launch.group)
const spray = new Spray()
scene.add(spray.points)

const hemi = new HemisphereLight('#9aafd0', '#1a140f', 0.62)
scene.add(hemi)
const key = new DirectionalLight('#ffd3b4', 1.85)
key.position.set(-70, 64, -110)
key.target.position.set(0, 16, -20)
key.castShadow = true
key.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024)
key.shadow.camera.near = 8
key.shadow.camera.far = 320
key.shadow.camera.left = -120
key.shadow.camera.right = 120
key.shadow.camera.top = 120
key.shadow.camera.bottom = -120
key.shadow.bias = -0.0004
key.shadow.normalBias = 0.045
scene.add(key, key.target)
const rim = new DirectionalLight('#b9c8ff', 0.9)
rim.position.set(20, 28, 110)
scene.add(rim)

const pmrem = new PMREMGenerator(renderer)
const envScene = new Scene()
envScene.add(sky.clone())
scene.environment = pmrem.fromScene(envScene, 0.04).texture
scene.environmentIntensity = 0.42
pmrem.dispose()

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const bloom = new UnrealBloomPass(new Vector2(window.innerWidth, window.innerHeight), 0.36, 0.5, 0.84)
bloom.enabled = quality === 'high'
composer.addPass(bloom)
composer.addPass(new OutputPass())

const rig = new CameraRig(camera)
const rudderPad = document.getElementById('rudder-pad')
const throttlePad = document.getElementById('throttle-pad')
const horn = document.getElementById('horn')
if (!rudderPad || !throttlePad || !(horn instanceof HTMLButtonElement)) throw new Error('Missing helm controls')
const helm = new Helm(canvas, rudderPad, throttlePad, horn)
const hud = new Hud()
const audio = new RiverAudio()

function begin(): void {
  if (helm.started) return
  helm.started = true
  document.getElementById('intro')?.classList.add('hidden')
  audio.resume()
}

document.getElementById('start')?.addEventListener('click', begin)
window.addEventListener(
  'keydown',
  (event) => {
    if (!helm.started) begin()
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault()
    }
  },
  true,
)

function resize(): void {
  const width = window.innerWidth
  const height = window.innerHeight
  renderer.setSize(width, height)
  composer.setSize(width, height)
  camera.aspect = width / Math.max(height, 1)
  camera.updateProjectionMatrix()
  water.setResolution(width, height, renderer.getPixelRatio())
}

window.addEventListener('resize', resize)
resize()

let last = performance.now()
let elapsed = 0
let gullIn = 6
let shake = 0
let reported = false
let latest: BoatState
let accumulator = 0
const step = 1 / 45
const maxSteps = 8

function frame(now: number): void {
  requestAnimationFrame(frame)
  try {
    const raw = Math.min(0.25, (now - last) / 1000)
    last = now
    // A 60 Hz frame is shorter than one physics step. Keep the leftover
    // so throttle and rudder still advance on a fast display.
    accumulator = Math.min(accumulator + raw, step * maxSteps)
    let horn = false
    let cleared = false
    let bumped = false
    let state = latest
    while (accumulator >= step) {
      helm.update(step)
      if (helm.consumeReset()) launch.reset()
      if (helm.hornEdge) horn = true
      state = launch.update(step, helm, elapsed)
      if (state.justCleared) cleared = true
      if (state.bumped) bumped = true
      elapsed += step
      accumulator -= step
    }
    latest = state
    if (bumped) shake = 0.18
    shake = Math.max(0, shake - raw)
    world.update(elapsed)
    spray.update(Math.max(raw, step), state)
    rig.update(Math.max(raw, step), state, helm.cameraMode, helm.lookYaw, helm.lookPitch, elapsed)
    if (shake > 0) camera.position.y += Math.sin(elapsed * 48) * shake
    sky.position.set(camera.position.x, 0, camera.position.z)
    water.follow(camera.position.x, camera.position.z)
    water.setWake(elapsed, {
      x: state.x,
      z: state.z,
      forwardX: state.forwardX,
      forwardZ: state.forwardZ,
      speed: Math.max(0, state.speed),
    })
    water.renderReflection(renderer, scene, camera)
    hud.update(state, helm.cameraMode)
    audio.update(state.speed, state.throttle)
    if (horn) audio.horn()
    if (cleared) audio.victory()
    gullIn -= raw
    if (gullIn <= 0) {
      audio.gull()
      gullIn = 9 + Math.random() * 8
    }
    composer.render()
  } catch (error) {
    if (!reported) {
      reported = true
      console.error(error)
    }
  }
}

function softwareRenderer(): boolean {
  try {
    const probe = document.createElement('canvas')
    const gl = probe.getContext('webgl2')
    if (!gl) return false
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
    return /swiftshader|llvmpipe|softpipe|software/i.test(name)
  } catch {
    return false
  }
}

launch.reset()
const opening = launch.update(0, helm, 0)
latest = opening
rig.snap(opening)
requestAnimationFrame(frame)
