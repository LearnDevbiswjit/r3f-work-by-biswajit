// src/components/WaterTop.jsx
import * as THREE from 'three'
import { useRef, useEffect } from 'react'
import { useFrame, useThree, extend } from '@react-three/fiber'
import { Water } from 'three/examples/jsm/objects/Water.js'

extend({ Water })

const L_SURFACE = 0

export default function WaterTop({ waterY = 0 }) {
  const ref = useRef()
  const { scene, camera, size, gl } = useThree()

  const isMobile = size.width <= 768

  useEffect(() => {
    gl.setPixelRatio(isMobile ? Math.min(1.5, window.devicePixelRatio) : window.devicePixelRatio)
  }, [gl, isMobile])

  useEffect(() => {
    const geom = new THREE.PlaneGeometry(isMobile ? 5000 : 15000, isMobile ? 5000 : 15000, 1, 1)

    const normals = new THREE.TextureLoader().load(
      'https://threejs.org/examples/textures/waternormals.jpg',
      t => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping
        t.repeat.set(isMobile ? 1.0 : 1.5, isMobile ? 0.9 : 1.2)
      }
    )

    const water = new Water(geom, {
      textureWidth: isMobile ? 256 : 512,
      textureHeight: isMobile ? 256 : 512,
      waterNormals: normals,
      sunDirection: new THREE.Vector3(),
      sunColor: 0x000000,
      waterColor: new THREE.Color('#9A8CA9'),
      distortionScale: isMobile ? 0.18 : 0.28,
      fog: true,
    })

    water.rotation.x = -Math.PI / 2
    water.position.y = waterY
    water.layers.set(L_SURFACE)

    if (water.material.uniforms.reflectivity)
      water.material.uniforms.reflectivity.value = 0.15

    water.material.envMap = null
    water.material.side = THREE.FrontSide
    water.material.needsUpdate = true

    scene.add(water)
    ref.current = water

    return () => {
      scene.remove(water)
      water.geometry.dispose()
      water.material.dispose()
    }
  }, [scene, waterY, isMobile])

  useFrame((_, dt) => {
    const w = ref.current
    if (!w) return

    const u = w.material.uniforms
    if (u?.time) u.time.value += dt * (isMobile ? 0.12 : 0.22)
    if (u?.normalSampler?.value) {
      u.normalSampler.value.offset.x += dt * (isMobile ? 0.005 : 0.01)
      u.normalSampler.value.offset.y += dt * (isMobile ? 0.003 : 0.006)
    }

    w.position.x = camera.position.x
    w.position.z = camera.position.z
  })

  return null
}
