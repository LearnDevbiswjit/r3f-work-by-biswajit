// src/component/CloudFloatingInstanced.jsx
import React, { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/* ================= helpers ================= */
function rand(min, max) {
  return Math.random() * (max - min) + min
}
function randVec2(baseX, baseY, mag = 0.12) {
  return [baseX + rand(-mag, mag), baseY + rand(-mag, mag)]
}

/* ================= Component ================= */
export default function CloudFloatingInstanced({
  position = [0, 8, 0],
  color1 = '#ffffff',
  color2 = '#f1f1f1',
  opacity = 0.2,
  speed = 1.0,
  numPlanes = 20,
  xSpread = 700,
  ySpread = 70,
  zSpread = 250,
  baseScale = 100,
  sharedNoise = { dir: [-1.0, 0.3] },
  perLayerWindVariance = 0.22
}) {

  /* ---------- stable time (KEY FIX) ---------- */
  const cloudTimeRef = useRef(0)

  /* ---------- layer data ---------- */
  const layers = useMemo(() => {
    return Array.from({ length: numPlanes }).map((_, i) => {
      const t = numPlanes > 1 ? i / (numPlanes - 1) : 0
      const x = rand(-1, 1)
      const yBell = 1.0 - x * x

      const dir = randVec2(
        sharedNoise.dir[0],
        sharedNoise.dir[1],
        perLayerWindVariance
      )

      return {
        key: i,
        position: [
          x * xSpread,
          ySpread * (0.4 + yBell * 0.6),
          rand(-zSpread, zSpread)
        ],
        scale: [
          baseScale * rand(0.9, 1.15),
          baseScale * rand(0.9, 1.15),
          1
        ],
        rotation: [0, 0, rand(-0.08, 0.08)],
        opacity: opacity * rand(0.9, 1.05),
        speed: speed * rand(0.85, 1.15),
        seed: Math.random() * 1000,
        dir
      }
    })
  }, [
    numPlanes,
    xSpread,
    ySpread,
    zSpread,
    baseScale,
    opacity,
    speed,
    sharedNoise.dir,
    perLayerWindVariance
  ])

  const matRefs = useRef([])

  /* ---------- frame loop ---------- */
  useFrame((_, delta) => {
    // 🔑 THIS is why floating never stops
    cloudTimeRef.current += delta

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

  /* ================= render ================= */
  return (
    <group position={position}>
      {layers.map((cfg, i) => (
        <mesh
          key={cfg.key}
          position={cfg.position}
          scale={cfg.scale}
          rotation={cfg.rotation}
        >
          <planeGeometry args={[6, 4, 24, 24]} />
          <shaderMaterial
            ref={m => (matRefs.current[i] = m)}
            transparent
            depthWrite={false}
            depthTest
            side={THREE.DoubleSide}
            blending={THREE.NormalBlending}
            uniforms={{
              uTime: { value: 0 },
              uSeed: { value: cfg.seed },
              uSpeed: { value: cfg.speed },
              uOpacity: { value: cfg.opacity },
              uColor1: { value: new THREE.Color(color1) },
              uColor2: { value: new THREE.Color(color2) },
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

/* ================= shaders ================= */

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
uniform float uSeed;
uniform float uSpeed;
uniform float uOpacity;
uniform vec2  uDir;
uniform vec3  uColor1;
uniform vec3  uColor2;

/* ---- noise ---- */
float random(vec2 p){
  return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453);
}
float noise(vec2 p){
  vec2 i=floor(p);
  vec2 f=fract(p);
  f=f*f*(3.0-2.0*f);
  float a=random(i);
  float b=random(i+vec2(1,0));
  float c=random(i+vec2(0,1));
  float d=random(i+vec2(1,1));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float fbm(vec2 p){
  float v=0.0;
  float a=0.5;
  for(int i=0;i<5;i++){
    v+=a*noise(p);
    p*=2.0;
    a*=0.5;
  }
  return v;
}

void main(){
  vec2 uv = vUv * 2.0 - 1.0;
  float dist = length(uv);

  vec2 dir = normalize(uDir + 1e-6);
  vec2 drift = dir * uTime * uSpeed * 0.15;

  float body = fbm(uv * 6.0 + drift + uSeed * 0.03);
  float edge = fbm(uv * 18.0 + drift * 0.4 + uSeed * 0.01);

  float blob = smoothstep(0.85, 0.25, dist - body * 0.28);
  float feather = smoothstep(0.4, 1.0, dist + edge * 0.35);

  float alpha = blob * (1.0 - feather) * uOpacity;
  alpha *= smoothstep(0.9, 0.3, dist);

  vec3 col = mix(uColor1, uColor2, vUv.y + body * 0.15);
  gl_FragColor = vec4(col, alpha);
}
`
