// src/component/underwater/TextBoxUnderWater.jsx
import React, { useRef, useMemo, useEffect, useLayoutEffect } from "react"
import * as THREE from "three"
import { Text, useScroll } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useControls, button } from "leva"
import gsap from "gsap"

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
  // scroll-sync props
  scrollTimelineLength = 120, // total scroll timeline in seconds
  startAt = 30, // when (seconds) this component's animation begins
  duration = 4, // seconds duration mapped to full reveal
  manualPlay = false, // if true, scroll sync disabled; use Play button
  // visuals
  borderColor = "#ffffff",
  borderInitialOpacity = 0.0,
  borderTargetOpacity = 1.0
}) {
  // ----- refs (ensure initialized) -----
  const group = useRef(null)
  const borderRef = useRef(null)
  const borderMat = useRef(null)
  const textMats = useRef([]) // will hold meshBasicMaterial refs (numbers/texts)
  const t = useRef(0)

  const scroll = useScroll()

  // Leva simple control to manually trigger
  const { totalDuration, Play } = useControls("TextBox Animation", {
    totalDuration: { value: duration, min: 0.05, max: 10, step: 0.01 },
    Play: button(() => startBorderGrowManual())
  })

  // ----- geometry dims -----
  const W = 3.0 * scale
  const H = 2.0 * scale
  const R = 0.18 * scale

  // ----- border geometry (rounded rect polyline) -----
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
    const arr = []
    for (let i = 0; i < pts.length; i++) arr.push(new THREE.Vector3(pts[i].x, pts[i].y, 0.01))
    arr.push(new THREE.Vector3(pts[0].x, pts[0].y, 0.01))
    return new THREE.BufferGeometry().setFromPoints(arr)
    // NOTE: BufferGeometry created from points; keep it cheap and static
  }, [W, H, R])

  // ----- safe initialization for textMats.current length -----
  useEffect(() => {
    if (!textMats.current) textMats.current = []
    // ensure array length (each bullet has 2 materials: number + body)
    const needed = bullets.length * 2
    if (textMats.current.length < needed) textMats.current.length = needed
  }, [bullets.length])

  // ----- manual play animation function (uses gsap safely) -----
  function startBorderGrowManual() {
    const growDur = Math.max(0.05, totalDuration || duration)
    const textDur = Math.max(0.06, growDur * 0.6)
    // build timeline that guards materials existence
    const tl = gsap.timeline()
    // animate line scale (y) and borderMat opacity
    tl.to(borderRef.current?.scale || { y: 0 }, { y: 1, duration: growDur, ease: "power2.out" }, 0)
    if (borderMat.current) {
      tl.to(borderMat.current, { opacity: borderTargetOpacity, duration: Math.min(growDur * 0.6, 0.5) }, 0)
    }
    textMats.current.forEach((m, i) => {
      if (!m) return
      const startAt = Math.min(growDur * 0.1 + i * 0.06, growDur * 0.6)
      tl.to(m, { opacity: 1.0, duration: textDur }, startAt)
    })
  }

  // ----- compute positions for circles & texts (safe memo) -----
  const computePositions = () => {
    const positions = []
    const topOffsetFraction = 0.22
    if (bullets.length === 1) {
      positions.push(0)
      return positions
    }
    if (bullets.length === 2) {
      const yFirst = H * 0.5 - topOffsetFraction * H
      const ySecond = 0
      positions.push(yFirst, ySecond)
      return positions
    }
    const spacing = 0.55 * scale
    for (let i = 0; i < bullets.length; i++) {
      const y = (bullets.length - 1) * 0.5 * spacing - i * spacing
      positions.push(y)
    }
    return positions
  }

  const circlePositions = useMemo(() => computePositions(), [bullets, W, H, scale])

  // ----- useLayoutEffect for any initial sizing or DOM dependent stuff (safe) -----
  // (kept minimal — Text primitives don't need DOM measure here)
  useLayoutEffect(() => {
    // ensure border initial visibility state
    if (borderRef.current) {
      borderRef.current.scale.set(1, Math.max(0.0001, borderRef.current.scale.y || 0), 1)
    }
    if (borderMat.current) {
      borderMat.current.opacity = borderInitialOpacity
    }
  }, [borderInitialOpacity])

  // ----- main scroll-sync / frame updater (guarded) -----
  useFrame(() => {
    t.current += 1 / 60
    if (manualPlay) return

    // guard scroll: use scroll.offset when available, otherwise fallback to 0
    const offset = (scroll && typeof scroll.offset === "number") ? scroll.offset : 0
    const globalSec = clamp(offset, 0, 1) * Math.max(0.0001, scrollTimelineLength)
    const raw = (globalSec - startAt) / Math.max(0.0001, duration)
    const prog = clamp(raw, 0, 1)
    const eased = easeOutCubic(prog)

    // animate border scale safely
    if (borderRef.current) {
      // set Y scale from 0..1
      borderRef.current.scale.y = Math.max(0.0001, eased)
      borderRef.current.scale.x = 1 + 0.02 * Math.sin(eased * Math.PI)
    }

    // animate border material opacity safely
    if (borderMat.current) {
      borderMat.current.opacity = THREE.MathUtils.lerp(borderMat.current.opacity || 0, borderTargetOpacity * eased, 0.55)
    }

    // text fade: staggered, guarded
    const textStartOffset = 0.08
    if (textMats.current && Array.isArray(textMats.current)) {
      textMats.current.forEach((m, i) => {
        if (!m) return
        const stagger = i * 0.06
        const tProg = clamp((prog - textStartOffset - stagger) / Math.max(0.0001, 1 - textStartOffset - stagger), 0, 1)
        const tEased = easeOutCubic(tProg)
        m.opacity = tEased
      })
    }
  })

  // ----- render -----
  return (
    <group ref={group} position={position}>
      {/* border line: use ref and keep geometry static */}
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

      {/* bullets layout */}
      <group position={[0, 0, 0.03]}>
        {bullets.map((b, i) => {
          // compute positions safely
          const circleY = circlePositions[i] ?? 0
          const textOffset = H * 0.12
          const textY = circleY - textOffset

          return (
            <group key={i} position={[0, 0, 0]}>
              <group position={[0, circleY, 0]}>
                <mesh renderOrder={999} frustumCulled={false}>
                  <circleGeometry args={[0.12 * scale, 32]} />
                  <meshBasicMaterial
                    depthTest={false}
                    depthWrite={false}
                    transparent
                    opacity={0.22}
                    color="#ffffff"
                    toneMapped={false}
                  />
                </mesh>

                {/* number inside circle */}
                <Text
                  fontSize={0.048 * scale}
                  anchorX="center"
                  anchorY="middle"
                  position={[0, 0, 0.01]}
                  font="/fonts/Inter-SemiBold.ttf"
                >
                  {String(i + 1).padStart(2, "0")}
                  <meshBasicMaterial
                    ref={(m) => {
                      // safe callback ref: ensure array exists before assignment
                      if (!textMats.current) textMats.current = []
                      textMats.current[i * 2] = m || null
                    }}
                    color="#ffffff"
                    transparent
                    opacity={0}
                    depthTest={false}
                    depthWrite={false}
                    toneMapped={false}
                  />
                </Text>
              </group>

              {/* Bullet text placed at textY (below the circle) */}
              <group position={[0, textY, 0]}>
                <Text
                  fontSize={0.095 * scale}
                  anchorX="center"
                  anchorY="middle"
                  position={[0, 0, 0]}
                  maxWidth={2.4 * scale}
                  lineHeight={1}
                  font="/fonts/Inter-Bold.ttf"
                >
                  {b}
                  <meshBasicMaterial
                    ref={(m) => {
                      if (!textMats.current) textMats.current = []
                      textMats.current[i * 2 + 1] = m || null
                    }}
                    color="#ffffff"
                    transparent
                    opacity={0}
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
