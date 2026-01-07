// src/theatre/bootstrapRegisterSimulated.js
import * as THREE from 'three'

export function registerSimulatedTheatre(
  registry,
  remoteState = null
) {
  if (process.env.NODE_ENV === 'production') return
  if (!registry) return

  const A = [
    new THREE.Vector3(0, 6, 18),
    new THREE.Vector3(0, 4, 10),
    new THREE.Vector3(0, 3, 6)
  ]

  function seek(n) {
    if (window.__THEATRE_CONTROL_ACTIVE) return
    const cam = registry.getCameraRef?.()
    if (!cam?.camera) return

    const i = Math.min(A.length - 1, Math.floor(n * A.length))
    cam.camera.position.copy(A[i])
    cam.camera.updateMatrixWorld()
  }

  registry.registerTimeline('theatreA', { seekNormalized: seek })
  registry.registerTimeline('theatreB', { seekNormalized: seek })
}
