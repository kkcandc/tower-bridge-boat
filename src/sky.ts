import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three'

const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const FRAG = /* glsl */ `
uniform vec3 uHorizon;
uniform vec3 uMoonDir;
varying vec3 vWorld;

void main() {
  vec3 dir = normalize(vWorld - cameraPosition);
  float h = dir.y;
  vec3 zenith = vec3(0.012, 0.018, 0.05);
  vec3 mid = vec3(0.07, 0.09, 0.18);
  vec3 color = mix(uHorizon, mid, smoothstep(0.0, 0.22, h));
  color = mix(color, zenith, smoothstep(0.18, 0.9, h));
  vec3 moon = normalize(uMoonDir);
  float align = dot(dir, moon);
  float disc = smoothstep(0.9987, 0.9996, align);
  float glow = pow(max(align, 0.0), 42.0);
  color += vec3(0.62, 0.72, 1.0) * glow * 0.7;
  color += vec3(1.0, 0.97, 0.92) * disc;
  float city = pow(max(dot(dir, normalize(vec3(0.05, 0.02, 1.0))), 0.0), 7.0);
  city *= smoothstep(0.25, -0.02, h);
  color += vec3(0.62, 0.28, 0.12) * city * 0.55;
  if (h > 0.08 && disc < 0.2) {
    vec3 cell = floor(dir * 260.0);
    float n = fract(sin(dot(cell, vec3(127.1, 311.7, 74.7))) * 43758.5453);
    float star = step(0.993, n);
    color += star * (0.35 + 0.65 * fract(n * 19.0));
  }
  gl_FragColor = vec4(color, 1.0);
}
`

export function createSky(horizon: Color, moonDir: Vector3): Mesh {
  const material = new ShaderMaterial({
    uniforms: {
      uHorizon: { value: horizon.clone() },
      uMoonDir: { value: moonDir.clone() },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: BackSide,
    depthWrite: false,
    fog: false,
  })
  const sky = new Mesh(new SphereGeometry(900, 32, 20), material)
  sky.frustumCulled = false
  sky.renderOrder = -1
  return sky
}
