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

    const PRE_LEN   = 3          // 🔥 shorter
    const HELIX_R   = 18
    const HELIX_H   = 40
    const HELIX_T   = 0.75
    const POST_LEN  = 100

    /* ================= START ================= */
    let cursor = new THREE.Vector3(0, 26, 90)

    /* ================= PRE (SHORT & SOFT) ================= */
    for (let i = 0; i < PRE_PTS; i++) {
      const t = i / (PRE_PTS - 1)

      // subtle sideways hint (not a big arc)
      const xBend = Math.sin(t * Math.PI * 0.5) * 2

      const p = new THREE.Vector3(
        cursor.x + xBend,
        cursor.y - t * 2,          // 🔥 minimal drop
        cursor.z - t * PRE_LEN
      )

      pts.push(p)
      cursor = p
    }

    /* ================= HELIX ================= */
    const helixStart = cursor.clone()
    for (let i = 0; i < HELIX_PTS; i++) {
      const t = i / (HELIX_PTS - 1)
      const a = t * HELIX_T * Math.PI * 2

      const p = new THREE.Vector3(
        helixStart.x + Math.cos(a) * HELIX_R,
        helixStart.y - t * HELIX_H,
        helixStart.z + Math.sin(a) * HELIX_R
      )

      pts.push(p)
      cursor = p
    }

    /* ================= POST / SNAKE ================= */
    const postStart = cursor.clone()
    for (let i = 0; i < POST_PTS; i++) {
      const t = i / (POST_PTS - 1)

      const dipPhase = Math.min(t / 0.22, 1)
      const snakePhase = Math.max((t - 0.20) / 0.98, 0)

      const xDip =
        -Math.sin(dipPhase * Math.PI) * 22 * (1 - dipPhase)

      const ySnake =
        Math.sin(snakePhase * Math.PI * 2 * 3.5) * 3

      const p = new THREE.Vector3(
        postStart.x + xDip,
        postStart.y - t * 58 + ySnake,
        postStart.z + t * POST_LEN
      )

      pts.push(p)
      cursor = p
    }

    return new THREE.CatmullRomCurve3(
      pts,
      false,
      'catmullrom',
      0.45
    )
  }, [])
}

/* ================= DEBUG VIEW ================= */
export default function CustomHelixaPathDebug () {
  const curve = useCustomHelixaPath()
  const points = useMemo(() => curve.getPoints(900), [curve])

  return (
    <>
      <axesHelper args={[40]} />
      <Line
        points={points}
        color="#00ffd5"
        lineWidth={1}
      />
    </>
  )
}
