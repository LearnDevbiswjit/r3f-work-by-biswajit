import * as THREE from 'three'
import { useMemo } from 'react'
import { Line } from '@react-three/drei'

export function useCustomHelixaPath () {
  return useMemo(() => {
    const pts = []

    /* ================= CONFIG ================= */
    const PRE_PTS   = 10
    const HELIX_PTS = 220
    const POST_PTS  = 160

    const PRE_LEN   = 20
    const HELIX_R   = 18
    const HELIX_H   = 40
    const HELIX_T   = 0.75
    const POST_LEN  = 100

    /* ================= HELIX FIRST ================= */
    const HELIX_START = new THREE.Vector3(0, 26, 90)
    const helixPts = []

    for (let i = 0; i < HELIX_PTS; i++) {
      const t = i / (HELIX_PTS - 1)
      const a = t * HELIX_T * Math.PI * 2

      helixPts.push(
        new THREE.Vector3(
          HELIX_START.x + Math.cos(a) * HELIX_R,
          HELIX_START.y - t * HELIX_H,
          HELIX_START.z + Math.sin(a) * HELIX_R
        )
      )
    }

    /* ================= HELIX DIRECTION ================= */
    const helixCurve = new THREE.CatmullRomCurve3(helixPts)
    const helixStartDir = helixCurve.getTangent(0).normalize()

    const up = new THREE.Vector3(0, 1, 0)
    const right = new THREE.Vector3().crossVectors(helixStartDir, up).normalize()
    const realUp = new THREE.Vector3().crossVectors(right, helixStartDir).normalize()

    /* ================= PRE (ALIGNED TO HELIX) ================= */
    const prePts = []
    const preEnd = helixPts[0]

    for (let i = PRE_PTS - 1; i >= 0; i--) {
      const t = i / (PRE_PTS - 1)

      const backward = helixStartDir.clone().multiplyScalar(-t * PRE_LEN)
      const lateral = right.clone().multiplyScalar(Math.sin(t * Math.PI) * 4)
      const vertical = realUp.clone().multiplyScalar(Math.sin(t * Math.PI) * 1.2)

      prePts.push(
        preEnd.clone().add(backward).add(lateral).add(vertical)
      )
    }

    pts.push(...prePts)
    pts.push(...helixPts)

    let cursor = helixPts[helixPts.length - 1]

    /* ================= POST / SNAKE ================= */
    const helixEndDir = helixCurve.getTangent(1).normalize()
    const postRight = new THREE.Vector3().crossVectors(helixEndDir, up).normalize()
    const postUp = new THREE.Vector3().crossVectors(postRight, helixEndDir).normalize()

    for (let i = 0; i < POST_PTS; i++) {
      const t = i / (POST_PTS - 1)

      const dipPhase = Math.min(t / 0.25, 1)
      const xDip = -Math.sin(dipPhase * Math.PI) * 18 * (1 - dipPhase)

      const snakePhase = Math.max((t - 0.25) / 0.75, 0)
      const ySnake = Math.sin(snakePhase * Math.PI * 2 * 3.5) * 8

      const forward = helixEndDir.clone().multiplyScalar(t * POST_LEN)
      const sideways = postRight.clone().multiplyScalar(xDip)
      const vertical = postUp.clone().multiplyScalar(ySnake - t * 18)

      pts.push(
        cursor.clone().add(forward).add(sideways).add(vertical)
      )
    }

    return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.45)
  }, [])
}

/* ================= DEBUG ================= */
export default function CustomHelixaPathDebug () {
  const curve = useCustomHelixaPath()
  const points = useMemo(() => curve.getPoints(900), [curve])

  return (
    <>
      <primitive object={new THREE.AxesHelper(40)} />
      <Line points={points} color="#00ffd5" lineWidth={1} />
    </>
  )
}
