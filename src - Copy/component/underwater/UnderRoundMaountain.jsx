import React, { useRef } from 'react'
import { useGLTF } from '@react-three/drei'

export default function UnderRoundMaountain(props) {
  const { nodes, materials } = useGLTF('../models/round-stone.glb')
  return (
    <group {...props} dispose={null}>
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Plane001.geometry}
        material={nodes.Plane001.material}
      />
    </group>
  )
}

useGLTF.preload('../models/round-stone.glb')
