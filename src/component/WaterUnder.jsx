// src/components/WaterUnder.jsx
import * as THREE from 'three'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'

const L_UNDER = 1

const UnderMat = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color('#5B3B86'),
  },
  `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }
  `,
  `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;

  void main(){
    float wave = sin(vUv.x * 30.0 + uTime * 1.5) * 0.04;
    float fade = smoothstep(0.0, 1.0, vUv.y);
    vec3 col = uColor * (0.6 + wave) * fade;
    gl_FragColor = vec4(col, 1.0);
  }
  `
)

extend({ UnderMat })

export default function WaterUnder({ waterY = 0 }) {
  const ref = useRef()

  useFrame((_, dt) => {
    if (ref.current) ref.current.uTime += dt
  })

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, waterY - 0.02, 0]}
      layers={L_UNDER}
      frustumCulled={false}
    >
      <planeGeometry args={[15000, 15000, 1, 1]} />
      <underMat ref={ref} />
    </mesh>
  )
}
