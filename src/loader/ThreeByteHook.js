import * as THREE from 'three'
import { registerSource, updateSource, completeSource } from './ByteProgressStore'

const ID = 'three-fallback'
let totalItems = 0

export function bindThreeLoader() {
  registerSource(ID, 1)

  const mgr = THREE.DefaultLoadingManager

  mgr.onStart = (_, loaded, total) => {
    totalItems = total || 1
  }

  mgr.onProgress = (_, loaded, total) => {
    const t = total || totalItems || 1
    updateSource(ID, loaded / t)
  }

  mgr.onLoad = () => {
    completeSource(ID)
  }
}
