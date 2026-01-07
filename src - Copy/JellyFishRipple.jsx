// JellyFishGlass.jsx
import React, { useMemo, useRef } from "react"
import { useLoader, useFrame, extend } from "@react-three/fiber"
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js"
import { shaderMaterial } from "@react-three/drei"
import * as THREE from "three"

// 🟣 Glassy + glowing jellyfish material
const JellyfishMaterial = shaderMaterial(
  {
    uTime: 0,
    uHeadColor: new THREE.Color("#66ccff"), // মাথার দিকে ঠান্ডা নীল
    uTailColor: new THREE.Color("#c07cff"), // নিচে ম্যাজেন্টা/purple glow
    uGlowStrength:2.6,
    uAmplitudeBase: 0.16,
    uFreq: 8.0,
    uSpeed: 1.2,
    uMinY: -1.0,
    uMaxY: 1.0
  },
  // ---------- vertex shader ----------
  `
  uniform float uTime;
  uniform float uAmplitudeBase;
  uniform float uFreq;
  uniform float uSpeed;
  uniform float uMinY;
  uniform float uMaxY;

  varying float vTailFactor;
  varying float vHeightNorm;

  void main() {
    vec3 pos = position;

    // height 0..1 (top = 1, bottom = 0)
    float hNorm = (pos.y - uMinY) / max(0.0001, (uMaxY - uMinY));
    hNorm = clamp(hNorm, 0.0, 1.0);
    vHeightNorm = hNorm;

    // tail factor: নিচের দিকে (hNorm কম) ripple বেশি
    float tail = 1.0 - hNorm;
    tail = smoothstep(0.0, 1.0, tail);
    vTailFactor = tail;

    // radial distance (জেলিফিশের body এর চারদিকে wave)
    float radial = length(pos.xz);

    // দুই ধরণের wave মিশিয়ে নিই: radial + vertical
    float wave1 = sin(radial * uFreq - uTime * uSpeed);
    float wave2 = sin((pos.y * 3.0) - uTime * uSpeed * 1.4);

    float wave = mix(wave1, wave2, 0.6);

    // amplitude: head এ কম, tail এ বেশি
    float amp = uAmplitudeBase * mix(0.3, 1.6, tail);

    // Z-direction এ ripple push ( চাইলে normal থাকলে normal দিয়ে করতে পারতাম )
    pos.z += wave * amp;

    // model → clip
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // point size: tail দিকে একটু মোটা + distance অনুযায়ী scale
    float baseSize = mix(1.6, 3.5, tail);
    float distScale = 300.0 / max(1.0, -mvPosition.z);
    gl_PointSize = baseSize * distScale;
  }
  `,
  // ---------- fragment shader ----------
  `
  uniform vec3 uHeadColor;
  uniform vec3 uTailColor;
  uniform float uGlowStrength;

  varying float vTailFactor;
  varying float vHeightNorm;

  void main() {
    // round point
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;

    float alpha = smoothstep(0.5, 0.0, d);

    // উপরে নীল, নিচে purpleish
    vec3 baseColor = mix(uHeadColor, uTailColor, vTailFactor);

    // edge এ soft falloff রেখে inner glow বাড়াই
    float glow = (1.0 - d) * uGlowStrength;
    vec3 finalColor = baseColor * (0.35 + glow);

    gl_FragColor = vec4(finalColor, alpha * 0.75);
  }
  `
)

extend({ JellyfishMaterial })

export default function JellyFishGlass({
  url = "/models/JellyFish.ply",
  scale = 5
}) {
  const pointsRef = useRef()
  const geometry = useLoader(PLYLoader, url)

  const { geom, minY, maxY } = useMemo(() => {
    geometry.computeBoundingSphere()
    geometry.center()
    geometry.computeBoundingBox()

    const box = geometry.boundingBox
    const minY = box ? box.min.y : -1
    const maxY = box ? box.max.y : 1

    return { geom: geometry, minY, maxY }
  }, [geometry])

  useFrame((state) => {
    if (!pointsRef.current) return
    const mat = pointsRef.current.material
    mat.uTime = state.clock.getElapsedTime()
  })

  return (
    <points ref={pointsRef} geometry={geom} scale={scale}>
      <jellyfishMaterial
        // uniforms ( চাইলে পরে Leva দিয়ে expose করতে পারো )
        uHeadColor={new THREE.Color("#7fd6ff")}
        uTailColor={new THREE.Color("#d08aff")}
        uGlowStrength={1.8}
        uAmplitudeBase={0.07}  // ripple শক্তি, বাড়াতে/কমাতে পারো
        uFreq={9.0}
        uSpeed={1.25}
        uMinY={minY}
        uMaxY={maxY}
        // glassy look
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
