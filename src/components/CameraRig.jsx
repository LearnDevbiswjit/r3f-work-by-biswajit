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

// ---------- Rotation range (SCROLL BASED) ----------
const HELIX_ROT_X_START = 20   // path start
const HELIX_ROT_X_END = 40     // path end

// ---------- Locked defaults ----------
const CAMERA_DEFAULTS = {
  camOffsetX: -2,
  camOffsetY: 2.5,
  camOffsetZ: -3,

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
  const sTarget = THREE.MathUtils.clamp(arcNorm, 0, 1) * lut.totalLength
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

// ---------- Component ----------
export default function CameraRig({
  initialHelixConfig = { turns: 0.95, height: 10, radius: 7, points: 2000 },
  lutSamples = 1200
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
    camRotDegY, camRotDegZ,
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

  useEffect(() => {
    const pts = makeHelixPoints(initialHelixConfig)
    ptsRef.current = pts
    bricksPtsRef.current = pts.map(p => p.clone())
    curveRef.current = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
    lutRef.current = buildArcLengthLUT(curveRef.current, lutSamples)

    registry.setCameraRef({ camera })
  }, [])

  const overallToHelixLocal = (overall, d) => {
    const total = (d.theatreA || 0) + (d.helix || 0) + (d.theatreB || 0)
    const tA = (d.theatreA || 0) / total
    const tH = (d.helix || 0) / total
    if (overall <= tA) return 0
    if (overall >= tA + tH) return 1
    return (overall - tA) / tH
  }

  useFrame((_, dt) => {
    if (!curveRef.current || !lutRef.current) return
    if (camState.locked) return

    let arcNorm =
      camState.mode === 'helix'
        ? camState.progress
        : overallToHelixLocal(timelineOverall, durations)

    arcNorm = THREE.MathUtils.clamp(arcNorm, 0, 1)

    // 🔥 SCROLL BASED ROTATION
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

    const desiredPos = p.clone()
      .addScaledVector(right, camOffsetX)
      .addScaledVector(upLocal, camOffsetY)
      .addScaledVector(tan, camOffsetZ)

    if (tightFollowToggle) camera.position.copy(desiredPos)
    else camera.position.lerp(desiredPos, 1 - Math.exp(-6 * dt))

    const lookTarget = p.clone().addScaledVector(tan, lookAhead)
    const m = new THREE.Matrix4().lookAt(camera.position, lookTarget, up)
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
    else camera.quaternion.copy(qLook.multiply(qExtra).multiply(qAbs))

    camera.updateMatrixWorld()
  })

  return (
    <>
      {showLine && <HelixLine points={ptsRef.current} color={lineColor} radius={lineRadius} />}
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
