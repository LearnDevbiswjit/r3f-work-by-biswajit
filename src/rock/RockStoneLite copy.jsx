import React, { useMemo } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'

export function RockStoneLite({
  textureUrl,
  onSelect,
  ...props
}) {
  const { nodes } = useGLTF('/models/Rock-Product-New-7.glb')
  const texture = useTexture(textureUrl)

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(1, 1)
    texture.anisotropy = 16
    texture.needsUpdate = true
  }, [texture])

  return (
    <group {...props} dispose={null}>
      <group
        position={[-2.774, -1.988, 3.948]}
        rotation={[-2.104, 0.777, 0.48]}
        scale={0.025}
      >
        <mesh
          geometry={nodes.Object_2015.geometry}
          position={[-1.314, -0.619, 2.351]}
          scale={152.156}
          castShadow
          receiveShadow
          onPointerDown={(e) => {
            e.stopPropagation()
            onSelect?.()
          }}
        >
          <meshStandardMaterial
            map={texture}
            roughness={0.9}
            metalness={0}
          />
        </mesh>
      </group>
    </group>
  )
}

useGLTF.preload('/models/Rock-Product-New-7.glb')
