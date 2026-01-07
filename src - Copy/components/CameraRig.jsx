// src/components/CameraRig.jsx
// SINGLE CAMERA CONTROLLER (HELIX + FIXED TRANSITION A→HELIX)

import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useSelector } from 'react-redux'
import { useRegistry } from '../registry/TimelineRegistryContext'
import { useControls } from 'leva'
import Briks from './Briks'
import HelixLine from './HelixLine'

/* ================= DEVICE / LEVA ================= */
const isMobile =
  typeof window !== 'undefined' &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

const ENABLE_LEVA = !isMobile && process.env.NODE_ENV !== 'production'

/* ================= HELIX TUNING ================= */
const HELIX_DAMPING_DESKTOP = 3
const HELIX_DAMPING_MOBILE = 6
const HELIX_ROT_X_START = 20
const HELIX_ROT_X_END = 40
const MAX_CURSOR_YAW = THREE.MathUtils.degToRad(3)
const MAX_CURSOR_PITCH = THREE.MathUtils.degToRad(2)

/* ================= TRANSITION ================= */
const TRANSITION_TIME = 0.2 // seconds

/* ================= DEFAULT CONTROLS ================= */
const CAMERA_DEFAULTS = {
  camOffsetX: -2,
  camOffsetY: 2.5,
  camOffsetZ: -3,
  camRotDegY: -16,
  camRotDegZ: -10,
  tightFollowToggle: false,
  lookAhead: 2,
  showLine: true,
  lineColor: '#00ffea',
  lineRadius: 0.04,
  showBriks: true,
  briksScale: 1
}

/* ================= HELIX HELPERS ================= */
function makeHelixPoints({ turns = 0.95, height = 40, radius = 45, points = 2000 }) {
  const arr = []
  for (let i = 0; i <= points; i++) {
    const t = i / points
    const a = t * turns * Math.PI * 2
    arr.push(
      new THREE.Vector3(
        Math.cos(a) * radius,
        height * (1 - t),
        Math.sin(a) * radius
      )
    )
  }
  return arr
}

function buildArcLengthLUT(curve, samples = 1000) {
  const u = [], pts = []
  for (let i = 0; i <= samples; i++) {
    const uu = i / samples
    u.push(uu)
    pts.push(curve.getPoint(uu))
  }
  const s = [0]
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    total += pts[i].distanceTo(pts[i - 1])
    s.push(total)
  }
  return { uSamples: u, sSamples: s, totalLength: total }
}

function mapArcToU(lut, arcNorm) {
  const sTarget = arcNorm * lut.totalLength
  let lo = 0, hi = lut.sSamples.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lut.sSamples[mid] < sTarget) lo = mid + 1
    else hi = mid - 1
  }
  const i = Math.max(1, lo)
  const s0 = lut.sSamples[i - 1], s1 = lut.sSamples[i]
  const u0 = lut.uSamples[i - 1], u1 = lut.uSamples[i]
  const t = s1 === s0 ? 0 : (sTarget - s0) / (s1 - s0)
  return u0 + (u1 - u0) * t
}

/* ================= CAMERA RIG ================= */
export default function CameraRig({
  initialHelixConfig = { turns: 0.75, height: 25, radius: 20, points: 1500 },
  lutSamples = 1000
}) {
  const { camera } = useThree()
  const registry = useRegistry()

  const camState = useSelector(s => s.camera)
  const timeline = useSelector(s => s.timeline)

  const controls = ENABLE_LEVA
    ? useControls('Camera · Helix', CAMERA_DEFAULTS)
    : CAMERA_DEFAULTS

  const {
    camOffsetX, camOffsetY, camOffsetZ,
    camRotDegY, camRotDegZ,
    tightFollowToggle, lookAhead,
    showLine, lineColor, lineRadius,
    showBriks, briksScale
  } = controls

  const curveRef = useRef(null)
  const lutRef = useRef(null)
  const ptsRef = useRef([])
  const bricksPtsRef = useRef([])

  /* ---------- register camera ---------- */
  useEffect(() => {
    registry.setCameraRef({ camera })
    const pts = makeHelixPoints(initialHelixConfig)
    ptsRef.current = pts
    bricksPtsRef.current = pts.map(p => p.clone())
    curveRef.current = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
    lutRef.current = buildArcLengthLUT(curveRef.current, lutSamples)
  }, [registry, camera, initialHelixConfig, lutSamples])

  /* ---------- cursor rotation ---------- */
  const mouse = useRef({ x: 0, y: 0 })
  const cursorQuatSmooth = useRef(new THREE.Quaternion())

  useEffect(() => {
    if (isMobile) return
    const onMove = e => {
      mouse.current.x = THREE.MathUtils.clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1)
      mouse.current.y = THREE.MathUtils.clamp((e.clientY / window.innerHeight) * 2 - 1, -1, 1)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  const desiredPos = useRef(new THREE.Vector3())
  const desiredQuat = useRef(new THREE.Quaternion())

  const transitionFrom = useRef(null)
  const transitionTo = useRef(null)

  const overallToHelixLocal = (overall, d) => {
    const total = d.theatreA + d.helix + d.theatreB
    const tA = d.theatreA / total
    const tH = d.helix / total
    if (overall <= tA) return 0
    if (overall >= tA + tH) return 1
    return (overall - tA) / tH
  }

  useFrame((_, dt) => {
    /* ---------- fixed transition A → Helix ---------- */
    if (timeline.phase === 'transition_A_TO_HELIX') {
      if (!curveRef.current) return

      if (!transitionFrom.current) {
        transitionFrom.current = {
          pos: camera.position.clone(),
          quat: camera.quaternion.clone()
        }

        const u0 = 0
        const p0 = curveRef.current.getPoint(u0)
        const tan = curveRef.current.getTangent(u0).normalize()
        const up = new THREE.Vector3(0, 1, 0)
        const lookTarget = p0.clone().addScaledVector(tan, 2)

        const m = new THREE.Matrix4().lookAt(
          p0.clone().add(new THREE.Vector3(0, 2, -4)),
          lookTarget,
          up
        )

        transitionTo.current = {
          pos: p0.clone(),
          quat: new THREE.Quaternion().setFromRotationMatrix(m)
        }
      }

      const t =
        (performance.now() - timeline.transitionStartedAt) /
        (TRANSITION_TIME * 1000)

      const a = THREE.MathUtils.clamp(t, 0, 1)
      camera.position.lerpVectors(
        transitionFrom.current.pos,
        transitionTo.current.pos,
        a
      )
      camera.quaternion.slerpQuaternions(
        transitionFrom.current.quat,
        transitionTo.current.quat,
        a
      )
      camera.updateMatrixWorld()
      return
    }

    transitionFrom.current = null
    transitionTo.current = null

    /* ---------- helix follow ---------- */
    if (camState.mode !== 'helix') return
    if (camState.locked || !curveRef.current || !lutRef.current) return

    let arcNorm =
      camState.progress ??
      overallToHelixLocal(timeline.overallProgress, timeline.durations)

    arcNorm = THREE.MathUtils.clamp(arcNorm, 0, 1)

    const camRotDegX = THREE.MathUtils.lerp(
      HELIX_ROT_X_START,
      HELIX_ROT_X_END,
      arcNorm
    )

    const u = mapArcToU(lutRef.current, arcNorm)
    const p = curveRef.current.getPoint(u)
    const tan = curveRef.current.getTangent(u).normalize()
    const up = new THREE.Vector3(0, 1, 0)
    const right = new THREE.Vector3().crossVectors(tan, up).normalize()
    const upLocal = new THREE.Vector3().crossVectors(right, tan).normalize()

    desiredPos.current.copy(p)
      .addScaledVector(right, camOffsetX)
      .addScaledVector(upLocal, camOffsetY)
      .addScaledVector(tan, camOffsetZ)

   // ❌ PROBLEMATIC ROTATION (stateful, accumulative)

const lookTarget = p.clone().addScaledVector(tan, lookAhead)
const m = new THREE.Matrix4().lookAt(desiredPos.current, lookTarget, up)
const qLook = new THREE.Quaternion().setFromRotationMatrix(m)

const qExtra = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(
    THREE.MathUtils.degToRad(camRotDegX),
    THREE.MathUtils.degToRad(camRotDegY),
    THREE.MathUtils.degToRad(camRotDegZ),
    'YXZ'
  )
)

const targetYaw = -mouse.current.x * MAX_CURSOR_YAW
const targetPitch = -mouse.current.y * MAX_CURSOR_PITCH
const cursorQuat = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(targetPitch, targetYaw, 0, 'YXZ')
)

cursorQuatSmooth.current.slerp(cursorQuat, 1 - Math.exp(-10 * dt))

desiredQuat.current
  .copy(qLook)
  .multiply(qExtra)
  .multiply(cursorQuatSmooth.current)

const damping = isMobile ? HELIX_DAMPING_MOBILE : HELIX_DAMPING_DESKTOP
const alpha = tightFollowToggle ? 1 : (1 - Math.exp(-damping * dt))

camera.position.lerp(desiredPos.current, alpha)
camera.quaternion.slerp(desiredQuat.current, alpha)
camera.updateMatrixWorld()


  })

  return (
    <>
      {showLine && (
        <HelixLine
          points={ptsRef.current}
          color={lineColor}
          radius={lineRadius}
        />
      )}
      {showBriks && (
        <Briks
          points={bricksPtsRef.current}
          pathScale={briksScale}
          count={20}
          stepInterval={1}
          brick={{ width: 2.6, height: 0.28, depth: 1.0 }}
          pathColor={'#ff7a66'}
          proximityRadius={8}
          riseAmount={1.6}
          startLower={1.6}
          smoothing={0.14}
          floatEnabled={false}
          maxInstances={1200}
        />
      )}
    </>
  )
}
