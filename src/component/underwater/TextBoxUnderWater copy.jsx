import React, { useRef, useMemo, useEffect, useLayoutEffect } from "react"
import * as THREE from "three"
import { Text } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useControls, button } from "leva"
import gsap from "gsap"

import useGlobalTimelineSeconds from "../../hooks/useGlobalTimelineSeconds"

// helpers
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

export default function TextBoxUnderWater({
  bullets = [
    "Anti-aging, collagen production, reduces acne, hydrates skin and decreases excessive sebum oil in the skin.",
    "Helps with severe skin conditions like eczema and psoriasis."
  ],
  scale = 1,
  position = [0, 1.2, 0],

  // ⏱️ timeline based
  startAt = 30,   // timeline second when animation starts
  duration = 4,   // seconds to fully reveal
  manualPlay = false,

  // visuals
  borderColor = "#ffffff",
  borderInitialOpacity = 0.0,
  borderTargetOpacity = 1.0
}) {
  /* ---------- GLOBAL TIMELINE ---------- */
  const { currentSec } = useGlobalTimelineSeconds()

  /* ---------- refs ---------- */
  const group = useRef(null)
  const borderRef = useRef(null)
  const borderMat = useRef(null)
  const textMats = useRef([])

  /* ---------- Leva (manual play only) ---------- */
  const { totalDuration, Play } = useControls("TextBox Animation", {
    totalDuration: { value: duration, min: 0.05, max: 10, step: 0.01 },
    Play: button(() => startBorderGrowManual())
  })

  /* ---------- geometry dims ---------- */
  const W = 3.0 * scale
  const H = 2.0 * scale
  const R = 0.18 * scale

  /* ---------- border geometry ---------- */
  const borderGeometry = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-W / 2 + R, -H / 2)
    s.lineTo(W / 2 - R, -H / 2)
    s.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + R)
    s.lineTo(W / 2, H / 2 - R)
    s.quadraticCurveTo(W / 2, H / 2, W / 2 - R, H / 2)
    s.lineTo(-W / 2 + R, H / 2)
    s.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - R)
    s.lineTo(-W / 2, -H / 2 + R)
    s.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + R, -H / 2)

    const pts = s.getPoints(256)
    const arr = pts.map(p => new THREE.Vector3(p.x, p.y, 0.01))
    arr.push(arr[0].clone())
    return new THREE.BufferGeometry().setFromPoints(arr)
  }, [W, H, R])

  /* ---------- ensure text material slots ---------- */
  useEffect(() => {
    const needed = bullets.length * 2
    if (textMats.current.length < needed) {
      textMats.current.length = needed
    }
  }, [bullets.length])

  /* ---------- manual GSAP play ---------- */
  function startBorderGrowManual() {
    const growDur = Math.max(0.05, totalDuration || duration)
    const textDur = Math.max(0.06, growDur * 0.6)

    const tl = gsap.timeline()
    tl.to(borderRef.current?.scale || { y: 0 }, {
      y: 1,
      duration: growDur,
      ease: "power2.out"
    }, 0)

    if (borderMat.current) {
      tl.to(borderMat.current, {
        opacity: borderTargetOpacity,
        duration: Math.min(growDur * 0.6, 0.5)
      }, 0)
    }

    textMats.current.forEach((m, i) => {
      if (!m) return
      tl.to(m, {
        opacity: 1,
        duration: textDur
      }, growDur * 0.1 + i * 0.06)
    })
  }

  /* ---------- bullet positions ---------- */
  const circlePositions = useMemo(() => {
    if (bullets.length === 1) return [0]
    if (bullets.length === 2) {
      return [H * 0.5 - 0.22 * H, 0]
    }
    const spacing = 0.55 * scale
    return bullets.map((_, i) =>
      (bullets.length - 1) * 0.5 * spacing - i * spacing
    )
  }, [bullets, H, scale])

  /* ---------- init state ---------- */
  useLayoutEffect(() => {
    if (borderRef.current) {
      borderRef.current.scale.set(1, 0.0001, 1)
    }
    if (borderMat.current) {
      borderMat.current.opacity = borderInitialOpacity
    }
  }, [borderInitialOpacity])

  /* ---------- FRAME: GLOBAL TIMELINE DRIVEN ---------- */
  useFrame(() => {
    if (manualPlay) return

    const raw = (currentSec - startAt) / Math.max(0.0001, duration)
    const prog = clamp(raw, 0, 1)
    const eased = easeOutCubic(prog)

    if (borderRef.current) {
      borderRef.current.scale.y = Math.max(0.0001, eased)
      borderRef.current.scale.x = 1 + 0.02 * Math.sin(eased * Math.PI)
    }

    if (borderMat.current) {
      borderMat.current.opacity = THREE.MathUtils.lerp(
        borderMat.current.opacity || 0,
        borderTargetOpacity * eased,
        0.55
      )
    }

    const textStart = 0.08
    textMats.current.forEach((m, i) => {
      if (!m) return
      const stagger = i * 0.06
      const tp = clamp(
        (prog - textStart - stagger) /
          Math.max(0.0001, 1 - textStart - stagger),
        0,
        1
      )
      m.opacity = easeOutCubic(tp)
    })
  })

  /* ---------- render ---------- */
  return (
    <group ref={group} position={position}>
      <line ref={borderRef} geometry={borderGeometry} renderOrder={999}>
        <lineBasicMaterial
          ref={borderMat}
          color={borderColor}
          transparent
          opacity={borderInitialOpacity}
          depthTest={false}
          depthWrite={false}
        />
      </line>

      <group position={[0, 0, 0.03]}>
        {bullets.map((b, i) => {
          const circleY = circlePositions[i] ?? 0
          const textY = circleY - H * 0.12

          return (
            <group key={i}>
              <group position={[0, circleY, 0]}>
                <mesh renderOrder={999}>
                  <circleGeometry args={[0.12 * scale, 32]} />
                  <meshBasicMaterial
                    color="#ffffff"
                    transparent
                    opacity={0.22}
                    depthTest={false}
                    depthWrite={false}
                  />
                </mesh>

                <Text
                  fontSize={0.048 * scale}
                  anchorX="center"
                  anchorY="middle"
                  position={[0, 0, 0.01]}
                  font="/fonts/Inter-SemiBold.ttf"
                >
                  {String(i + 1).padStart(2, "0")}
                  <meshBasicMaterial
                    ref={(m) => (textMats.current[i * 2] = m)}
                    color="#ffffff"
                    transparent
                    opacity={0}
                    depthTest={false}
                    depthWrite={false}
                  />
                </Text>
              </group>

              <group position={[0, textY, 0]}>
                <Text
                  fontSize={0.095 * scale}
                  anchorX="center"
                  anchorY="middle"
                  maxWidth={2.4 * scale}
                  font="/fonts/Inter-Bold.ttf"
                >
                  {b}
                  <meshBasicMaterial
                    ref={(m) => (textMats.current[i * 2 + 1] = m)}
                    color="#ffffff"
                    transparent
                    opacity={0}
                    depthTest={false}
                    depthWrite={false}
                  />
                </Text>
              </group>
            </group>
          )
        })}
      </group>
    </group>
  )
}
