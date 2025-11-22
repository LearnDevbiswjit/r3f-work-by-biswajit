// src/ScrollSection.jsx
import * as THREE from 'three'
import React, { useRef, useMemo, Suspense, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ScrollControls, useScroll, Scroll } from '@react-three/drei'
import { useControls, Leva } from 'leva'
import { getProject, val } from '@theatre/core'
import { editable as e, SheetProvider, PerspectiveCamera } from '@theatre/r3f'
import studio from '@theatre/studio'
import extension from '@theatre/r3f/dist/extension'
import theatreeBBState from './theatreState.json'
import Enveremnt from './Enveremnt.jsx'
import WaterScene from './component/WaterScene.jsx'
import UnderwaterFog from './component/underwater/UnderwaterFog.jsx'
import RockStone from './rock/RockStone.jsx'
import SpringPath from './SpringPath.jsx'
import ScrollOffsetBridge from './ScrollOffsetBridge.jsx'

studio.initialize()
studio.extend(extension)

const PAGES = 20
const SPHERE_RADIUS = 0.07

// ---------- helpers ----------
function safeValMaybe(maybe) {
  try {
    if (maybe == null) return null
    try {
      const v = val(maybe)
      if (typeof v !== 'undefined' && v !== maybe) return v
    } catch {}
    if (typeof maybe === 'function') return maybe()
    if (typeof maybe === 'object') {
      if ('value' in maybe) return maybe.value
      if (typeof maybe.get === 'function') return maybe.get()
    }
    return maybe
  } catch {
    return null
  }
}
function toNumberSafe(v, fallback = NaN) {
  try {
    const n = Number(safeValMaybe(v))
    return isNaN(n) ? fallback : n
  } catch {
    return fallback
  }
}

// ---------- main ----------
export default function ScrollSection() {
  const project = getProject('myProject', { state: theatreeBBState })
  const sheet = project.sheet('Scene')
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const pages = isMobile ? 19 : PAGES

  const {
    overrideStartSec,
    overrideEndSec,
    pathScale,
    cameraOffsetY,
    pathSide
  } = useControls('Override & Path', {
    overrideStartSec: { value: 30, min: 0, max: 3600, step: 1 },
    overrideEndSec: { value: 200, min: 1, max: 3600, step: 1 },
    pathScale: { value: 5, min: 0.1, max: 50, step: 0.1 },
    cameraOffsetY: { value: 2, min: -20, max: 40, step: 0.1 },
    pathSide: { value: 'right', options: ['right', 'left'] }
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
function Scene({ sheet, overrideStartSec, overrideEndSec, pathScale, cameraOffsetY, pathSide }) {
  const scroll = useScroll()
  const { set } = useThree()

  const cameraRef = useRef()
  const springGroupRef = useRef()
  const prevOverrideRef = useRef(false)
  const isUnlinkedRef = useRef(false)
  const theatreBindingRef = useRef(null)

  const log = (...args) => console.log('[SPRING]', ...args)

  // expose globally for debug
  useEffect(() => {
    if (cameraRef.current) window._springCamRef = cameraRef
  }, [])

  // helix path
  class HelixCurve extends THREE.Curve {
    constructor({ turns = 0.95, radius = 1, height = 1 } = {}) {
      super()
      this.turns = turns
      this.radius = radius
      this.height = height
    }
    getPoint(t, optionalTarget = new THREE.Vector3()) {
      const angle = t * this.turns * Math.PI * 2
      const x = Math.cos(angle) * this.radius
      const z = Math.sin(angle) * this.radius
      const y = (t - 0.5) * this.height
      return optionalTarget.set(x, y, z)
    }
  }
  const curve = useMemo(() => new HelixCurve({ turns: 0.95, radius: 1, height: 10 }), [])

  // central camera loop
  useFrame((_, delta) => {
    const cam = cameraRef.current
    if (!cam) return
    const fovTarget = prevOverrideRef.current ? 45 : 35
    cam.fov = THREE.MathUtils.lerp(cam.fov, fovTarget, Math.min(1, 6 * delta))
    cam.updateProjectionMatrix()

    if (prevOverrideRef.current) {
      const ud = cam.userData || {}
      if (ud.desiredPos && ud.desiredQuat) {
        cam.position.copy(ud.desiredPos)
        cam.quaternion.copy(ud.desiredQuat)
        cam.updateMatrixWorld()
      }
    }
  })

  // sync Theatre sequence with scroll
  useFrame(() => {
    if (!sheet || !scroll) return
    try {
      const ptr = sheet.sequence.pointer
      const seqLen = toNumberSafe(ptr?.length, 1)
      sheet.sequence.position = scroll.offset * Math.max(1, seqLen)
    } catch (e) {
      console.warn('[THEATRE] sync fail', e)
    }
  })

  // path-follow + override control
  useFrame(() => {
    if (!sheet || !scroll || !cameraRef.current) return
    let seqPos = toNumberSafe(sheet.sequence?.pointer?.time, toNumberSafe(sheet.sequence?.position, 0))
    const shouldOverride = seqPos >= overrideStartSec && seqPos < overrideEndSec

    // --- ENTER override ---
    if (shouldOverride && !prevOverrideRef.current) {
      prevOverrideRef.current = true
      log(`ENTER override @ ${seqPos.toFixed(2)}`)
      try {
        // unlink Theatre binding
        if (cameraRef.current.userData.theatreBinding) {
          theatreBindingRef.current = cameraRef.current.userData.theatreBinding
          delete cameraRef.current.userData.theatreBinding
          isUnlinkedRef.current = true
          log('Theatre binding unlinked (camera isolated)')
        }
      } catch {}
    }

    // --- EXIT override ---
    if (!shouldOverride && prevOverrideRef.current) {
      prevOverrideRef.current = false
      log(`EXIT override @ ${seqPos.toFixed(2)}`)

      // merge SpringPath last transform → Theatre
      const cam = cameraRef.current
      const pos = cam.position.clone()
      const quat = cam.quaternion.clone()
      const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ')
      const rot = [
        THREE.MathUtils.radToDeg(euler.x),
        THREE.MathUtils.radToDeg(euler.y),
        THREE.MathUtils.radToDeg(euler.z)
      ]

      try {
        const camObj = sheet.object('Camera')
        if (camObj) {
          camObj.props.position = [pos.x, pos.y, pos.z]
          camObj.props.rotation = rot
          log('MERGE → Theatre camera updated with final SpringPath transform', pos, rot)
        }
      } catch (e) {
        console.warn('[SPRING] merge failed', e)
      }

      // relink Theatre binding
      if (isUnlinkedRef.current && theatreBindingRef.current) {
        cameraRef.current.userData.theatreBinding = theatreBindingRef.current
        log('Theatre binding restored')
        isUnlinkedRef.current = false
        theatreBindingRef.current = null
      }
    }

    // --- ACTIVE override behaviour ---
    if (shouldOverride) {
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
      const sideOffset = 0.6 * sideSign * pathScale
      const worldPos = p.clone().multiplyScalar(pathScale)
      const localOffset = new THREE.Vector3(sideOffset, cameraOffsetY, 0).applyQuaternion(quat)
      const camWorldPos = worldPos.clone().add(localOffset)

      cameraRef.current.userData.desiredPos = camWorldPos.clone()
      cameraRef.current.userData.desiredQuat = quat.clone()
    }
  })

  return (
    <>
      <PerspectiveCamera ref={cameraRef} theatreKey='Camera' makeDefault near={0.1} far={5000} fov={35} />
      <group ref={springGroupRef}>
        <e.group theatreKey='SpringGroup' position={[0, 0, 0]}>
          <SpringPath count={20} turns={0.95} coilRadius={5} height={10} scale={pathScale} activeIndexRef={null} />
        </e.group>
      </group>
      <Suspense fallback={null}>
        <WaterScene />
        <UnderwaterFog />
        <RockStone scale={30} />
        <Enveremnt />
      </Suspense>
    </>
  )
}
