// src/components/CameraIntroController.jsx
import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { gsap } from 'gsap'
import * as THREE from 'three'

export default function CameraIntroController({
  duration = 4,
  radius = 1.8,
  heightOffset = 0.25,
  angleDeg = 35
}) {
  const { camera } = useThree()
  const played = useRef(false)

  useEffect(() => {
    const startIntro = () => {
      if (played.current) return
      played.current = true

      const theatreCam = window.__THEATRE_STATIC_CAMERA__
      if (!theatreCam) return

      // 🔒 lock systems
      window.__INTRO_PLAYING__ = true
      window.__OVERLAY_LOCKED__ = true

      const targetPos = new THREE.Vector3(
        theatreCam.pos.x,
        theatreCam.pos.y,
        theatreCam.pos.z
      )

      const targetQuat = new THREE.Quaternion(
        theatreCam.quat.x,
        theatreCam.quat.y,
        theatreCam.quat.z,
        theatreCam.quat.w
      )

      const lookTarget = new THREE.Vector3(0, 0, 0)
      const angleRad = THREE.MathUtils.degToRad(angleDeg)

      const proxy = { t: 0 }

      gsap.to(proxy, {
        t: 1,
        duration,
        ease: 'power3.out',
        onUpdate: () => {
          const a = THREE.MathUtils.lerp(angleRad, 0, proxy.t)
          const offset = new THREE.Vector3(
            Math.sin(a) * radius,
            heightOffset,
            Math.cos(a) * radius
          )
          camera.position.copy(targetPos).add(offset)
          camera.lookAt(lookTarget)
        },
        onComplete: () => {
          camera.position.copy(targetPos)
          camera.quaternion.copy(targetQuat)

          // 🔓 unlock
          window.__INTRO_PLAYING__ = false
          window.__OVERLAY_LOCKED__ = false

          // 🔥 IMPORTANT: re-sync GSAP overlay
          window.dispatchEvent(new Event('OVERLAY_RESYNC'))
        }
      })
    }

    if (window.__APP_LOADER_DONE__) startIntro()
    else window.addEventListener('APP_LOADER_DONE', startIntro, { once: true })

    return () => {
      window.removeEventListener('APP_LOADER_DONE', startIntro)
    }
  }, [camera, duration, radius, heightOffset, angleDeg])

  return null
}
