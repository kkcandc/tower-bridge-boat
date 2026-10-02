import {
  Color,
  FrontSide,
  HalfFloatType,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import { WAVES, waveNumber } from './waves'
import { BANK_X } from './layout'

const VERT = /* glsl */ `
uniform float uTime;
uniform vec2 uDir[5];
uniform float uAmp[5];
uniform float uK[5];
uniform float uSteep[5];
uniform float uSpeed[5];
uniform vec3 uBoatPos;
uniform vec2 uBoatForward;
uniform float uBoatSpeed;
uniform mat4 textureMatrix;

varying vec3 vWorld;
varying vec4 vMirror;
varying float vCrest;

#include <fog_pars_vertex>

void gerstner(vec2 xz, out vec3 disp, out float crest) {
  disp = vec3(0.0);
  crest = 0.0;
  for (int i = 0; i < 5; i++) {
    float k = uK[i];
    float a = uAmp[i];
    vec2 dir = uDir[i];
    float q = uSteep[i] / (k * a * 5.0);
    float f = k * dot(dir, xz) - uSpeed[i] * uTime;
    float s = sin(f);
    float c = cos(f);
    disp.x += q * a * dir.x * c;
    disp.z += q * a * dir.y * c;
    disp.y += a * s;
    crest += c * c * a;
  }
}

void main() {
  vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 disp;
  float crest;
  gerstner(world.xz, disp, crest);

  vec2 fromBoat = world.xz - uBoatPos.xz;
  float along = dot(fromBoat, -uBoatForward);
  float side = abs(fromBoat.x * uBoatForward.y - fromBoat.y * uBoatForward.x);
  float wash = smoothstep(0.4, 3.5, uBoatSpeed);
  if (along > 0.0) {
    float core = exp(-side * side / (1.15 + along * 0.09)) * exp(-along * 0.05);
    float arm = exp(-pow(abs(side - along * 0.34), 2.0) / (1.6 + along * 0.08)) * exp(-along * 0.028);
    disp.y += (-core * 0.34 + arm * 0.07) * wash;
  }

  vec3 finalWorld = world + disp;
  vec4 mvPosition = viewMatrix * vec4(finalWorld, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  vWorld = finalWorld;
  vMirror = textureMatrix * vec4(world, 1.0);
  vCrest = crest;

  #include <fog_vertex>
}
`

const FRAG = /* glsl */ `
uniform sampler2D mirrorSampler;
uniform float uTime;
uniform vec2 uDir[5];
uniform float uAmp[5];
uniform float uK[5];
uniform float uSteep[5];
uniform float uSpeed[5];
uniform vec3 uMoonDir;
uniform vec3 uMoonColor;
uniform vec3 uHorizon;
uniform vec3 uBoatPos;
uniform vec2 uBoatForward;
uniform float uBoatSpeed;
uniform float uBank;

varying vec3 vWorld;
varying vec4 vMirror;
varying float vCrest;

#include <fog_pars_fragment>

vec3 gerstnerNormal(vec2 xz) {
  float dYdX = 0.0;
  float dYdZ = 0.0;
  float dXdX = 1.0;
  float dZdZ = 1.0;
  float dXdZ = 0.0;
  float dZdX = 0.0;
  for (int i = 0; i < 5; i++) {
    float k = uK[i];
    float a = uAmp[i];
    vec2 dir = uDir[i];
    float q = uSteep[i] / (k * a * 5.0);
    float f = k * dot(dir, xz) - uSpeed[i] * uTime;
    float s = sin(f);
    float c = cos(f);
    float kqa = k * q * a;
    dXdX -= dir.x * dir.x * kqa * s;
    dXdZ -= dir.x * dir.y * kqa * s;
    dZdX -= dir.y * dir.x * kqa * s;
    dZdZ -= dir.y * dir.y * kqa * s;
    dYdX += dir.x * k * a * c;
    dYdZ += dir.y * k * a * c;
  }
  vec3 dPdx = vec3(dXdX, dYdX, dZdX);
  vec3 dPdz = vec3(dXdZ, dYdZ, dZdZ);
  return normalize(cross(dPdz, dPdx));
}

void main() {
  vec3 normal = gerstnerNormal(vWorld.xz);
  float ripA = sin(dot(vWorld.xz, vec2(1.65, 0.72)) * 1.15 + uTime * 1.7);
  float ripB = sin(dot(vWorld.xz, vec2(-0.55, 1.85)) * 1.7 - uTime * 2.15);
  float ripC = sin(dot(vWorld.xz, vec2(2.2, -1.1)) * 2.4 + uTime * 2.6);
  normal = normalize(normal + vec3(ripA * 0.055 + ripC * 0.03, 0.0, ripB * 0.055));

  vec3 viewDir = normalize(cameraPosition - vWorld);
  float ndotv = clamp(dot(normal, viewDir), 0.0, 1.0);
  float fresnel = mix(0.02, 0.9, pow(1.0 - ndotv, 5.0));

  vec2 uv = vMirror.xy / max(vMirror.w, 0.0001);
  uv += normal.xz * (0.012 + 0.03 * (1.0 - ndotv));
  vec2 away = abs(uv - 0.5);
  float edge = smoothstep(0.5, 0.39, max(away.x, away.y));
  edge *= step(0.0, vMirror.w);
  vec3 reflected = texture2D(mirrorSampler, uv).rgb;

  vec3 moon = normalize(uMoonDir);
  vec3 reflectDir = reflect(-viewDir, normal);
  float moonGlow = pow(max(dot(reflectDir, moon), 0.0), 36.0);
  vec3 fallback = uHorizon + uMoonColor * moonGlow * 0.45;
  reflected = mix(fallback, reflected, edge);

  float shoreDist = uBank - abs(vWorld.x);
  float shoreMix = smoothstep(0.0, 22.0, shoreDist);
  vec3 deep = vec3(0.012, 0.03, 0.034);
  vec3 shallow = vec3(0.07, 0.2, 0.18);
  vec3 waterCol = mix(shallow, deep, shoreMix);
  waterCol += vec3(0.03, 0.05, 0.045) * pow(ndotv, 1.4);

  vec3 halfVec = normalize(moon + viewDir);
  float spec = pow(max(dot(normal, halfVec), 0.0), 280.0);
  float glint = pow(max(dot(normalize(normal + vec3(ripC, 0.0, ripA) * 0.35), halfVec), 0.0), 900.0);

  vec3 color = mix(waterCol, reflected, fresnel);
  color += uMoonColor * spec * 1.85;
  color += uMoonColor * glint * 0.55;

  vec2 fromBoat = vWorld.xz - uBoatPos.xz;
  float along = dot(fromBoat, -uBoatForward);
  float ahead = dot(fromBoat, uBoatForward);
  float side = abs(fromBoat.x * uBoatForward.y - fromBoat.y * uBoatForward.x);
  float wash = smoothstep(0.35, 4.0, abs(uBoatSpeed));
  float foam = 0.0;
  if (along > 0.2 && uBoatSpeed > 0.2) {
    float core = exp(-side * side / (0.85 + along * 0.07)) * exp(-along * 0.055);
    float arm = exp(-pow(abs(side - along * 0.34), 2.0) / (0.9 + along * 0.05)) * exp(-along * 0.03);
    foam += (core * 0.85 + arm * 0.7) * wash;
  }
  if (ahead > 0.0 && ahead < 7.0 && uBoatSpeed > 1.0) {
    foam += exp(-side * side / 0.45) * exp(-ahead * 0.42) * wash * 0.65;
  }
  foam += smoothstep(8.0, 0.8, shoreDist) * (0.35 + 0.65 * fract(sin(dot(vWorld.xz, vec2(12.9, 4.3))) * 430.0));
  foam += smoothstep(0.55, 1.15, vCrest) * 0.18;
  foam *= 0.82 + 0.18 * sin(vWorld.x * 0.7 + uTime * 2.4);

  vec2 lightAhead = fromBoat;
  float beamAlong = dot(lightAhead, uBoatForward);
  float beamSide = abs(lightAhead.x * uBoatForward.y - lightAhead.y * uBoatForward.x);
  float beam = exp(-beamSide * beamSide / (1.1 + beamAlong * 0.12)) * smoothstep(0.0, 3.0, beamAlong) * exp(-beamAlong * 0.045);
  color += vec3(1.0, 0.78, 0.45) * beam * 0.22;

  vec3 foamCol = vec3(0.78, 0.84, 0.86);
  color = mix(color, foamCol, clamp(foam, 0.0, 0.82));

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`

export type WakeState = {
  x: number
  z: number
  forwardX: number
  forwardZ: number
  speed: number
}

export class RiverSurface {
  readonly mesh: Mesh
  private readonly material: ShaderMaterial
  private readonly mirrorCamera = new PerspectiveCamera()
  private readonly renderTarget: WebGLRenderTarget
  private readonly textureMatrix = new Matrix4()
  private readonly mirrorWorldPosition = new Vector3()
  private readonly cameraWorldPosition = new Vector3()
  private readonly rotationMatrix = new Matrix4()
  private readonly normal = new Vector3()
  private readonly view = new Vector3()
  private readonly lookAtPosition = new Vector3(0, 0, -1)
  private readonly target = new Vector3()
  private readonly mirrorPlane = new Plane()
  private readonly clipPlane = new Vector4()
  private readonly q = new Vector4()
  private readonly size: number
  private readonly segments: number

  constructor(quality: 'high' | 'low', moonDir: Vector3, moonColor: Color, horizon: Color) {
    this.size = quality === 'high' ? 720 : 520
    this.segments = quality === 'high' ? 200 : 110
    const geometry = new PlaneGeometry(this.size, this.size, this.segments, this.segments)
    const dirs = WAVES.map((wave) => new Vector2(wave.dirX, wave.dirZ))
    this.renderTarget = new WebGLRenderTarget(512, 512, {
      type: HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false,
    })
    this.renderTarget.texture.name = 'river-reflection'

    this.material = new ShaderMaterial({
      name: 'ThamesWater',
      uniforms: {
        mirrorSampler: { value: this.renderTarget.texture },
        textureMatrix: { value: this.textureMatrix },
        uTime: { value: 0 },
        uDir: { value: dirs },
        uAmp: { value: WAVES.map((wave) => wave.amplitude) },
        uK: { value: WAVES.map((wave) => waveNumber(wave)) },
        uSteep: { value: WAVES.map((wave) => wave.steepness) },
        uSpeed: { value: WAVES.map((wave) => wave.speed) },
        uMoonDir: { value: moonDir.clone() },
        uMoonColor: { value: moonColor.clone() },
        uHorizon: { value: horizon.clone() },
        uBoatPos: { value: new Vector3() },
        uBoatForward: { value: new Vector2(0, 1) },
        uBoatSpeed: { value: 0 },
        uBank: { value: BANK_X - 1.5 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      fog: true,
      side: FrontSide,
    })

    this.mesh = new Mesh(geometry, this.material)
    this.mesh.rotation.x = -Math.PI / 2
    this.mesh.frustumCulled = false
    this.mesh.receiveShadow = false
    this.mesh.castShadow = false
  }

  follow(focusX: number, focusZ: number): void {
    const cell = this.size / this.segments
    this.mesh.position.x = Math.round(focusX / cell) * cell
    this.mesh.position.z = Math.round(focusZ / cell) * cell
    this.mesh.position.y = 0
    this.mesh.updateMatrixWorld()
  }

  setWake(time: number, wake: WakeState): void {
    this.material.uniforms.uTime.value = time
    const boat = this.material.uniforms.uBoatPos.value as Vector3
    boat.set(wake.x, 0, wake.z)
    const forward = this.material.uniforms.uBoatForward.value as Vector2
    forward.set(wake.forwardX, wake.forwardZ)
    this.material.uniforms.uBoatSpeed.value = wake.speed
  }

  setResolution(width: number, height: number, pixelRatio: number): void {
    const w = Math.max(320, Math.min(1280, Math.floor(width * pixelRatio * 0.62)))
    const h = Math.max(180, Math.min(1280, Math.floor(height * pixelRatio * 0.62)))
    this.renderTarget.setSize(w, h)
  }

  renderReflection(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera): void {
    this.mirrorWorldPosition.setFromMatrixPosition(this.mesh.matrixWorld)
    this.cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld)
    this.rotationMatrix.extractRotation(this.mesh.matrixWorld)
    this.normal.set(0, 0, 1).applyMatrix4(this.rotationMatrix)
    this.view.subVectors(this.mirrorWorldPosition, this.cameraWorldPosition)
    if (this.view.dot(this.normal) > 0) return

    this.view.reflect(this.normal).negate().add(this.mirrorWorldPosition)
    this.rotationMatrix.extractRotation(camera.matrixWorld)
    this.lookAtPosition.set(0, 0, -1).applyMatrix4(this.rotationMatrix).add(this.cameraWorldPosition)
    this.target.subVectors(this.mirrorWorldPosition, this.lookAtPosition)
    this.target.reflect(this.normal).negate().add(this.mirrorWorldPosition)

    this.mirrorCamera.position.copy(this.view)
    this.mirrorCamera.up.set(0, 1, 0).applyMatrix4(this.rotationMatrix).reflect(this.normal)
    this.mirrorCamera.lookAt(this.target)
    this.mirrorCamera.far = camera.far
    this.mirrorCamera.updateMatrixWorld()
    this.mirrorCamera.projectionMatrix.copy(camera.projectionMatrix)

    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
    this.textureMatrix.multiply(this.mirrorCamera.projectionMatrix)
    this.textureMatrix.multiply(this.mirrorCamera.matrixWorldInverse)

    this.mirrorPlane.setFromNormalAndCoplanarPoint(this.normal, this.mirrorWorldPosition)
    this.mirrorPlane.applyMatrix4(this.mirrorCamera.matrixWorldInverse)
    this.clipPlane.set(
      this.mirrorPlane.normal.x,
      this.mirrorPlane.normal.y,
      this.mirrorPlane.normal.z,
      this.mirrorPlane.constant,
    )

    const projection = this.mirrorCamera.projectionMatrix
    this.q.x = (Math.sign(this.clipPlane.x) + projection.elements[8]) / projection.elements[0]
    this.q.y = (Math.sign(this.clipPlane.y) + projection.elements[9]) / projection.elements[5]
    this.q.z = -1
    this.q.w = (1 + projection.elements[10]) / projection.elements[14]
    this.clipPlane.multiplyScalar(2 / this.clipPlane.dot(this.q))
    projection.elements[2] = this.clipPlane.x
    projection.elements[6] = this.clipPlane.y
    projection.elements[10] = this.clipPlane.z + 1 - 0.004
    projection.elements[14] = this.clipPlane.w

    const previousTarget = renderer.getRenderTarget()
    const previousShadow = renderer.shadowMap.autoUpdate
    this.mesh.visible = false
    renderer.shadowMap.autoUpdate = false
    renderer.setRenderTarget(this.renderTarget)
    renderer.clear()
    renderer.render(scene, this.mirrorCamera)
    renderer.setRenderTarget(previousTarget)
    renderer.shadowMap.autoUpdate = previousShadow
    this.mesh.visible = true
  }
}
