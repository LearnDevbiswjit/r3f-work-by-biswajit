// src/component/CloudFloating.jsx
import React, { useMemo, useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

function rand(min, max) { return Math.random() * (max - min) + min }
function randVec2(baseX, baseY, mag = 0.12) {
  return [baseX + rand(-mag, mag), baseY + rand(-mag, mag)]
}

export default function CloudFloating({
  position = [0, 8, 0],
  color1 = '#ffffff',
  color2 = '#f1f1f1',
  opacity = 0.20,
  speed = 0.9,
  numPlanes = 100,
  xSpread = 700,
  ySpread = 70,
  zSpread = 150,
  baseScale = 100,
  debug = false,
  sharedNoise = { dir: [-2.0, 0.82] },
  perLayerWindVariance = 0.22,
  fixedStepHz = 60,
  maxSubSteps = 6,
  scrollPauseThreshold = 1.0,
  minVelFactor = 0.08,
  damping = 0.02, // increased damping to avoid build-up
  cameraCompFactor = 0.0 // keep 0.0 so camera moves don't move clouds
}) {
  const layers = useMemo(() => Array.from({ length: numPlanes }).map((_, i) => {
    const t = numPlanes > 1 ? i / (numPlanes - 1) : 0.0
    const x = rand(-1, 1)
    const yBell = 1.0 - x * x
    const peak = Math.sin(Math.PI * (1.0 - t))

    const xSpreadCur = xSpread * (0.7 + 0.3 * yBell) * (1.0 - t * 0.72)
    const zSpreadCur = zSpread * (0.45 + 0.55 * t)

    const dir = randVec2(sharedNoise.dir[0], sharedNoise.dir[1], perLayerWindVariance)
    const wobbleFreq = 0.5 + rand(-0.08, 0.08)
    const wobbleMag = 0.12 + rand(-0.03, 0.03)

    return {
      key: i,
      position: [
        x * xSpreadCur,
        ySpread * (0.25 + 0.75 * yBell) * peak + rand(-0.8, 0.8),
        rand(-zSpreadCur, zSpreadCur)
      ],
      scale: [
        baseScale * (1.05 - t * 0.68) * rand(0.86, 1.12) * (0.85 + 0.35 * yBell),
        baseScale * (0.65 + t * 1.05) * rand(0.88, 1.08) * (0.6 + 0.6 * yBell),
        1
      ],
      rotation: [0, 0, rand(-0.08, 0.08)],
      opacity: opacity * (1.0 - t * t) * (0.85 + 0.2 * yBell) * rand(0.92, 1.05),
      speed: speed * rand(0.82, 1.12),
      seed: Math.random() * 1000,
      dir,
      wobbleFreq,
      wobbleMag
    }
  }), [numPlanes, xSpread, ySpread, zSpread, baseScale, opacity, speed, sharedNoise.dir, perLayerWindVariance])

  const meshRefs = useRef([])
  const matRefs = useRef([])
  const offsetsRef = useRef([]) // Vector2 array per layer
  const taccRef = useRef([])
  const accumulatorRef = useRef(0)
  const cloudTimeRef = useRef(0)
  const lastVelRef = useRef(0)

  const groupRef = useRef()
  const cameraLastPosRef = useRef(new THREE.Vector3())

  // local smoothing of incoming velocity (extra guard against spikes)
  const localVelRef = useRef(0)
  const localVelSmoothedRef = useRef(0)
  const LOCAL_SMOOTH_ALPHA = 0.12 // smaller -> smoother; tune between 0.02..0.18

  useEffect(() => {
    meshRefs.current = []
    matRefs.current = []
    offsetsRef.current = Array.from({ length: numPlanes }, () => new THREE.Vector2(0, 0))
    taccRef.current = Array.from({ length: numPlanes }, () => Math.random() * 10)
    accumulatorRef.current = 0
    // set base pos on group to avoid drift
    if (groupRef.current) {
      groupRef.current.userData.basePosition = groupRef.current.position.clone()
    }
  }, [numPlanes])

  const { camera } = useThree()
  useEffect(() => {
    if (camera && camera.position) cameraLastPosRef.current.copy(camera.position)
    if (groupRef.current && !groupRef.current.userData.basePosition) {
      groupRef.current.userData.basePosition = new THREE.Vector3().fromArray(position)
    }
  }, [camera, position])

  const fixedDt = 1 / Math.max(1, fixedStepHz)

  useFrame((state, delta) => {
    if (!matRefs.current) return
    // cap large delta (tab-switch or lags)
    const MAX_DELTA = 0.12
    const safeDelta = Math.min(delta, MAX_DELTA)

    // read global smoothed velocity if available (App should set _springScrollVelocitySmoothed)
    const globalSmoothed = (typeof window !== 'undefined' && typeof window._springScrollVelocitySmoothed === 'number')
      ? window._springScrollVelocitySmoothed
      : (typeof window !== 'undefined' && typeof window._springScrollVelocity === 'number')
        ? Math.abs(window._springScrollVelocity)
        : 0

    // extra local smoothing (defensive)
    localVelRef.current = globalSmoothed
    localVelSmoothedRef.current = (localVelSmoothedRef.current * (1 - LOCAL_SMOOTH_ALPHA)) + (Math.abs(localVelRef.current) * LOCAL_SMOOTH_ALPHA)
    const scrollVel = localVelSmoothedRef.current

    // TUNING: make drift respond gently and clamp per-step
    const VELOCITY_SLOW_THRESHOLD = 0.45
    const DRIFT_BASE_SPEED = 0.12  // smaller base speed
    const PER_STEP_MAX = 1.2  // clamp per-step drift strongly to avoid jumps
    const LOCAL_DAMPING = Math.max(0, Math.min(0.2, damping || 0.02)) // higher damping

    // velFactor: when small vel -> 1.0; when large vel -> smaller so clouds don't explode
    const velFactor = scrollVel <= VELOCITY_SLOW_THRESHOLD
      ? 1.0
      : Math.max(minVelFactor, 1.0 - (scrollVel - VELOCITY_SLOW_THRESHOLD) * 0.4)

    const pauseUpdates = scrollVel >= scrollPauseThreshold

    // fixed-step simulation loop
    accumulatorRef.current += safeDelta
    const maxSteps = Math.max(1, Math.floor(Math.min(maxSubSteps, accumulatorRef.current / fixedDt)))
    let steps = 0
    while (accumulatorRef.current >= fixedDt && steps < maxSteps) {
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i]
        if (!layer) continue
        if (!offsetsRef.current[i]) offsetsRef.current[i] = new THREE.Vector2(0, 0)
        if (typeof taccRef.current[i] === 'undefined') taccRef.current[i] = Math.random() * 10

        const dirVec = new THREE.Vector2(layer.dir[0], layer.dir[1])
        if (dirVec.lengthSq() < 1e-8) dirVec.set(1.0, 0.0)
        dirVec.normalize()

        const appliedFactor = pauseUpdates ? minVelFactor : velFactor
        // compute very small drift step and clamp strongly
        const driftStep = dirVec.clone().multiplyScalar(DRIFT_BASE_SPEED * layer.speed * fixedDt * appliedFactor)
        if (driftStep.length() > PER_STEP_MAX) driftStep.setLength(PER_STEP_MAX)

        offsetsRef.current[i].add(driftStep)

        taccRef.current[i] += fixedDt * layer.speed

        // stronger damping to kill accumulated offsets fast
        if (LOCAL_DAMPING > 0) offsetsRef.current[i].lerp(new THREE.Vector2(0, 0), LOCAL_DAMPING)
        const maxOff = 400
        if (offsetsRef.current[i].length() > maxOff) offsetsRef.current[i].setLength(maxOff)
      }
      accumulatorRef.current -= fixedDt
      steps += 1
    }

    const stableTime = state.clock.getElapsedTime()
    cloudTimeRef.current = stableTime * 0.12

    // apply uniforms with smoothing
    for (let i = 0; i < matRefs.current.length; i++) {
      const m = matRefs.current[i]
      const layer = layers[i]
      if (!m || !layer) continue
      if (!offsetsRef.current[i]) offsetsRef.current[i] = new THREE.Vector2(0, 0)
      if (typeof taccRef.current[i] === 'undefined') taccRef.current[i] = Math.random() * 10

      const wobbleVal = Math.sin(taccRef.current[i] * layer.wobbleFreq) * layer.wobbleMag
      const dirVec = new THREE.Vector2(layer.dir[0], layer.dir[1]).normalize()
      const perp = new THREE.Vector2(-dirVec.y, dirVec.x).multiplyScalar(wobbleVal)
      const totalOffset = offsetsRef.current[i].clone().add(perp)

      if (m.uniforms) {
        if (m.uniforms.uSeed) m.uniforms.uSeed.value = layer.seed
        if (m.uniforms.uSpeed) m.uniforms.uSpeed.value = layer.speed
        if (m.uniforms.uDir) {
          const d = m.uniforms.uDir.value
          if (d && typeof d.set === 'function') d.set(layer.dir[0], layer.dir[1])
          else m.uniforms.uDir.value = new THREE.Vector2(layer.dir[0], layer.dir[1])
        }
        if (!m.uniforms.uOffset) m.uniforms.uOffset = { value: new THREE.Vector2(0, 0) }
        // smoother assignment to avoid abrupt jumps in shader
        const prev = m.uniforms.uOffset.value
        prev.x = THREE.MathUtils.lerp(prev.x, totalOffset.x, 0.12)
        prev.y = THREE.MathUtils.lerp(prev.y, totalOffset.y, 0.12)
        if (m.uniforms.uTime) m.uniforms.uTime.value = cloudTimeRef.current
      }
    }

    // ensure group stays at base position (no camera-comp influence)
    // if (groupRef.current && groupRef.current.userData.basePosition) {
    //   const base = groupRef.current.userData.basePosition
    //   groupRef.current.position.lerp(base, THREE.MathUtils.clamp(1 - Math.exp(-6 * safeDelta), 0, 1))
    // }

    if (debug && Math.floor(stableTime) % 4 === 0) {
      const s = layers.slice(0, Math.min(6, layers.length)).map((L, idx) => {
        const off = offsetsRef.current[idx]
        return off ? `${idx}:${off.x.toFixed(1)},${off.y.toFixed(1)}` : `${idx}:—`
      }).join(' | ')
      console.log('[Cloud] offs:', s, 'localSmoothedVel:', localVelSmoothedRef.current.toFixed(3))
    }

    lastVelRef.current = localVelSmoothedRef.current


    // ✅ PATCH: make wind visible in world-space (VERY subtle)
if (groupRef.current && offsetsRef.current[0]) {
  const off = offsetsRef.current[0]

  groupRef.current.position.x += off.x * 0.0018
  groupRef.current.position.y += off.y * 0.0012
}


  })


  return (
    <group ref={groupRef} position={position}>
      {layers.map((cfg, idx) => (
        <mesh
          key={cfg.key}
          ref={el => {
            meshRefs.current[idx] = el
            if (el && !el.userData.basePosition) {
              el.userData.basePosition = el.position.clone()
            }
          }}
          position={cfg.position}
          scale={cfg.scale}
          rotation={cfg.rotation}
        >
          <planeGeometry args={[6, 4, 32, 32]} />
          <shaderMaterial
            ref={m => { matRefs.current[idx] = m }}
            blending={THREE.NormalBlending}
            transparent
            depthWrite={false}
            depthTest
            side={THREE.DoubleSide}
            alphaTest={0.005}
            premultipliedAlpha={false}
            uniforms={{
              uTime: { value: 0.0 },
              uColor1: { value: new THREE.Color(color1) },
              uColor2: { value: new THREE.Color(color2) },
              uOpacity: { value: cfg.opacity },
              uSpeed: { value: cfg.speed },
              uSeed: { value: cfg.seed },
              uDir: { value: new THREE.Vector2(cfg.dir[0], cfg.dir[1]) },
              uOffset: { value: new THREE.Vector2(0, 0) }
            }}
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
          />
        </mesh>
      ))}
    </group>
  )
}

const vertexShader = `
varying vec2 vUv;
varying vec3 vWorldPos;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uOpacity;
uniform float uSpeed;
uniform float uSeed;
uniform vec2 uDir;
uniform vec2 uOffset;

float random(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453123); }
float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f); float a=random(i); float b=random(i+vec2(1.0,0.0)); float c=random(i+vec2(0.0,1.0)); float d=random(i+vec2(1.0,1.0)); return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
float fbm(vec2 p){ float v=0.0; float a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.0; a*=0.5; } return v; }

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float dist = length(uv);
  vec2 offset = uOffset;
  float time = uTime * 0.25;

  float body = fbm(uv * 6.0 + offset + uSeed * 0.058 + time * 0.02);
  float edge = fbm(uv * 19.0 + offset * 0.4 + uSeed * 0.0010 + time * 0.04);

  float blob = smoothstep(0.85, 0.2, dist - body * 0.25);
  float feather = smoothstep(0.4, 1.0, dist + edge * 0.35);

  float alpha = blob * (1.0 - feather) * uOpacity;
  alpha = max(alpha, 0.0005);

  float edgeFade = smoothstep(0.8, 0.35, length(uv));
  alpha *= edgeFade;

  vec3 baseCol = mix(uColor1, uColor2, vUv.y + body * 0.15);
  gl_FragColor = vec4(baseCol, alpha);
}
`
