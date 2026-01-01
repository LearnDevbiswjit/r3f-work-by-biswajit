import * as THREE from 'three'
import { useMemo } from 'react'
import { Line } from '@react-three/drei'

/* ---------- PRE PATH (round / free) ---------- */
function makePrePath() {
  const pts = []
  const count = 120

  for (let i = 0; i < count; i++) {
    const t = i / count
    const a = t * Math.PI * 2

    pts.push(
      new THREE.Vector3(
        Math.cos(a) * 18,     // round X
        Math.sin(a) * 6 + 8,  // soft Y wave
        -t * 35               // forward Z
      )
    )
  }

  return pts
}

/* ---------- HELIX ---------- */
function makeHelix({ turns = 1.2, height = 60, radius = 14, points = 400 }) {
  const pts = []

  for (let i = 0; i < points; i++) {
    const t = i / points
    const a = t * turns * Math.PI * 2

    pts.push(
      new THREE.Vector3(
        Math.cos(a) * radius,
        height * (1 - t),
        Math.sin(a) * radius
      )
    )
  }

  return pts
}

/* ---------- POST PATH ---------- */
function makePostPath() {
  const pts = []
  const count = 120

  for (let i = 0; i < count; i++) {
    const t = i / count

    pts.push(
      new THREE.Vector3(
        14 + t * 30,               // go right
        6 - t * 4,                 // go down
        10 + Math.sin(t * 3) * 8   // soft wave forward
      )
    )
  }

  return pts
}

/* ---------- MAIN COMPONENT ---------- */
export default function CustomHelixPathDebug() {
  const curvePoints = useMemo(() => {
    return [
      ...makePrePath(),
      ...makeHelix({}),
      ...makePostPath()
    ]
  }, [])

  return (
    <Line
      points={curvePoints}
      color="#00ffd5"    
      lineWidth={4}
      dashed={false}
    />
  )
}
