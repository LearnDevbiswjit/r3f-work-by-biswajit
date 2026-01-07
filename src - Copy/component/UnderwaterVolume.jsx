// src/components/UnderwaterVolume.jsx
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'

export default function UnderwaterVolume({
  waterY = 0,
  surfaceDensity = 0.0001,
  deepDensity = 0.004,
  surfaceColor = '#C9B7E2',
  deepColor = '#4A2F6F',
}) {
  const { scene, camera } = useThree()
  const c1 = useMemo(() => new THREE.Color(surfaceColor), [])
  const c2 = useMemo(() => new THREE.Color(deepColor), [])

  useFrame(() => {
    const d = Math.max(0, waterY - camera.position.y)
    const t = THREE.MathUtils.clamp(d / 25, 0, 1)
    const col = c1.clone().lerp(c2, t)
    const den = THREE.MathUtils.lerp(surfaceDensity, deepDensity, t)

    if (!scene.fog) scene.fog = new THREE.FogExp2(col, den)
    scene.fog.color.copy(col)
    scene.fog.density = den
  })

  return null
}
