// src/components/LoaderOverlay.jsx
import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { useEnvironmentGate } from '../loader/EnvironmentGate'

export default function LoaderOverlay() {
  const { envReady } = useEnvironmentGate()
  const [progress, setProgress] = useState(0)
  const [assetsDone, setAssetsDone] = useState(false)
  const [hide, setHide] = useState(false)

  useEffect(() => {
    const mgr = THREE.DefaultLoadingManager

    mgr.onProgress = (_, loaded, total) => {
      if (total > 0) {
        setProgress(Math.round((loaded / total) * 100))
      }
    }

    mgr.onLoad = () => {
      setAssetsDone(true)
      console.log('[LOADER] assets loaded') 
    }

    return () => {
      mgr.onProgress = null
      mgr.onLoad = null
    }
  }, [])

  useEffect(() => {
    if (assetsDone && envReady) {
      setProgress(100)
      setTimeout(() => setHide(true), 400)
    }
  }, [assetsDone, envReady])

  if (hide) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#2b2b2b',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        fontSize: 22
      }}
    >
      Loading {progress}%
    </div>
  )
}
