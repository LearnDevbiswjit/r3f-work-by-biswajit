// src/component/CloudFloating.jsx
import React, { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function rand(min, max) {
  return Math.random() * (max - min) + min
}
function randVec2(baseX, baseY, mag = 0.12) {
  return [baseX + rand(-mag, mag), baseY + rand(-mag, mag)]
}

export default function CloudFloating({
  position = [0, 8, 0],
  color1 = '#ffffff',
  color2 = '#f1f1f1',
  opacity = 0.2,
  speed = 1.0,
  numPlanes = 40,
  xSpread = 700,
  ySpread = 70,
  zSpread = 150,
  baseScale = 100,
  sharedNoise = { dir: [-1.0, 0.2] },
  perLayerWindVariance = 0.22
}) {
  /* ---------------- layers ---------------- */
  const layers = useMemo(
    () =>
      Array.from({ length: numPlanes }).map((_, i) => {
        const t = numPlanes > 1 ? i / (numPlanes - 1) : 0
        const x = rand(-1, 1)
        const yBell = 1.0 - x * x
        const peak = Math.sin(Math.PI * (1.0 - t))

        const xSpreadCur = xSpread * (0.7 + 0.3 * yBell) * (1.0 - t * 0.72)
        const zSpreadCur = zSpread * (0.45 + 0.55 * t)

        const dir = randVec2(
          sharedNoise.dir[0],
          sharedNoise.dir[1],
          perLayerWindVariance
        )

        return {
          key: i,
          position: [
            x * xSpreadCur,
            ySpread * (0.25 + 0.75 * yBell) * peak + rand(-0.8, 0.8),
            rand(-zSpreadCur, zSpreadCur)
          ],
          scale: [
            baseScale * (1.05 - t * 0.68) * rand(0.86, 1.12),
            baseScale * (0.65 + t * 1.05) * rand(0.88, 1.08),
            1
          ],
          rotation: [0, 0, rand(-0.08, 0.08)],
          opacity:
            opacity *
            (1.0 - t * t) *
            (0.85 + 0.2 * yBell) *
            rand(0.92, 1.05),
          speed: speed * rand(0.85, 1.15),
          seed: Math.random() * 1000,
          dir
        }
      }),
    [
      numPlanes,
      xSpread,
      ySpread,
      zSpread,
      baseScale,
      opacity,
      speed,
      sharedNoise.dir,
      perLayerWindVariance
    ]
  )

  const matRefs = useRef([])
  const cloudTimeRef = useRef(0)

  /* ---------------- animation FIX ---------------- */
  useFrame((state, delta) => {
    // 🔑 IMPORTANT FIX: fallback delta so animation starts immediately
    const dt = delta > 0 ? delta : 1 / 60
    cloudTimeRef.current += dt

    for (let i = 0; i < matRefs.current.length; i++) {
      const m = matRefs.current[i]
      const L = layers[i]
      if (!m || !L) continue

      m.uniforms.uTime.value = cloudTimeRef.current
      m.uniforms.uSeed.value = L.seed
      m.uniforms.uSpeed.value = L.speed
      m.uniforms.uDir.value.set(L.dir[0], L.dir[1])
    }
  })

  /* ---------------- render ---------------- */
  return (
    <group position={position}>
      {layers.map((cfg, idx) => (
        <mesh
          key={cfg.key}
          position={cfg.position}
          scale={cfg.scale}
          rotation={cfg.rotation}
        >
          <planeGeometry args={[6, 4, 32, 32]} />
          <shaderMaterial
            ref={(m) => (matRefs.current[idx] = m)}
            transparent
            depthWrite={false}
            depthTest
            side={THREE.DoubleSide}
            blending={THREE.NormalBlending}
            uniforms={{
              uTime: { value: 0 },
              uColor1: { value: new THREE.Color(color1) },
              uColor2: { value: new THREE.Color(color2) },
              uOpacity: { value: cfg.opacity },
              uSpeed: { value: cfg.speed },
              uSeed: { value: cfg.seed },
              uDir: { value: new THREE.Vector2(cfg.dir[0], cfg.dir[1]) }
            }}
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
          />
        </mesh>
      ))}
    </group>
  )
}

/* ================= SHADERS (UNCHANGED LOOK) ================= */

const vertexShader = `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
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

float random(vec2 p){
  return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453);
}
float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f*f*(3.0-2.0*f);
  float a = random(i);
  float b = random(i+vec2(1,0));
  float c = random(i+vec2(0,1));
  float d = random(i+vec2(1,1));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0;
  float a = 0.5;
  for(int i=0;i<5;i++){
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main(){
  vec2 uv = vUv * 2.0 - 1.0;
  float dist = length(uv);

  vec2 dir = normalize(uDir + vec2(1e-6,0.0));
  vec2 drift = dir * uTime * 0.15 * uSpeed;

  float body = fbm(uv * 6.0 + drift + uSeed * 0.05);
  float edge = fbm(uv * 19.0 + drift * 0.4 + uSeed * 0.001);

  float blob = smoothstep(0.85, 0.2, dist - body * 0.25);
  float feather = smoothstep(0.4, 1.0, dist + edge * 0.35);

  float alpha = blob * (1.0 - feather) * uOpacity;
  alpha = max(alpha, 0.0005);

  float edgeFade = smoothstep(0.8, 0.35, dist);
  alpha *= edgeFade;

  vec3 col = mix(uColor1, uColor2, vUv.y + body * 0.15);
  gl_FragColor = vec4(col, alpha);
}
`
