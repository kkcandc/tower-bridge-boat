import './style.css'
import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  PCFSoftShadowMap,
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
import { Launch } from './boat'
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

const quality =
  window.matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency ?? 8) <= 4
    ? 'low'
    : 'high'

const renderer = new WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' })
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = 1.12
renderer.shadowMap.enabled = true
renderer.shadowMap.type = PCFSoftShadowMap
renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 1.6 : 1.15))

const scene = new Scene()
const horizon = new Color('#c99280')
scene.fog = new FogExp2(horizon, 0.0037)
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
const key = new DirectionalLight('#ffd3b4', 2.7)
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
const bloom = new UnrealBloomPass(new Vector2(window.innerWidth, window.innerHeight), quality === 'high' ? 0.38 : 0.22, 0.55, 0.86)
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
    if (!helm.started) {
      begin()
      event.preventDefault()
      event.stopImmediatePropagation()
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

function frame(now: number): void {
  const dt = Math.min(0.033, (now - last) / 1000)
  last = now
  elapsed += dt
  helm.update(dt)
  if (helm.consumeReset()) launch.reset()
  const state = launch.update(dt, helm, elapsed)
  world.update(elapsed)
  spray.update(dt, state)
  if (state.bumped) shake = 0.18
  shake = Math.max(0, shake - dt)
  rig.update(dt, state, helm.cameraMode, helm.lookYaw, helm.lookPitch, elapsed)
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
  if (helm.hornEdge) audio.horn()
  if (state.justCleared) audio.victory()
  gullIn -= dt
  if (gullIn <= 0) {
    audio.gull()
    gullIn = 9 + Math.random() * 8
  }
  composer.render()
  requestAnimationFrame(frame)
}

launch.reset()
const opening = launch.update(0, helm, 0)
rig.snap(opening)
requestAnimationFrame(frame)
