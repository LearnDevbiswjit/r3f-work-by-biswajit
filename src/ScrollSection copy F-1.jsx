// src/ScrollSection.jsx
import * as THREE from 'three'
import React, { useRef, useMemo, Suspense, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ScrollControls, useScroll, Scroll, Float } from '@react-three/drei'
import { useControls, monitor, Leva } from 'leva'
import { getProject, val } from '@theatre/core'
import theatreeBBState from './theatreState.json'
import {
  editable as e,
  SheetProvider,
  PerspectiveCamera
} from '@theatre/r3f'
import Enveremnt from './Enveremnt.jsx'
import studio from '@theatre/studio'
import extension from '@theatre/r3f/dist/extension'
studio.initialize()
studio.extend(extension)

import WaterScene from './component/WaterScene.jsx'
import UnderwaterFog from './component/underwater/UnderwaterFog.jsx'
import RockStone from './rock/RockStone.jsx'
import SpringPath from './SpringPath.jsx'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
gsap.registerPlugin(ScrollTrigger)

/* ---------------- Config ---------------- */
const PAGES = 20
const SPHERE_RADIUS = 0.07
const DEFAULT_FADE_EXIT_MS = 500
const DEFAULT_FADE_HOLD_MS = 20
const DEFAULT_FORCED_BLEND_MS = 500
const DEFAULT_FADE_COOLDOWN_MS = 300
const BLEND_MS = 200

/* ---------------- HelixCurve ---------------- */
class HelixCurve extends THREE.Curve {
  constructor ({ turns = 1, radius = 1, height = 1 } = {}) {
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

/* ---------------- Responsive helpers ---------------- */
function computeScaleForWidth (width) {
  if (!width) return 1
  if (width <= 380) return 0.6
  if (width <= 480) return 0.7
  if (width <= 768) return 0.85
  return 1
}
function useResponsiveSetup ({ wrapperRef, cameraRef }) {
  const { size } = useThree()
  useEffect(() => {
    if (!wrapperRef || !wrapperRef.current) return
    const s = computeScaleForWidth(size.width)
    wrapperRef.current.scale.set(s, s, s)
    if (cameraRef && cameraRef.current) {
      const cam = cameraRef.current
      const baseFov = 35
      let targetFov = baseFov
      if (size.width <= 380) targetFov = 60
      else if (size.width <= 480) targetFov = 70
      else if (size.width <= 768) targetFov = 38
      else targetFov = baseFov
      cam.fov = targetFov
      cam.updateProjectionMatrix()
      try {
        const origPos = cam.position.clone()
        const radial = new THREE.Vector3(origPos.x, 0, origPos.z)
        const len = radial.length()
        if (len > 0.001) {
          const comp = 1 / Math.max(0.4, s)
          const newLen = THREE.MathUtils.lerp(len, len * comp, 0.25)
          radial.setLength(newLen)
          cam.position.x = radial.x
          cam.position.z = radial.z
        }
      } catch (e) {}
    }
  }, [size.width, wrapperRef, cameraRef])
}

/* ---------------- Theatre save helper (save ALL camera props) ---------------- */
// Note: pass the already-created `project` to avoid duplicate getProject calls.
function saveCameraPoseToTheatreOnce({
  project,
  sheetName = 'Scene',
  cameraRef,
  forcedBlendRef,
  preferAtEnd = true
}) {
  try {
    if (!cameraRef || !cameraRef.current) {
      console.warn('[TheatreSave] no cameraRef.current — abort')
      return false
    }
    if (!project) {
      console.warn('[TheatreSave] no project provided — abort')
      return false
    }

    if (forcedBlendRef && forcedBlendRef.current && forcedBlendRef.current._savedToTheatre) {
      console.log('[TheatreSave] already-saved -> skipping')
      return false
    }

    const cam = cameraRef.current

    // Collect camera properties: position, quaternion, near, far, fov, zoom, rotationEuler, scale
    const pos = { x: cam.position.x, y: cam.position.y, z: cam.position.z }
    const quat = { x: cam.quaternion.x, y: cam.quaternion.y, z: cam.quaternion.z, w: cam.quaternion.w }
    const near = typeof cam.near === 'number' ? cam.near : 0.1
    const far = typeof cam.far === 'number' ? cam.far : 5000
    const fov = typeof cam.fov === 'number' ? cam.fov : 35
    const zoom = typeof cam.zoom === 'number' ? cam.zoom : 1
    const scale = cam.scale ? { x: cam.scale.x, y: cam.scale.y, z: cam.scale.z } : { x: 1, y: 1, z: 1 }
    const euler = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ')
    const rotationDeg = {
      x: THREE.MathUtils.radToDeg(euler.x),
      y: THREE.MathUtils.radToDeg(euler.y),
      z: THREE.MathUtils.radToDeg(euler.z)
    }

    // Log values first (user requested to inspect before saving)
    console.info('[TheatreSave] camera values (before save):', { pos, quat, near, far, fov, zoom, rotationDeg, scale })

    // get / create sheet and camera object safely
    let sheet = null
    try {
      sheet = project.sheet(sheetName)
    } catch (e) {
      console.warn('[TheatreSave] project.sheet threw', e)
      sheet = null
    }
    if (!sheet) {
      console.warn('[TheatreSave] sheet not found:', sheetName)
      downloadCameraPoseJSON({ pos, quat, near, far, fov, zoom, rotationDeg, scale })
      return false
    }

    try {
      if (preferAtEnd && sheet.sequence && typeof sheet.sequence.length === 'number' && sheet.sequence.length > 0) {
        sheet.sequence.position = sheet.sequence.length
      }
    } catch (e) {
      console.warn('[TheatreSave] could not move playhead to end', e)
    }

    // Create/get Camera object with all props declared
    let camObj = null
    try {
      camObj = sheet.object('Camera', {
        position: { x: 0, y: 0, z: 0 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        near: 0.1,
        far: 5000,
        fov: 35,
        zoom: 1,
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      })
    } catch (e) {
      console.warn('[TheatreSave] sheet.object failed', e)
      camObj = null
    }

    if (!camObj) {
      console.warn('[TheatreSave] failed to get/create Camera object on sheet')
      downloadCameraPoseJSON({ pos, quat, near, far, fov, zoom, rotationDeg, scale })
      return false
    }

    // Use studio.transaction to set everything atomically
    try {
      studio.transaction(({ set }) => {
        // position & quaternion
        set(camObj.props.position, pos)
        set(camObj.props.quaternion, quat)

        // camera numeric props (use props if exist)
        if (camObj.props.near) set(camObj.props.near, near)
        if (camObj.props.far) set(camObj.props.far, far)
        if (camObj.props.fov) set(camObj.props.fov, fov)
        if (camObj.props.zoom) set(camObj.props.zoom, zoom)

        // rotation & scale (store rotation in degrees to match screenshot)
        if (camObj.props.rotation) set(camObj.props.rotation, { x: rotationDeg.x, y: rotationDeg.y, z: rotationDeg.z })
        if (camObj.props.scale) set(camObj.props.scale, scale)
      })
      if (forcedBlendRef && forcedBlendRef.current) forcedBlendRef.current._savedToTheatre = true
      console.log('[TheatreSave] studio.transaction -> success (all camera props stored)')
      return true
    } catch (err) {
      console.warn('[TheatreSave] studio.transaction failed (will try fallback). Error:', err)
    }

    // fallback: direct prop writes where possible
    try {
      // position
      if (camObj.props && camObj.props.position) {
        if (typeof camObj.props.position.set === 'function') camObj.props.position.set(pos)
        else if (camObj.props.position.value !== undefined) camObj.props.position.value = pos
      }
      if (camObj.props && camObj.props.quaternion) {
        if (typeof camObj.props.quaternion.set === 'function') camObj.props.quaternion.set(quat)
        else if (camObj.props.quaternion.value !== undefined) camObj.props.quaternion.value = quat
      }
      if (camObj.props && camObj.props.near) {
        if (camObj.props.near.value !== undefined) camObj.props.near.value = near
        else if (typeof camObj.props.near.set === 'function') camObj.props.near.set(near)
      }
      if (camObj.props && camObj.props.far) {
        if (camObj.props.far.value !== undefined) camObj.props.far.value = far
        else if (typeof camObj.props.far.set === 'function') camObj.props.far.set(far)
      }
      if (camObj.props && camObj.props.fov) {
        if (camObj.props.fov.value !== undefined) camObj.props.fov.value = fov
        else if (typeof camObj.props.fov.set === 'function') camObj.props.fov.set(fov)
      }
      if (camObj.props && camObj.props.zoom) {
        if (camObj.props.zoom.value !== undefined) camObj.props.zoom.value = zoom
        else if (typeof camObj.props.zoom.set === 'function') camObj.props.zoom.set(zoom)
      }
      if (camObj.props && camObj.props.rotation) {
        if (camObj.props.rotation.value !== undefined) camObj.props.rotation.value = { x: rotationDeg.x, y: rotationDeg.y, z: rotationDeg.z }
        else if (typeof camObj.props.rotation.set === 'function') camObj.props.rotation.set({ x: rotationDeg.x, y: rotationDeg.y, z: rotationDeg.z })
      }
      if (camObj.props && camObj.props.scale) {
        if (camObj.props.scale.value !== undefined) camObj.props.scale.value = scale
        else if (typeof camObj.props.scale.set === 'function') camObj.props.scale.set(scale)
      }

      if (forcedBlendRef && forcedBlendRef.current) forcedBlendRef.current._savedToTheatre = true
      console.log('[TheatreSave] fallback direct-prop write attempted (check theatre editor).')
      return true
    } catch (err2) {
      console.warn('[TheatreSave] fallback direct write failed', err2)
    }

    // final fallback: download JSON
    downloadCameraPoseJSON({ pos, quat, near, far, fov, zoom, rotationDeg, scale })
    return false
  } catch (finalErr) {
    console.error('[TheatreSave] unexpected failure', finalErr)
    return false
  }

  function downloadCameraPoseJSON (payload) {
    try {
      const data = {
        source: 'ScrollSection.saveCameraPoseToTheatreOnce.fallback',
        timestamp: Date.now(),
        camera: payload
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `camera_pose_${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      console.warn('[TheatreSave] fallback: camera pose downloaded as JSON (manual import).')
    } catch (e) {
      console.warn('[TheatreSave] failed to download JSON fallback', e)
    }
  }
}

/* ---------------- Main component ---------------- */
export default function ScrollSection () {
  // create project once and reuse; avoid calling getProject multiple times with different configs
  const project = React.useMemo(() => getProject('myProject', { state: theatreeBBState }), [])
  window.__THEATRE_PROJECT__ = project

  const sheet = project.sheet('Scene')
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const pages = isMobile ? 19 : PAGES

  const { fadeColor, forcedBlendMs, fadeExitMs, fadeHoldMs, fadeCooldownMs } =
    useControls('Fade', {
      fadeColor: { value: '#f2cdc4' },
      forcedBlendMs: {
        value: DEFAULT_FORCED_BLEND_MS,
        min: 50,
        max: 3000,
        step: 10
      },
      fadeExitMs: { value: DEFAULT_FADE_EXIT_MS, min: 50, max: 3000, step: 10 },
      fadeHoldMs: { value: DEFAULT_FADE_HOLD_MS, min: 0, max: 2000, step: 10 },
      fadeCooldownMs: {
        value: DEFAULT_FADE_COOLDOWN_MS,
        min: 0,
        max: 2000,
        step: 10
      }
    })

  // Theatre save toggle (Leva) + manual button shown later
  const { autoSaveKeyframe } = useControls('Theatre Save', {
    autoSaveKeyframe: { label: 'Auto-save final camera to Theatre when forcedBlend completes', value: false }
  })

  const { upEnterEnabled, upExitEnabled, downEnterEnabled, downExitEnabled } =
    useControls('Fade Toggles', {
      upEnterEnabled: { label: 'Up-scroll: ENTER enabled', value: true },
      upExitEnabled: { label: 'Up-scroll: EXIT enabled', value: true },
      downEnterEnabled: { label: 'Down-scroll: ENTER enabled', value: true },
      downExitEnabled: { label: 'Down-scroll: EXIT enabled', value: true }
    })

  const {
    overrideStartSec,
    overrideEndSec,
    snapDurationSec,
    forceImmediateExitOnEnd
  } = useControls('Override Window', {
    overrideStartSec: {
      value: 28,
      min: 0,
      max: 3600,
      step: 1,
      label: 'Override START (s)'
    },
    overrideEndSec: {
      value: 300,
      min: 1,
      max: 3600,
      step: 1,
      label: 'Override END (s)'
    },
    snapDurationSec: {
      value: 1.2,
      min: 0,
      max: 2,
      step: 0.1,
      label: 'Snap duration (s)'
    },
    forceImmediateExitOnEnd: {
      value: true,
      label: 'Force immediate EXIT at end (skip stability)'
    }
  })

  useEffect(() => {
    window._springFadeDefaults = {
      forcedBlendMs: forcedBlendMs,
      fadeExitMs: fadeExitMs,
      fadeHoldMs: fadeHoldMs,
      fadeCooldownMs: fadeCooldownMs,
      fadeColor: fadeColor,
      upEnterEnabled,
      upExitEnabled,
      downEnterEnabled,
      downExitEnabled
    }
  }, [
    forcedBlendMs,
    fadeExitMs,
    fadeHoldMs,
    fadeCooldownMs,
    fadeColor,
    upEnterEnabled,
    upExitEnabled,
    downEnterEnabled,
    downExitEnabled
  ])

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <Leva hidden={isMobile} />
      <Canvas
        gl={{
          alpha: true,
          premultipliedAlpha: true,
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.NoToneMapping
        }}
        shadows
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.0
          gl.outputColorSpace = THREE.SRGBColorSpace
        }}
        style={{ width: '100vw', height: '100vh' }}
      >
        <Suspense fallback={null}>
          <WaterScene />
          <UnderwaterFog
            waterY={0}
            surfaceColor='#E8C5D2'
            surfaceDensity={0.00042}
            underColor='#7E66A4'
            underDensity={0.0014}
            blendMeters={9}
          />
        </Suspense>

        <ScrollControls pages={pages} distance={2} damping={0.35}>
          <SheetProvider sheet={sheet}>
            <Scene
              sheet={sheet}
              project={project}
              guiFadeDefaults={{
                forcedBlendMs,
                fadeExitMs,
                fadeHoldMs,
                fadeCooldownMs,
                fadeColor,
                upEnterEnabled,
                upExitEnabled,
                downEnterEnabled,
                downExitEnabled,
                overrideStartSec,
                overrideEndSec,
                snapDurationSec,
                forceImmediateExitOnEnd,
                autoSaveKeyframe
              }}
            />
          </SheetProvider>
          <Scroll html style={{ position: 'absolute', width: '100vw' }} />
        </ScrollControls>
      </Canvas>

      {/* Manual Save Button (top-right) */}
      <div style={{
        position: 'fixed',
        right: 18,
        top: 18,
        zIndex: 99999,
        display: 'flex',
        gap: 8
      }}>
        <ManualSaveButton project={project} />
      </div>
    </div>
  )
}

/* ---------------- Manual Save Button component ---------------- */
function ManualSaveButton ({ project }) {
  const [busy, setBusy] = useState(false)
  function onClickSave () {
    try {
      setBusy(true)
      const camRef = window._springCamRef
      const forcedBlendRef = window._forcedBlendRefForManualSave || { current: null }
      if (!camRef) {
        console.warn('[ManualSave] no cameraRef available (window._springCamRef missing).')
        setBusy(false)
        return
      }
      console.log('[ManualSave] manual save requested — logging camera then saving...')
      try {
        const c = camRef.current
        if (c) {
          const pos = { x: c.position.x, y: c.position.y, z: c.position.z }
          const quat = { x: c.quaternion.x, y: c.quaternion.y, z: c.quaternion.z, w: c.quaternion.w }
          console.info('[ManualSave] camera values:', { pos, quat, near: c.near, far: c.far, fov: c.fov, zoom: c.zoom })
        } else console.warn('[ManualSave] cameraRef.current is null')
      } catch (e) {
        console.warn('[ManualSave] logging camera failed', e)
      }
      const result = saveCameraPoseToTheatreOnce({
        project,
        sheetName: 'Scene',
        cameraRef: camRef,
        forcedBlendRef: forcedBlendRef,
        preferAtEnd: true
      })
      console.log('[ManualSave] save result:', result)
    } catch (e) {
      console.error('[ManualSave] unexpected', e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={onClickSave}
      style={{
        background: '#0b74de',
        color: 'white',
        border: 'none',
        padding: '8px 12px',
        borderRadius: 6,
        cursor: 'pointer',
        fontWeight: 600
      }}
    >
      {busy ? 'Saving...' : 'Save Camera Now'}
    </button>
  )
}

/* ---------------- Scene (inside Canvas) ---------------- */
function Scene ({ sheet, project, guiFadeDefaults = {} }) {
  const scroll = useScroll()
  const { set } = useThree()

  const cameraRef = useRef()
  const springGroupRef = useRef()
  const sphereRef = useRef()
  const wrapperRef = useRef()

  // expose cameraRef + forcedBlendRef for manual button fallback
  useEffect(() => {
    window._springCamRef = cameraRef
  }, [cameraRef])

  const forcedBlendRef = useRef({
    active: false,
    startTime: 0,
    duration: (guiFadeDefaults && guiFadeDefaults.forcedBlendMs) || DEFAULT_FORCED_BLEND_MS,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    fromQuat: new THREE.Quaternion(),
    toQuat: new THREE.Quaternion(),
    sessionId: null,
    sessionDir: 'down',
    _savedToTheatre: false
  })
  useEffect(() => {
    window._forcedBlendRefForManualSave = forcedBlendRef
  }, [forcedBlendRef])

  useResponsiveSetup({ wrapperRef, cameraRef })

  const {
    turns,
    coilRadius,
    pathHeight,
    pathScale,
    radialOffset,
    mode,
    startAt,
    brickCount,
    cameraSideOffset,
    cameraUpOffset,
    yOffsetDeg,
    xOffsetDeg,
    zOffsetDeg,
    positionSmoothing,
    rotationSmoothing,
    showDebugMarker,
    hiddenDepth,
    activationRange,
    riseSpeed,
    activeRadius,
    activeFade,
    downAmplitude,
    frontHold,
    curvatureEnabled,
    curvatureStrength,
    curvatureRange,
    curvatureFalloff,
    floatEnabled,
    floatSpeed,
    rotationIntensity,
    floatIntensity,
    floatingRange,
    scrollResponsiveness,
    startupBias,
    maxStep,
    scrollSpeedMultiplier,
    riseSmoothing,
    maxPitchDeg,
    minCameraDistance,
    minCamY,
    maxCamY,
    maxMovePerFrameFactor
  } = useControls({
    turns: { value: 0.95, min: 0.1, max: 4, step: 0.01 },
    coilRadius: { value: 5.0, min: 0.1, max: 20, step: 0.1 },
    pathHeight: { value: 10, min: 0.1, max: 100, step: 0.1 },
    pathScale: { value: 5, min: 0.1, max: 50, step: 0.1 },
    radialOffset: { value: 0, min: -10, max: 10, step: 0.01 },
    mode: { value: 'oppositeSideMove', options: ['normal', 'oppositeSide', 'oppositeSideMove'] },
    startAt: { value: 'top', options: ['top', 'bottom'] },
    brickCount: { value: 20, min: 1, max: 400, step: 1 },
    cameraSideOffset: { value: -10, min: -40, max: 40, step: 0.01 },
    cameraUpOffset: { value: 5.0, min: -20, max: 50, step: 0.01 },
    yOffsetDeg: { value: -64, min: -180, max: 180, step: 0.1 },
    xOffsetDeg: { value: -8, min: -180, max: 180, step: 0.1 },
    zOffsetDeg: { value: 0, min: -180, max: 180, step: 0.1 },
    positionSmoothing: { value: 0.38, min: 0, max: 1, step: 0.01 },
    rotationSmoothing: { value: 0.2, min: 0, max: 1, step: 0.005 },
    showDebugMarker: { value: true },
    hiddenDepth: { value: 70, min: 0, max: 400, step: 1 },
    activationRange: { value: 60, min: 1, max: 400, step: 0.5 },
    riseSpeed: { value: 10, min: 0.1, max: 30, step: 0.1 },
    activeRadius: { value: 3, min: 0, max: 80, step: 1 },
    activeFade: { value: 5, min: 0, max: 80, step: 0.5 },
    downAmplitude: { value: 22.0, min: 0, max: 80, step: 0.1 },
    frontHold: { value: 1, min: 0, max: 40, step: 1 },
    curvatureEnabled: { value: true },
    curvatureStrength: { value: 2.0, min: -40, max: 40, step: 0.1 },
    curvatureRange: { value: 0, min: 0, max: 120, step: 1 },
    curvatureFalloff: { value: 0, min: 0.1, max: 80, step: 0.5 },
    floatEnabled: { value: true },
    floatSpeed: { value: 1.0, min: 0.0, max: 8, step: 0.01 },
    rotationIntensity: { value: 0.6, min: 0, max: 6, step: 0.01 },
    floatIntensity: { value: 1.0, min: 0, max: 8, step: 0.01 },
    floatingRange: { value: [-0.2, 0.2] },
    scrollResponsiveness: { value: 0.45, min: 0.01, max: 1.5, step: 0.01 },
    startupBias: { value: 0.9, min: 0, max: 1.0, step: 0.01 },
    maxStep: { value: 0.12, min: 0.001, max: 1.0, step: 0.001 },
    scrollSpeedMultiplier: { value: 1.0, min: 0.01, max: 1.0, step: 0.01, label: 'Scroll Speed Multiplier' },
    riseSmoothing: { value: 0.6, min: 0.01, max: 1.0, step: 0.01 },
    maxPitchDeg: { value: 60, min: 0, max: 90, step: 1 },
    minCameraDistance: { value: 19, min: 1, max: 400, step: 1 },
    minCamY: { value: -5, min: -200, max: 200, step: 1 },
    maxCamY: { value: 80, min: -200, max: 200, step: 1 },
    maxMovePerFrameFactor: { value: 0.15, min: 0.01, max: 10, step: 0.01 }
  })

  const brickSpec = useMemo(() => ({ width: 3, height: 2, depth: 8 }), [])
  const curve = useMemo(
    () => new HelixCurve({ turns, radius: coilRadius, height: pathHeight }),
    [turns, coilRadius, pathHeight]
  )

  function ensureMatrixWorld () {
    if (!springGroupRef.current) return new THREE.Matrix4()
    springGroupRef.current.updateMatrixWorld(true)
    return springGroupRef.current.matrixWorld.clone()
  }

  const activeIndexRef = useRef(0)
  const bricksActiveRef = useRef(0)
  const smoothedIndexRef = useRef(0)
  const lastRawRef = useRef(0)
  const [isOverriding, setIsOverriding] = useState(false)
  const prevOverrideRef = useRef(false)
  const blendCancelRef = useRef(null)

  // fade / forced blend control refs
  const snapRef = useRef({ active: false, start: 0, duration: (guiFadeDefaults.snapDurationSec || 2) * 1000, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), sessionId: null })
  const softPauseRef = useRef({ active: false, start: 0, duration: 1000 })
  const stableFramesRef = useRef(0)
  const STABLE_REQUIRED = 3
  const POS_THRESHOLD = 0.12
  const ANGLE_THRESHOLD_DEG = 1.5
  const lastFadeTriggerRef = useRef(0)

  function makeSessionId () {
    return `fade-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
  }

  // Map scroll -> theatre timeline
  useFrame(() => {
    if (!sheet || !scroll) return
    const sequenceLength = Math.max(1, Number(val(sheet.sequence.pointer.length) || 1))
    sheet.sequence.position = scroll.offset * sequenceLength
  })

  // --- DEBOUNCED override detection + deferred forced-blend trigger ---
  // Add a small pending/ref to avoid immediate hard-jumps when override window toggles.
  const pendingForcedRef = useRef({ timer: null, lastScroll: 0, shouldOverride: false })

  useFrame(() => {
    if (!sheet) return

    // Calculate sequence time (same as before)
    let seqPosSeconds = 0
    try {
      const ptr = sheet.sequence && sheet.sequence.pointer
      if (ptr && typeof ptr.time === 'number') seqPosSeconds = ptr.time
      else {
        const rawPos = Number(sheet.sequence.position || 0)
        let fps = 60
        if (ptr) {
          if (typeof ptr.fps === 'number' && ptr.fps > 0) fps = ptr.fps
          else if (typeof ptr.frameRate === 'number' && ptr.frameRate > 0) fps = ptr.frameRate
        }
        const ptrLen = ptr && typeof ptr.length === 'number' ? ptr.length : NaN
        if (isFinite(ptrLen) && ptrLen > 1000) seqPosSeconds = rawPos / Math.max(1, fps)
        else {
          if (rawPos > fps * 5) seqPosSeconds = rawPos / Math.max(1, fps)
          else seqPosSeconds = rawPos
        }
      }
    } catch (e) {
      seqPosSeconds = Number(sheet.sequence.position || 0)
    }

    const AUTOSTART_SEC = typeof guiFadeDefaults.overrideStartSec === 'number' ? guiFadeDefaults.overrideStartSec : window._springFadeDefaults?.overrideStartSec || 10
    const AUTOEND_SEC = typeof guiFadeDefaults.overrideEndSec === 'number' ? guiFadeDefaults.overrideEndSec : window._springFadeDefaults?.overrideEndSec || 150

    // safe read scroll offset
    let currScrollOffset = null
    try { currScrollOffset = scroll ? THREE.MathUtils.clamp(scroll.offset, 0, 1) : null } catch (e) { currScrollOffset = null }

    const shouldOverrideNow = seqPosSeconds >= AUTOSTART_SEC && seqPosSeconds < AUTOEND_SEC

    // if override state changed, set up debounce/pending behavior
    if (shouldOverrideNow !== prevOverrideRef.current) {
      // clear any previous pending timer
      if (pendingForcedRef.current.timer) {
        clearTimeout(pendingForcedRef.current.timer)
        pendingForcedRef.current.timer = null
      }

      // store last scroll for stability check
      pendingForcedRef.current.lastScroll = currScrollOffset ?? pendingForcedRef.current.lastScroll
      pendingForcedRef.current.shouldOverride = shouldOverrideNow

      // If entering override -> don't immediately pause/play sequence; schedule a forced blend only if scroll stabilizes.
      if (shouldOverrideNow) {
        // schedule a short debounce before computing and applying forced blend
        pendingForcedRef.current.timer = setTimeout(() => {
          // still in override window?
          if (!pendingForcedRef.current.shouldOverride) return

          // read current scroll again
          const nowScroll = (scroll && typeof scroll.offset === 'number') ? THREE.MathUtils.clamp(scroll.offset, 0, 1) : pendingForcedRef.current.lastScroll
          // measure stability: require small delta from when scheduled
          const scrollDelta = Math.abs(nowScroll - (pendingForcedRef.current.lastScroll ?? nowScroll))
          const STABLE_THRESHOLD = 0.01 // tweak: how stable scroll must be (0.01 is small)
          // only trigger forced blend if scroll is stable (prevents jumping while user is actively scrubbing)
          if (scrollDelta <= STABLE_THRESHOLD) {
            // now compute target brick and set forcedBlend (same computation as before)
            try {
              const rawOffset = THREE.MathUtils.clamp(nowScroll, 0, 1)
              const tParam = startAt === 'top' ? 1 - rawOffset : rawOffset
              const count = Math.max(1, Math.floor(brickCount))
              const approxIdx = Math.floor(tParam * count)
              const brickIndex = THREE.MathUtils.clamp(approxIdx, 0, count - 1)
              const brickT = (brickIndex + 0.5) / count
              const localPoint = curve.getPointAt(brickT).clone().multiplyScalar(pathScale)
              const radial = new THREE.Vector3(localPoint.x, 0, localPoint.z).normalize()
              if (!isFinite(radial.x) || radial.lengthSq() < 1e-6) radial.set(1, 0, 0)
              const outwardDist = (brickSpec.depth / 2 + radialOffset) * pathScale
              const outward = radial.clone().multiplyScalar(outwardDist)
              const brickLocalPos = new THREE.Vector3(localPoint.x + outward.x, localPoint.y, localPoint.z + outward.z)
              const groupMat = ensureMatrixWorld()
              const worldPos = brickLocalPos.clone().applyMatrix4(groupMat)

              const zAxis_brick = radial.clone().normalize()
              const yAxis_brick = new THREE.Vector3(0, 1, 0)
              const xAxis_brick = new THREE.Vector3().crossVectors(yAxis_brick, zAxis_brick).normalize()
              const yOrtho = new THREE.Vector3().crossVectors(zAxis_brick, xAxis_brick).normalize()
              const groupQuat = new THREE.Quaternion().setFromRotationMatrix(groupMat)
              const camZ = zAxis_brick.clone().multiplyScalar(-1).applyQuaternion(groupQuat).normalize()
              const camY = yOrtho.clone().applyQuaternion(groupQuat).normalize()
              const camX = new THREE.Vector3().crossVectors(camY, camZ).normalize()
              const camBasisMat = new THREE.Matrix4().makeBasis(camX, camY, camZ)
              const camQuatFromBasis = new THREE.Quaternion().setFromRotationMatrix(camBasisMat)
              const camEuler = new THREE.Euler().setFromQuaternion(camQuatFromBasis, 'YXZ')
              if (mode === 'oppositeSide' || mode === 'oppositeSideMove') camEuler.y += Math.PI
              camEuler.y += THREE.MathUtils.degToRad(yOffsetDeg)
              camEuler.x += THREE.MathUtils.degToRad(xOffsetDeg || 0)
              camEuler.z += THREE.MathUtils.degToRad(zOffsetDeg || 0)
              const finalQuat = new THREE.Quaternion().setFromEuler(camEuler)

              // apply forced blend on the single camera instance
              if (cameraRef && cameraRef.current) {
                forcedBlendRef.current.active = true
                forcedBlendRef.current.startTime = performance.now()
                forcedBlendRef.current.duration = (guiFadeDefaults.forcedBlendMs || window._springFadeDefaults?.forcedBlendMs) || DEFAULT_FORCED_BLEND_MS
                forcedBlendRef.current.fromPos = cameraRef.current.position.clone()
                forcedBlendRef.current.fromQuat = cameraRef.current.quaternion.clone()
                forcedBlendRef.current.toPos = worldPos.clone()
                forcedBlendRef.current.toQuat = finalQuat.clone()
                forcedBlendRef.current.sessionId = makeSessionId()
                forcedBlendRef.current.sessionDir = (nowScroll > (lastRawRef.current || 0)) ? 'down' : 'up'
                forcedBlendRef.current._savedToTheatre = false
              }
              // soft pause while blending
              softPauseRef.current = { active: true, start: performance.now(), duration: 1000 }
              // let set() update three state (theatre)
              requestAnimationFrame(() => { try { set({ camera: cameraRef.current }) } catch (e) {} })
              // mark controller enter (same as before)
              const now = performance.now()
              lastFadeTriggerRef.current = now
              const sessionId = makeSessionId()
              const sessionDir = (nowScroll > (lastRawRef.current || 0)) ? 'down' : 'up'
              const enterAllowed =
                (sessionDir === 'down' && (guiFadeDefaults.downEnterEnabled ?? window._springFadeDefaults?.downEnterEnabled ?? true)) ||
                (sessionDir === 'up' && (guiFadeDefaults.upEnterEnabled ?? window._springFadeDefaults?.upEnterEnabled ?? true))
              if (enterAllowed) {
                window._springFadeController = {
                  sessionId,
                  enter: true,
                  entered: false,
                  exit: false,
                  exited: false,
                  color: (guiFadeDefaults.fadeColor || window._springFadeDefaults?.fadeColor || '#f2cdc4'),
                  forcedBlendMs: (guiFadeDefaults.forcedBlendMs || window._springFadeDefaults?.forcedBlendMs),
                  fadeExitMs: (guiFadeDefaults.fadeExitMs || window._springFadeDefaults?.fadeExitMs),
                  fadeHoldMs: (guiFadeDefaults.fadeHoldMs || window._springFadeDefaults?.fadeHoldMs),
                  sessionDir
                }
                if (forcedBlendRef.current) forcedBlendRef.current.sessionId = sessionId
              }
            } catch (err) {
              console.warn('[DEFERRED FORCED BLEND] compute failed', err)
            }
          } // end stability check
        }, 150) // debounce delay (ms)
      } else {
        // leaving override: clear pending timers and resume immediately
        pendingForcedRef.current.shouldOverride = false
        if (pendingForcedRef.current.timer) {
          clearTimeout(pendingForcedRef.current.timer)
          pendingForcedRef.current.timer = null
        }
        try { sheet.sequence.play() } catch (e) {}
        softPauseRef.current = { active: false, start: 0, duration: 1000 }
      }

      prevOverrideRef.current = shouldOverrideNow
      setIsOverriding(shouldOverrideNow)
    }

    // cleanup: if seq passes end boundary ensure resume
    if (seqPosSeconds >= (guiFadeDefaults.overrideEndSec || window._springFadeDefaults?.overrideEndSec || 150)) {
      try {
        if (!window._springSuppressTheatreResume) sheet.sequence.play()
      } catch (e) {}
    }

    setIsOverriding(prevOverrideRef.current)
    lastRawRef.current = scroll ? THREE.MathUtils.clamp(scroll.offset, 0, 1) : lastRawRef.current
  })

  // main camera/bricks logic (runs every frame)
  useFrame((state, delta) => {
    if (!scroll || !springGroupRef.current || !cameraRef.current) return

    // snap freeze
    if (snapRef.current && snapRef.current.active) {
      const now = performance.now()
      const elapsed = now - snapRef.current.start
      if (elapsed <= (snapRef.current.duration || 0)) {
        cameraRef.current.position.copy(snapRef.current.pos)
        cameraRef.current.quaternion.copy(snapRef.current.quat)
        cameraRef.current.updateMatrixWorld()
        return
      } else {
        snapRef.current.active = false
        try {
          const ctrl = window._springFadeController || null
          if (ctrl && ctrl.exit) sheet.sequence.play()
        } catch (e) {}
      }
    }

    const rawOffset = THREE.MathUtils.clamp(scroll.offset, 0, 1)
    const t = startAt === 'top' ? 1 - rawOffset : rawOffset
    const count = Math.max(1, Math.floor(brickCount))
    const targetIndexF = t * count
    bricksActiveRef.current = targetIndexF
    activeIndexRef.current = bricksActiveRef.current

    const cur = smoothedIndexRef.current || 0
    let diff = targetIndexF - cur
    const absDiff = Math.abs(diff)

    const rawResp = Math.max(0.0001, typeof scrollResponsiveness !== 'undefined' ? scrollResponsiveness : 0.8)
    const responsivenessScale = 0.55
    const effectiveResponsiveness = rawResp * responsivenessScale
    const baseLerp = 1 - Math.exp(-effectiveResponsiveness * 60 * delta)

    const scale =
      1 - Math.min(1, (absDiff * startupBias) / Math.max(1, count * 0.25))
    let lerpFactor = baseLerp * (0.2 + 0.8 * scale)

    const guiSpeedMult = typeof scrollSpeedMultiplier !== 'undefined' ? scrollSpeedMultiplier : 1.0
    const speedShrinkFactor = 0.45
    const speedMult = Math.max(0.001, guiSpeedMult * speedShrinkFactor)

    const userMaxStep = Math.max(0.001, typeof maxStep !== 'undefined' ? maxStep : 2.0)
    const maxStepScale = 0.5
    const maxStepEffective = Math.max(0.001, userMaxStep) * (delta * 60) * speedMult * maxStepScale

    let step = diff * lerpFactor
    if (Math.abs(step) > maxStepEffective) step = Math.sign(step) * maxStepEffective

    const next = cur + step
    smoothedIndexRef.current = next

    const approxIdx = Math.floor(t * count)
    const brickIndex = THREE.MathUtils.clamp(approxIdx, 0, count - 1)
    const brickT = (brickIndex + 0.5) / count

    const localPoint = curve.getPointAt(brickT).clone()
    const worldPointLocalUnits = localPoint.clone().multiplyScalar(pathScale)

    const radial = new THREE.Vector3(localPoint.x, 0, localPoint.z).normalize()
    if (!isFinite(radial.x) || radial.lengthSq() < 1e-6) radial.set(1, 0, 0)
    const outwardDist = (brickSpec.depth / 2 + radialOffset) * pathScale
    const outward = radial.clone().multiplyScalar(outwardDist)

    const zAxis_brick = radial.clone().normalize()
    const yAxis_brick = new THREE.Vector3(0, 1, 0)
    const xAxis_brick = new THREE.Vector3().crossVectors(yAxis_brick, zAxis_brick).normalize()
    const yOrtho = new THREE.Vector3().crossVectors(zAxis_brick, xAxis_brick).normalize()

    const brickLocalPos = new THREE.Vector3(worldPointLocalUnits.x + outward.x, worldPointLocalUnits.y, worldPointLocalUnits.z + outward.z)
    const brickMat = new THREE.Matrix4().makeBasis(xAxis_brick, yOrtho, zAxis_brick)
    const brickQuat = new THREE.Quaternion().setFromRotationMatrix(brickMat)

    const groupMatrix = ensureMatrixWorld()
    const brickWorldPos = brickLocalPos.clone().applyMatrix4(groupMatrix)
    const groupQuat = new THREE.Quaternion().setFromRotationMatrix(groupMatrix)
    const brickWorldQuat = brickQuat.clone().premultiply(groupQuat)

    const sideOffset = (brickSpec.width / 2) * pathScale + cameraSideOffset

    let sign = 1
    let extraAcrossMoveLocal = 0
    if (mode === 'normal') sign = 1
    else if (mode === 'oppositeSide') sign = -1
    else if (mode === 'oppositeSideMove') {
      sign = -1
      extraAcrossMoveLocal = brickSpec.width * pathScale * 0.6
    }

    const cameraLocalOffset = new THREE.Vector3(-extraAcrossMoveLocal, cameraUpOffset + sign * sideOffset, 0)
    const cameraOffsetWorld = cameraLocalOffset.clone().applyQuaternion(brickWorldQuat)
    const camDesiredWorld = brickWorldPos.clone().add(cameraOffsetWorld)

    const camZ = zAxis_brick.clone().multiplyScalar(-1).applyQuaternion(groupQuat).normalize()
    const camY = yOrtho.clone().applyQuaternion(groupQuat).normalize()
    const camX = new THREE.Vector3().crossVectors(camY, camZ).normalize()
    const camBasisMat = new THREE.Matrix4().makeBasis(camX, camY, camZ)
    const camQuatFromBasis = new THREE.Quaternion().setFromRotationMatrix(camBasisMat)

    const camEuler = new THREE.Euler().setFromQuaternion(camQuatFromBasis, 'YXZ')
    const progress = typeof t === 'number' ? THREE.MathUtils.clamp(t, 0, 1) : 0
    const extraPitchDeg = 5 * progress
    camEuler.x += THREE.MathUtils.degToRad(extraPitchDeg)
    if (mode === 'oppositeSide' || mode === 'oppositeSideMove') camEuler.y += Math.PI
    camEuler.y += THREE.MathUtils.degToRad(yOffsetDeg)
    camEuler.x += THREE.MathUtils.degToRad(xOffsetDeg || 0)
    camEuler.z += THREE.MathUtils.degToRad(zOffsetDeg || 0)

    const maxPitchRad = THREE.MathUtils.degToRad(Math.max(0, Math.min(90, maxPitchDeg || 90)))
    camEuler.x = THREE.MathUtils.clamp(camEuler.x, -maxPitchRad, maxPitchRad)
    const camFinalQuat = new THREE.Quaternion().setFromEuler(camEuler)

    if (camDesiredWorld.y < minCamY) camDesiredWorld.y = minCamY
    if (camDesiredWorld.y > maxCamY) camDesiredWorld.y = maxCamY

    const minDist = Math.max(1, minCameraDistance)
    const fromBrick = camDesiredWorld.clone().sub(brickWorldPos)
    const distFromBrick = fromBrick.length()
    if (distFromBrick < minDist) {
      const dir = fromBrick.length() > 1e-6 ? fromBrick.normalize() : camZ.clone().multiplyScalar(-1)
      camDesiredWorld.copy(brickWorldPos).add(dir.multiplyScalar(minDist))
    }

    // soft-pause factor
    let pauseFactor = 1.0
    if (softPauseRef.current && softPauseRef.current.active) {
      const now = performance.now()
      const { start, duration } = softPauseRef.current
      const u = duration > 0 ? (now - start) / duration : 1
      if (u >= 1) {
        softPauseRef.current.active = false; pauseFactor = 1.0
      } else if (u <= 0) pauseFactor = 0.0
      else pauseFactor = u * u * (3 - 2 * u)
    }

    // forced blend override
    if (forcedBlendRef.current.active && cameraRef.current) {
      const now = performance.now()
      const fb = forcedBlendRef.current
      const elapsed = Math.max(0, now - fb.startTime)
      const u = Math.min(1, fb.duration <= 0 ? 1 : elapsed / fb.duration)
      const easeU = u * u * (3 - 2 * u)
      cameraRef.current.position.lerpVectors(fb.fromPos, fb.toPos, easeU)
      cameraRef.current.quaternion.slerpQuaternions(fb.fromQuat, fb.toQuat, easeU)
      cameraRef.current.updateMatrixWorld()

      if (u >= 1) {
        forcedBlendRef.current.active = false
        window._springSuppressTheatreResume = true

        // LOG + SAVE when forcedBlend completes (if enabled)
        try {
          if (guiFadeDefaults && guiFadeDefaults.autoSaveKeyframe && project) {
            saveCameraPoseToTheatreOnce({
              project,
              sheetName: 'Scene',
              cameraRef,
              forcedBlendRef,
              preferAtEnd: true
            })
          }
        } catch (e) {
          console.warn('[TheatreSave] insert call failed', e)
        }

        const ctrl = window._springFadeController || null
        if (ctrl && ctrl.sessionId && fb.sessionId && ctrl.sessionId === fb.sessionId) {
          const sessionDir = fb.sessionDir || ctrl.sessionDir || 'down'
          const exitAllowed =
            (sessionDir === 'down' && (guiFadeDefaults.downExitEnabled ?? window._springFadeDefaults?.downExitEnabled ?? true)) ||
            (sessionDir === 'up' && (guiFadeDefaults.upEnterEnabled ?? window._springFadeDefaults?.upEnterEnabled ?? true))

          if (exitAllowed) {
            if (!ctrl.exit && !ctrl.exited) {
              ctrl.exit = true
              window._springFadeController = ctrl
            }
          } else {
            window._springFadeController = ctrl
          }
        }

        try { if (sheet && sheet.sequence) sheet.sequence.play() } catch (e) {}
      }
    } else {
      if (isOverriding && cameraRef.current) {
        const desiredDelta = camDesiredWorld.clone().sub(cameraRef.current.position)
        const maxMove = Math.max(0.0001, minDist * (state.clock.delta * 60) * (maxMovePerFrameFactor || 1))
        if (desiredDelta.length() > maxMove) {
          cameraRef.current.position.add(desiredDelta.normalize().multiplyScalar(maxMove * pauseFactor))
        } else {
          const posSmoothBase = THREE.MathUtils.clamp(1 - Math.exp(-positionSmoothing * 10 * delta), 0, 1)
          const posSmooth = posSmoothBase * pauseFactor
          cameraRef.current.position.lerp(camDesiredWorld, posSmooth)
        }
        const rotSmoothBase = THREE.MathUtils.clamp(1 - Math.exp(-rotationSmoothing * 20 * delta), 0, 1)
        const rotSmooth = rotSmoothBase * pauseFactor
        cameraRef.current.quaternion.slerp(camFinalQuat, rotSmooth)
        cameraRef.current.updateMatrixWorld()

        // stability fallback
        const posDist = cameraRef.current.position.distanceTo(camDesiredWorld)
        const q1 = cameraRef.current.quaternion
        const q2 = camFinalQuat
        const dot = Math.abs(THREE.MathUtils.clamp(q1.x * q2.x + q1.y * q2.y + q1.z * q2.z + q1.w * q2.w, -1, 1))
        const angle = 2 * Math.acos(Math.min(1, dot))
        const angleDeg = THREE.MathUtils.radToDeg(angle)
        if (posDist <= POS_THRESHOLD && angleDeg <= ANGLE_THRESHOLD_DEG) stableFramesRef.current += 1
        else stableFramesRef.current = 0

        if (stableFramesRef.current >= STABLE_REQUIRED) {
          const ctrl = window._springFadeController || {}
          if (ctrl && ctrl.sessionId && !(ctrl.exit || ctrl.exited)) {
            if (ctrl.enter) {
              const sessionDir = ctrl.sessionDir || forcedBlendRef.current.sessionDir || 'down'
              const exitAllowed =
                (sessionDir === 'down' && (guiFadeDefaults.downExitEnabled ?? window._springFadeDefaults?.downExitEnabled ?? true)) ||
                (sessionDir === 'up' && (guiFadeDefaults.upEnterEnabled ?? window._springFadeDefaults?.upEnterEnabled ?? true))
              if (exitAllowed) {
                ctrl.exit = true
                window._springFadeController = ctrl
                try { if (sheet && sheet.sequence) sheet.sequence.play() } catch (e) { console.warn('[Spring] stability->play failed', e) }
              } else window._springFadeController = ctrl
            }
          }
        }
      } else stableFramesRef.current = 0
    }

    if (sphereRef.current) {
      sphereRef.current.visible = showDebugMarker
      if (showDebugMarker) sphereRef.current.position.copy(brickWorldPos)
    }
  })

  return (
    <>
      {/* Use a single camera component instance always (no JSX swap) so no DOM errors.
          Camera behaviour (forced blend / spring-follow) is handled imperatively above. */}
      <PerspectiveCamera
        ref={cameraRef}
        theatreKey='Camera'
        makeDefault
        near={0.1}
        far={5000}
        fov={35}
        position={[0, 2, 10]}
      />

      <group ref={wrapperRef}>
        <e.group theatreKey='SpringGroup' ref={springGroupRef} position={[0, 0, 0]}>
          <SpringPath
            count={brickCount}
            turns={turns}
            coilRadius={coilRadius}
            height={pathHeight}
            scale={pathScale}
            radialOffset={radialOffset}
            texturePath='/textures/brick-texture.jpg'
            hiddenDepth={hiddenDepth}
            activationRange={activationRange}
            riseSpeed={riseSpeed}
            debugShowBricks={true}
            debugForceProgress={true}
            debugFallbackMeshes={true}
            activeIndexRef={bricksActiveRef}
            activeRadius={activeRadius}
            activeFade={activeFade}
            downAmplitude={downAmplitude}
            frontHold={frontHold}
            curvatureEnabled={curvatureEnabled}
            curvatureStrength={curvatureStrength}
            curvatureRange={curvatureRange}
            curvatureFalloff={curvatureFalloff}
            floatEnabled={floatEnabled}
            floatSpeed={floatSpeed}
            rotationIntensity={rotationIntensity}
            floatIntensity={floatIntensity}
            floatingRange={floatingRange}
            riseSmoothing={riseSmoothing}
            wave={{ enabled: false }}
          />
        </e.group>

        <mesh ref={sphereRef} visible>
          <sphereGeometry args={[SPHERE_RADIUS, 12, 10]} />
          <meshStandardMaterial color={'#ff4444'} metalness={0.1} roughness={0.4} />
        </mesh>

        <e.group theatreKey='RockStone' position={[0, 0, -1]}>
          <RockStone scale={30} />
        </e.group>
      </group>

      <Suspense fallback={null}>
        <Enveremnt />
      </Suspense>
    </>
  )
}
