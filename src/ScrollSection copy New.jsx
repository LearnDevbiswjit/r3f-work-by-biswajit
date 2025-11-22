// src/ScrollSection.jsx
import * as THREE from 'three'
import React, { useRef, useMemo, Suspense, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ScrollControls, useScroll, Scroll } from '@react-three/drei'
import { useControls, Leva } from 'leva'
import { getProject, val } from '@theatre/core'
import theatreeBBState from './theatreState.json'
import { editable as e, SheetProvider, PerspectiveCamera } from '@theatre/r3f'
import studio from '@theatre/studio'
import extension from '@theatre/r3f/dist/extension'
import Enveremnt from './Enveremnt.jsx'
import WaterScene from './component/WaterScene.jsx'
import UnderwaterFog from './component/underwater/UnderwaterFog.jsx'
import RockStone from './rock/RockStone.jsx'
import SpringPath from './SpringPath.jsx'
import ScrollOffsetBridge from './ScrollOffsetBridge.jsx'

studio.initialize()
studio.extend(extension)

// constants
const PAGES = 20
const SPHERE_RADIUS = 0.07

// ---------- safe helpers for theatre values ----------
function safeValMaybe (maybe) {
  // Accepts:
  // - primitive number/string
  // - theatre val-like (we try val(maybe) if available)
  // - function (call it)
  // - object with .value or .get
  try {
    if (maybe == null) return null
    // theatre core val() will unwrap reactives; try it first (if imported)
    try {
      const v = val(maybe)
      if (typeof v !== 'undefined' && v !== maybe) return v
    } catch (e) {
      // ignore if val() fails
    }
    if (typeof maybe === 'function') {
      try {
        const r = maybe()
        return typeof r !== 'undefined' ? r : null
      } catch (e) {
        return null
      }
    }
    if (typeof maybe === 'object') {
      // common patterns
      if (typeof maybe.value !== 'undefined') return maybe.value
      if (typeof maybe.get === 'function') {
        try {
          return maybe.get()
        } catch (e) {}
      }
      // cannot coerce complex object
      return null
    }
    return maybe
  } catch (err) {
    return null
  }
}

function toNumberSafe (v, fallback = NaN) {
  try {
    const s = safeValMaybe(v)
    if (s == null) return fallback
    const n = Number(s)
    return isNaN(n) ? fallback : n
  } catch (e) {
    return fallback
  }
}

// ---------- main ----------
export default function ScrollSection () {
  const project = getProject('myProject', { state: theatreeBBState })
  const sheet = project.sheet('Scene')
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const pages = isMobile ? 19 : PAGES

  // GUI: override window, path tuning, debug monitor
  const {
    overrideStartSec,
    overrideEndSec,
    pathScale,
    cameraOffsetY,
    pathSide,
    enableStatusMonitor
  } = useControls('Override & Path', {
    overrideStartSec: { value: 30, min: 0, max: 3600, step: 1, label: 'Override START (s)' },
    overrideEndSec: { value: 200, min: 1, max: 3600, step: 1, label: 'Override END (s)' },
    pathScale: { value: 5, min: 0.1, max: 50, step: 0.1, label: 'Path scale' },
    cameraOffsetY: { value: 2, min: -20, max: 40, step: 0.1, label: 'Camera offset Y' },
    pathSide: { value: 'right', options: ['right', 'left'], label: 'Start side' },
    enableStatusMonitor: { value: true, label: 'Status monitor (250ms)' }
  })

  useEffect(() => {
    window._springFadeDefaults = { overrideStartSec, overrideEndSec, pathScale, cameraOffsetY, pathSide }
  }, [overrideStartSec, overrideEndSec, pathScale, cameraOffsetY, pathSide])

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <Leva collapsed={isMobile} />
      <Canvas shadows style={{ width: '100vw', height: '100vh' }}>
        <ScrollControls pages={pages} damping={0.3}>
          <SheetProvider sheet={sheet}>
            <Scene
              sheet={sheet}
              overrideStartSec={overrideStartSec}
              overrideEndSec={overrideEndSec}
              pathScale={pathScale}
              cameraOffsetY={cameraOffsetY}
              pathSide={pathSide}
              enableStatusMonitor={enableStatusMonitor}
            />
            <ScrollOffsetBridge />
          </SheetProvider>
          <Scroll html style={{ position: 'absolute', width: '100vw' }} />
        </ScrollControls>
      </Canvas>
    </div>
  )
}

// ---------- Scene ----------
function Scene ({ sheet, overrideStartSec, overrideEndSec, pathScale, cameraOffsetY, pathSide, enableStatusMonitor }) {
  const scroll = useScroll()
  const { set } = useThree()

  const cameraRef = useRef()
  const springGroupRef = useRef()
  const sphereRef = useRef()

  const [isOverriding, setIsOverriding] = useState(false)
  const prevOverrideRef = useRef(false)
  const statusIntervalRef = useRef(null)

  const log = (...args) => console.log('[SPRING]', ...args)
  const tlog = (...args) => console.log('[THEATRE]', ...args)

  // expose camera for debugging
  useEffect(() => {
    if (cameraRef.current) {
      window._springCamRef = cameraRef
      window.__R3F_CAMERA__ = cameraRef.current
    }
  }, [])

  // attempt to play theatre sequence at mount (best-effort) and log pointer shape
  useEffect(() => {
    try {
      if (sheet && sheet.sequence) {
        try {
          sheet.sequence.play()
          tlog('sheet.sequence.play() attempted on mount')
        } catch (e) {
          tlog('sheet.sequence.play() failed on mount', e)
        }
        try {
          const ptr = sheet.sequence.pointer
          tlog('pointer info on mount:', ptr ? { length: safeValMaybe(ptr.length), time: safeValMaybe(ptr.time), fps: safeValMaybe(ptr.fps || ptr.frameRate) } : 'no pointer')
        } catch (e) {}
      } else {
        tlog('sheet or sheet.sequence undefined on mount')
      }
    } catch (e) {
      console.warn('[THEATRE] mount init failed', e)
    }
  }, [sheet])

  // optional periodic status monitor
  useEffect(() => {
    if (!enableStatusMonitor) return
    if (statusIntervalRef.current) clearInterval(statusIntervalRef.current)
    statusIntervalRef.current = setInterval(() => {
      try {
        const ptr = sheet?.sequence?.pointer
        const seqPos = toNumberSafe(ptr?.time, toNumberSafe(sheet?.sequence?.position, 0))
        const seqLenCandidate = safeValMaybe(ptr?.length) || safeValMaybe(sheet?.sequence?.length) || 1
        const seqLen = toNumberSafe(seqLenCandidate, 1)
        const so = scroll ? scroll.offset : 0
        console.log('[STATUS]', `seqPos:${seqPos.toFixed(2)} seqLen:${seqLen.toFixed(0)} scroll:${so.toFixed(3)} overriding:${isOverriding}`)
      } catch (e) {}
    }, 250)
    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current)
      statusIntervalRef.current = null
    }
  }, [enableStatusMonitor, sheet, scroll, isOverriding])

  // HelixCurve used by SpringPath and camera computation
  class HelixCurve extends THREE.Curve {
    constructor ({ turns = 0.95, radius = 1, height = 1 } = {}) {
      super()
      this.turns = turns
      this.radius = radius
      this.height = height
    }
    getPoint (t, optionalTarget = new THREE.Vector3()) {
      const angle = t * this.turns * Math.PI * 2
      const x = Math.cos(angle) * this.radius
      const z = Math.sin(angle) * this.radius
      const y = (t - 0.5) * this.height
      return optionalTarget.set(x, y, z)
    }
  }
  const curve = useMemo(() => new HelixCurve({ turns: 0.95, radius: 1, height: 10 }), [])

  // central camera loop (unified cam)
  useFrame((state, delta) => {
    const cam = cameraRef.current
    if (!cam) return

    const targetFov = isOverriding ? 45 : 35
    cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, Math.min(1, 6 * delta))
    cam.updateProjectionMatrix()

    if (isOverriding) {
      try {
        const ud = cam.userData || {}
        const desiredPos = ud.desiredPos
        const desiredQuat = ud.desiredQuat
        if (desiredPos && desiredQuat) {
          cam.position.lerp(desiredPos, Math.min(1, 8 * delta))
          cam.quaternion.slerp(desiredQuat, Math.min(1, 8 * delta))
          cam.updateMatrixWorld()
        }
      } catch (e) {}
    } else {
      // clear stale desired targets
      try {
        if (cam.userData) {
          if (cam.userData.desiredPos) delete cam.userData.desiredPos
          if (cam.userData.desiredQuat) delete cam.userData.desiredQuat
        }
      } catch (e) {}
    }
  })

  // CRITICAL: robust scroll -> sequence sync (uses safe helpers to avoid TypeErrors)
  useFrame(() => {
    if (!sheet || !scroll) return
    try {
      const ptr = sheet.sequence && sheet.sequence.pointer
      // get sequence length safely (try pointer.length, then sheet.sequence.length, fallback 1)
      const seqLenCandidate = safeValMaybe(ptr?.length) ?? safeValMaybe(sheet?.sequence?.length) ?? 1
      const seqLen = toNumberSafe(seqLenCandidate, 1)
      const newPos = scroll.offset * Math.max(1, seqLen)
      // set only when it actually differs a tiny bit
      const prevPos = toNumberSafe(sheet.sequence.position, NaN)
      if (!isNaN(prevPos)) {
        if (Math.abs(prevPos - newPos) > 1e-6) {
          sheet.sequence.position = newPos
        }
      } else {
        sheet.sequence.position = newPos
      }
    } catch (e) {
      console.warn('[THEATRE] failed to sync sequence.position', e)
    }
  })

  // PATH-FOLLOW + ENTER/EXIT detection with clear console tracing
  useFrame(() => {
    if (!cameraRef.current || !scroll || !sheet) return

    // robust seqPos detection: prefer pointer.time, fallback to sequence.position
    let seqPos = toNumberSafe(safeValMaybe(sheet.sequence?.pointer?.time), Number(sheet.sequence?.position || 0))
    if (isNaN(seqPos)) seqPos = toNumberSafe(sheet.sequence?.position, 0)

    const shouldOverride = seqPos >= overrideStartSec && seqPos < overrideEndSec

    if (shouldOverride !== prevOverrideRef.current) {
      prevOverrideRef.current = shouldOverride
      setIsOverriding(shouldOverride)
      if (shouldOverride) {
        log(`ENTER override @ seqPos=${seqPos.toFixed(3)} scroll=${(scroll?.offset || 0).toFixed(4)}`)
        try { set({ camera: cameraRef.current }) } catch (e) {}
      } else {
        log(`EXIT override @ seqPos=${seqPos.toFixed(3)} scroll=${(scroll?.offset || 0).toFixed(4)}`)
        try {
          if (cameraRef.current && cameraRef.current.userData) {
            delete cameraRef.current.userData.desiredPos
            delete cameraRef.current.userData.desiredQuat
          }
        } catch (e) {}
        try { set({ camera: cameraRef.current }) } catch (e) {}
      }
    }

    if (!shouldOverride) return

    // compute camera target from curve based on scroll.offset
    const rawT = THREE.MathUtils.clamp(scroll.offset, 0, 1)
    const t = pathSide === 'left' ? 1 - rawT : rawT

    const p = curve.getPointAt(t)
    const tNext = Math.min(1, t + 0.001)
    const nextP = curve.getPointAt(tNext)
    const forward = nextP.clone().sub(p).normalize()
    const up = new THREE.Vector3(0, 1, 0)
    const right = new THREE.Vector3().crossVectors(up, forward).normalize()
    const camUp = new THREE.Vector3().crossVectors(forward, right).normalize()
    const mat = new THREE.Matrix4().makeBasis(right, camUp, forward)
    const quat = new THREE.Quaternion().setFromRotationMatrix(mat)

    const sideSign = pathSide === 'left' ? -1 : 1
    const sideOffset = 0.6 * sideSign * (pathScale || 1)
    const worldPos = p.clone().multiplyScalar(pathScale || 1)
    const localOffset = new THREE.Vector3(sideOffset, cameraOffsetY || 0, 0).applyQuaternion(quat)
    const camWorldPos = worldPos.clone().add(localOffset)

    try {
      if (!cameraRef.current.userData) cameraRef.current.userData = {}
      const prevPos = cameraRef.current.userData.desiredPos
      cameraRef.current.userData.desiredPos = camWorldPos.clone()
      cameraRef.current.userData.desiredQuat = quat.clone()

      const posChanged = !prevPos || camWorldPos.distanceTo(prevPos) > 0.01
      if (posChanged) {
        log(`path->camera target @ t=${t.toFixed(3)} pos=${camWorldPos.x.toFixed(2)},${camWorldPos.y.toFixed(2)},${camWorldPos.z.toFixed(2)} scroll=${(scroll?.offset||0).toFixed(4)}`)
      }
    } catch (e) {}
  })

  // render
  return (
    <>
      <PerspectiveCamera ref={cameraRef} theatreKey='Camera' makeDefault near={0.1} far={5000} fov={35} />

      <group ref={springGroupRef}>
        <e.group theatreKey='SpringGroup' position={[0, 0, 0]}>
          <SpringPath count={20} turns={0.95} coilRadius={5} height={10} scale={pathScale} activeIndexRef={null} />
        </e.group>
      </group>

      <mesh ref={sphereRef} visible={false}>
        <sphereGeometry args={[SPHERE_RADIUS, 12, 10]} />
        <meshStandardMaterial color={'#ff4444'} metalness={0.1} roughness={0.4} />
      </mesh>

      <Suspense fallback={null}>
        <WaterScene />
        <UnderwaterFog />
        <RockStone scale={30} />
        <Enveremnt />
      </Suspense>
    </>
  )
}
