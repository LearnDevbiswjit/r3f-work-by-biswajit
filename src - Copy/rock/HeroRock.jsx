import { useEffect, useLayoutEffect, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useEnvironmentGate } from '../loader/EnvironmentGate'

 
export function HeroRock(props) {
  const ref = useRef()
  const { reportReady } = useEnvironmentGate()
  const { nodes } = useGLTF('/models/Rock-Product.glb')

  useLayoutEffect(() => {
    const box = new THREE.Box3().setFromObject(ref.current)
    const center = new THREE.Vector3()
    box.getCenter(center)
    ref.current.position.sub(center)
  }, [])

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      reportReady()
    })
    return () => cancelAnimationFrame(id)
  }, [reportReady])

  return (
    <group ref={ref} {...props}>
      <mesh
        geometry={nodes.mountain.geometry}
        material={nodes.mountain.material}
        castShadow
        receiveShadow
      />
    </group>
  )
}

useGLTF.preload('/models/Rock-Product.glb')
