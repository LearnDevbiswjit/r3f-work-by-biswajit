// src/component/underwater/TextBoxUnderWater.jsx
import React, { useRef, useMemo, useEffect, useLayoutEffect } from "react"
import * as THREE from "three"
import { Text } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useControls, button } from "leva"
import { useSelector } from "react-redux"
import gsap from "gsap"

// helpers
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

export default function TextBoxUnderWater({
  bullets = [],
  scale = 2,
  position = [0, 1.2, 0],

  // scroll-sync props (UNCHANGED)
  scrollTimelineLength = 120,
  startAt = 30,
  duration = 4,
  manualPlay = false,

  // visuals
  borderColor = "#ffffff",
  borderInitialOpacity = 0.0,
  borderTargetOpacity = 1.0
}) {
  const group = useRef(null)
  const borderRef = useRef(null)
  const borderMat = useRef(null)
  const textMats = useRef([])
  const t = useRef(0)

  // ✅ NEW: redux scroll progress (0..1)
  const overallProgress = useSelector(
    (s) => s.timeline.overallProgress
  )

  /* ---------- Leva manual trigger (UNCHANGED) ---------- */
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
    arr.push(new THREE.Vector3(pts[0].x, pts[0].y, 0.01))

    return new THREE.BufferGeometry().setFromPoints(arr)
  }, [W, H, R])

  /* ---------- material ref safety ---------- */
  useEffect(() => {
    const needed = bullets.length * 2
    if (textMats.current.length < needed) {
      textMats.current.length = needed
    }
  }, [bullets.length])

  /* ---------- MANUAL GSAP PLAY (UNCHANGED) ---------- */
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
      const start = Math.min(growDur * 0.1 + i * 0.06, growDur * 0.6)
      tl.to(m, { opacity: 1, duration: textDur }, start)
    })
  }

  /* ---------- positions ---------- */
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

  /* ---------- initial visibility (UNCHANGED) ---------- */
  useLayoutEffect(() => {
    if (borderRef.current) {
      borderRef.current.scale.set(1, Math.max(0.0001, borderRef.current.scale.y || 0), 1)
    }
    if (borderMat.current) {
      borderMat.current.opacity = borderInitialOpacity
    }
  }, [borderInitialOpacity])

  /* =====================================================
     🔥 MAIN CHANGE HERE
     OLD: useScroll().offset
     NEW: redux overallProgress (0..1)
     EVERYTHING ELSE SAME
     ===================================================== */
  useFrame(() => {
    t.current += 1 / 60
    if (manualPlay) return

    const globalSec =
      clamp(overallProgress, 0, 1) * Math.max(0.0001, scrollTimelineLength)

    const raw =
      (globalSec - startAt) / Math.max(0.0001, duration)

    const prog = clamp(raw, 0, 1)
    const eased = easeOutCubic(prog)

    // border animation (UNCHANGED)
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

    // text animation (UNCHANGED)
    const textStartOffset = 0.08
    textMats.current.forEach((m, i) => {
      if (!m) return
      const stagger = i * 0.06
      const tProg = clamp(
        (prog - textStartOffset - stagger) /
          Math.max(0.0001, 1 - textStartOffset - stagger),
        0,
        1
      )
      m.opacity = easeOutCubic(tProg)
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
          linewidth={1}
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
                <mesh renderOrder={999} frustumCulled={false}>
                  <circleGeometry args={[0.1 * scale, 32]} />
                  <meshBasicMaterial
                    transparent
                    opacity={0.22}   
                    color="#ffffff"
                    depthTest={false}
                    depthWrite={false}
                    toneMapped={false}
                  />
                </mesh>

                <Text
                  fontSize={0.068 * scale}
                  anchorX="center"
                  anchorY="middle"
                  position={[0, 0, 0.01]}
                  font="/fonts/Inter-SemiBold.ttf"
                >
                  {String(i + 1).padStart(2, "0")}
                  <meshBasicMaterial
                    ref={(m) => (textMats.current[i * 2] = m)}
                    transparent
                    opacity={0}
                    color="#ffffff"
                    depthTest={false}
                    depthWrite={false}
                    toneMapped={false}
                  />
                </Text>
              </group>

              <group position={[0, textY, 0]}>
                <Text
                  fontSize={0.095 * scale}
                  anchorX="center"
                  anchorY="middle"
                  maxWidth={2.4 * scale}
                  lineHeight={1}
                  font="/fonts/Inter-Bold.ttf"
                >
                  {b}
                  <meshBasicMaterial
                    ref={(m) => (textMats.current[i * 2 + 1] = m)}
                    transparent
                    opacity={0}
                    color="#ffffff"
                    depthTest={false}
                    depthWrite={false}
                    toneMapped={false}
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
