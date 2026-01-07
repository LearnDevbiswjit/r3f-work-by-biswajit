// src/underwater/VolumetricFogBubble.jsx
import * as THREE from 'three'
import { useRef, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'

const vertexShader = `
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const fragmentShader = `
precision highp float;

varying vec3 vWorldPos;

uniform vec3 uCameraPos;
uniform vec3 uFogColor;
uniform float uClearRadius;
uniform float uFogRadius;
uniform float uSurfaceStart;
uniform float uSurfaceEnd;
uniform float uOpacity;

void main() {
  float d = distance(vWorldPos, uCameraPos);

  float fogFactor = smoothstep(uClearRadius, uFogRadius, d);

  float surfaceFade = smoothstep(uSurfaceStart, uSurfaceEnd, vWorldPos.y);
  fogFactor *= surfaceFade;

  if (fogFactor <= 0.001) discard;

  gl_FragColor = vec4(uFogColor, fogFactor * uOpacity);
}
`

export default function VolumetricFogBubble({  
  clearRadius = 1000, 
  fogRadius = 3000,
  color = '#2E264C',
  opacity = 1.0,
  surfaceStart = 0.3,
  surfaceEnd = -0.6,
  underwaterOnly = true,
}) {
  const { camera } = useThree()
  const meshRef = useRef()

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uCameraPos: { value: new THREE.Vector3() },
          uFogColor: { value: new THREE.Color(color) }, 
          uClearRadius: { value: clearRadius },
          uFogRadius: { value: fogRadius },
          uSurfaceStart: { value: surfaceStart },
          uSurfaceEnd: { value: surfaceEnd },
          uOpacity: { value: opacity },
        },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.BackSide,
        blending: THREE.NormalBlending,
      }),
    []
  )

  const geometry = useMemo(
    () => new THREE.SphereGeometry(fogRadius, 64, 64),
    [fogRadius]
  )

  useFrame(() => {
    const m = meshRef.current
    if (!m) return

    const underwater = camera.position.y < 0
    m.visible = underwaterOnly ? underwater : true

    m.position.copy(camera.position)
    material.uniforms.uCameraPos.value.copy(camera.position)
  })

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
    />
  )
}
