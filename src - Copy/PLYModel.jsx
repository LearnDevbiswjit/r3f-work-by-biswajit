// PLYModel.jsx
import React, { useMemo } from "react"
import { useLoader } from "@react-three/fiber"
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js" // .js রাখাই ভালো
import * as THREE from "three"

export default function PLYModel({ url, scale = 1, pointSize = 0.01 }) {
  const geometry = useLoader(PLYLoader, url)

  const geom = useMemo(() => {
    // center + optional normals/bounds
    geometry.computeBoundingSphere()
    geometry.center()
    return geometry
  }, [geometry])

  return (
    <points geometry={geom} scale={scale}>
      <pointsMaterial
        size={pointSize}
        sizeAttenuation
        color="#ffffff"
        depthWrite={false}
      />
    </points>
  )
}
