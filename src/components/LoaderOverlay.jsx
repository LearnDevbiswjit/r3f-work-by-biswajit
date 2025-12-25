// src/components/LoaderOverlay.jsx
import { useEffect, useState, useRef } from 'react'
import * as THREE from 'three'
import { useEnvironmentGate } from '../loader/EnvironmentGate'

export default function LoaderOverlay() {
  const { envReady } = useEnvironmentGate()

  const [progress, setProgress] = useState(0)
  const [assetsDone, setAssetsDone] = useState(false)
  const [hide, setHide] = useState(false)

  const firedRef = useRef(false)

  /* ---------- asset loading ---------- */
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

  /* ---------- FINAL SYNC ---------- */
  useEffect(() => {
    if (!assetsDone || !envReady) return
    if (firedRef.current) return

    firedRef.current = true
    setProgress(100)

    // ⏳ wait a tick so DOM is ready
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.__APP_LOADER_DONE__ = true
        window.dispatchEvent(new Event('APP_LOADER_DONE'))
        setHide(true)
      }, 350) // fade / UX buffer
    })
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
