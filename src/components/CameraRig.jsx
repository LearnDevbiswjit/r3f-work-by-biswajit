// src/components/CameraRig.jsx
import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useSelector } from 'react-redux'
import { useRegistry } from '../registry/TimelineRegistryContext'
import { useControls } from 'leva'
import Briks from './Briks'
import HelixLine from './HelixLine'

// ---------- Leva toggle ----------
const isMobile =
  typeof window !== 'undefined' &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
const ENABLE_LEVA = !isMobile && process.env.NODE_ENV !== 'production'

// ---------- Locked defaults (final values) ----------
const CAMERA_DEFAULTS = {
  camOffsetX: -2,
  camOffsetY: 2.5,
  camOffsetZ: -3,

  camRotDegX: 27,
  camRotDegY: -16,
  camRotDegZ: -10,

  useAbsoluteRotation: false,
  camAbsRotX: -7.5,
  camAbsRotY: 0,
  camAbsRotZ: 0,

  tightFollowToggle: true,
  lookAhead: 2,

  showLine: true,
  lineColor: '#00ffea',
  lineRadius: 0.04,

  showBriks: true,
  briksScale: 1,

  initialYawDeg: 90,
  startFlip: false
}

// ---------- Utils ----------
function makeHelixPoints({ turns = 0.95, height = 40, radius = 25, points = 2000 }) {
  const arr = []
  for (let i = 0; i <= points; i++) {
    const t = i / points
    const a = t * turns * Math.PI * 2
    arr.push(new THREE.Vector3(Math.cos(a) * radius, height * (1 - t), Math.sin(a) * radius))
  }
  return arr
}
function buildArcLengthLUT(curve, samples = 1000) {
  const u = [], pts = []
  for (let i = 0; i <= samples; i++) {
    const uu = i / samples
    u.push(uu); pts.push(curve.getPoint(uu))
  }
  const s = [0]; let total = 0
  for (let i = 1; i < pts.length; i++) { total += pts[i].distanceTo(pts[i - 1]); s.push(total) }
  return { uSamples: u, sSamples: s, totalLength: total }
}
function mapArcToU(lut, arcNorm) {
  const sTarget = Math.max(0, Math.min(1, arcNorm)) * lut.totalLength
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
  return Math.max(0, Math.min(1, u0 + (u1 - u0) * t))
}

// ---------- Component ----------
export default function CameraRig({
  initialHelixConfig = { turns: 0.95, height: 10, radius: 7, points: 2000 },
  lutSamples = 1200,
  holdSecondsForB = 2
}) {
  const { camera } = useThree()
  const registry = useRegistry()
  const camState = useSelector(s => s.camera)
  const timelineOverall = useSelector(s => s.timeline.overallProgress)
  const durations = useSelector(s => s.timeline.durations)

  let controls = CAMERA_DEFAULTS
  if (ENABLE_LEVA) {
    controls = useControls('Camera (Helix)', {
      camOffsetX: { value: CAMERA_DEFAULTS.camOffsetX },
      camOffsetY: { value: CAMERA_DEFAULTS.camOffsetY },
      camOffsetZ: { value: CAMERA_DEFAULTS.camOffsetZ },
      camRotDegX: { value: CAMERA_DEFAULTS.camRotDegX },
      camRotDegY: { value: CAMERA_DEFAULTS.camRotDegY },
      camRotDegZ: { value: CAMERA_DEFAULTS.camRotDegZ },
      useAbsoluteRotation: { value: CAMERA_DEFAULTS.useAbsoluteRotation },
      camAbsRotX: { value: CAMERA_DEFAULTS.camAbsRotX },
      camAbsRotY: { value: CAMERA_DEFAULTS.camAbsRotY },
      camAbsRotZ: { value: CAMERA_DEFAULTS.camAbsRotZ },
      tightFollowToggle: { value: CAMERA_DEFAULTS.tightFollowToggle },
      lookAhead: { value: CAMERA_DEFAULTS.lookAhead },
      showLine: { value: CAMERA_DEFAULTS.showLine },
      lineColor: { value: CAMERA_DEFAULTS.lineColor },
      lineRadius: { value: CAMERA_DEFAULTS.lineRadius },
      showBriks: { value: CAMERA_DEFAULTS.showBriks },
      briksScale: { value: CAMERA_DEFAULTS.briksScale },
      initialYawDeg: { value: CAMERA_DEFAULTS.initialYawDeg },
      startFlip: { value: CAMERA_DEFAULTS.startFlip }
    })
  }

  const {
    camOffsetX, camOffsetY, camOffsetZ,
    camRotDegX, camRotDegY, camRotDegZ,
    useAbsoluteRotation, camAbsRotX, camAbsRotY, camAbsRotZ,
    tightFollowToggle, lookAhead,
    showLine, lineColor, lineRadius,
    showBriks, briksScale,
    initialYawDeg, startFlip
  } = controls

  const curveRef = useRef(null)
  const lutRef = useRef(null)
  const ptsRef = useRef([])
  const bricksPtsRef = useRef([])
  const desired = useRef(new THREE.Vector3())
  const tmp = useRef(new THREE.Vector3())
  const prevMode = useRef(camState.mode)
  const blendT = useRef(1)
  const blendDurationRef = useRef(0.6)
  const initialYawOffsetRad = useRef(THREE.MathUtils.degToRad(initialYawDeg || 90))
  const bHoldActive = useRef(false)
  const bHoldTimer = useRef(0)
  const bAppliedOnce = useRef(false)
  const lastEndPose = useRef({ pos: new THREE.Vector3(), quat: new THREE.Quaternion() })

  const rebuild = () => {
    const pts = makeHelixPoints(initialHelixConfig)
    ptsRef.current = pts
    curveRef.current = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
    lutRef.current = buildArcLengthLUT(curveRef.current, Math.max(300, lutSamples))
    bricksPtsRef.current = pts.map(p => p.clone())
  }

  useEffect(() => {
    initialYawOffsetRad.current = startFlip
      ? THREE.MathUtils.degToRad(initialYawDeg) + Math.PI
      : THREE.MathUtils.degToRad(initialYawDeg)
  }, [initialYawDeg, startFlip])

  useEffect(() => {
    rebuild()
    registry.setCameraRef({
      camera,
      smoothJumpToTransform: ({ pos, quat }) => {
        camera.position.copy(pos)
        camera.quaternion.copy(quat)
        camera.updateMatrixWorld()
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const overallToHelixLocal = (overall, d) => {
    const total = (d.theatreA || 0) + (d.helix || 0) + (d.theatreB || 0)
    const tA = (d.theatreA || 0) / Math.max(1e-6, total)
    const tH = (d.helix || 0) / Math.max(1e-6, total)
    if (overall <= tA) return 0
    if (overall >= tA + tH) return 1
    return (overall - tA) / tH
  }

  useFrame((_, dt) => {
    if (!curveRef.current || !lutRef.current) return
    if (camState.locked) return

    if (prevMode.current !== camState.mode) {
      blendT.current = camState.mode === 'helix' ? 0 : 1
      prevMode.current = camState.mode
    }

    let arcNorm =
      camState.mode === 'helix'
        ? camState.progress
        : overallToHelixLocal(timelineOverall, durations)
    arcNorm = Math.max(0, Math.min(1, arcNorm))

    const u = mapArcToU(lutRef.current, arcNorm)
    const p = curveRef.current.getPoint(u)
    const tan = curveRef.current.getTangent(Math.min(1, u + 0.001)).normalize()
    const WORLD_UP = new THREE.Vector3(0, 1, 0)
    let right = new THREE.Vector3().crossVectors(tan, WORLD_UP).normalize()
    if (!isFinite(right.x)) right.set(1, 0, 0)
    const upLocal = new THREE.Vector3().crossVectors(right, tan).normalize()

    desired.current.set(
      p.x + right.x * camOffsetX + upLocal.x * camOffsetY + tan.x * camOffsetZ,
      p.y + right.y * camOffsetX + upLocal.y * camOffsetY + tan.y * camOffsetZ,
      p.z + right.z * camOffsetX + upLocal.z * camOffsetY + tan.z * camOffsetZ
    )

    if (tightFollowToggle) camera.position.copy(desired.current)
    else {
      const lambda = 1 - Math.exp(-6 * dt)
      tmp.current.copy(camera.position).lerp(desired.current, lambda)
      camera.position.copy(tmp.current)
    }

    const look = Number(lookAhead) || 2
    const target = p.clone().add(tan.clone().multiplyScalar(startFlip ? -look : look))
    const m = new THREE.Matrix4().lookAt(camera.position, target, WORLD_UP)
    const qLook = new THREE.Quaternion().setFromRotationMatrix(m)
    const qExtra = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(camRotDegX),
        THREE.MathUtils.degToRad(camRotDegY),
        THREE.MathUtils.degToRad(camRotDegZ),
        'YXZ'
      )
    )
    const qAbs = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(camAbsRotX),
        THREE.MathUtils.degToRad(camAbsRotY),
        THREE.MathUtils.degToRad(camAbsRotZ),
        'YXZ'
      )
    )

    if (useAbsoluteRotation) camera.quaternion.copy(qAbs)
    else camera.quaternion.copy(qLook.clone().multiply(qExtra).multiply(qAbs))

    camera.up.set(0, 1, 0)
    camera.updateMatrixWorld()
  })

  return (
    <>
      {showLine && ptsRef.current.length > 0 && (
        <HelixLine points={ptsRef.current} color={lineColor} radius={lineRadius} />
      )}
      {showBriks && bricksPtsRef.current.length > 0 && (
        <Briks
          points={bricksPtsRef.current}
          pathScale={briksScale}
          count={20}
          stepInterval={1}
          brick={{ width: 2.6, height: 0.28, depth: 1.0 }}
          pathColor={'#ff7a66'}
          proximityRadius={8.0}
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
