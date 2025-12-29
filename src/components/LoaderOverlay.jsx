import { useEffect, useState, useRef } from 'react'
import * as THREE from 'three'
import { useEnvironmentGate } from '../loader/EnvironmentGate'

export default function LoaderOverlay() {
  const { envReady, manualPending } = useEnvironmentGate()

  const [progress, setProgress] = useState(0)
  const [threeDone, setThreeDone] = useState(false)
  const [hide, setHide] = useState(false)

  const firedRef = useRef(false)

  // Three.js asset progress
  useEffect(() => {
    const mgr = THREE.DefaultLoadingManager

    mgr.onProgress = (_, loaded, total) => {
      if (total > 0) {
        setProgress(Math.round((loaded / total) * 100))
      }
    }

    mgr.onLoad = () => {
      setThreeDone(true)
      console.log('[LOADER] three assets done')
    }

    return () => {
      mgr.onProgress = null
      mgr.onLoad = null
    }
  }, [])

  // FINAL SYNC (industry rule)
  useEffect(() => {
    if (!threeDone) return
    if (manualPending > 0) return
    if (!envReady) return
    if (firedRef.current) return

    firedRef.current = true
    setProgress(100)

    requestAnimationFrame(() => {
      setTimeout(() => {
        window.__APP_LOADER_DONE__ = true
        window.dispatchEvent(new Event('APP_LOADER_DONE'))
        setHide(true)
      }, 300) // smooth UX buffer
    })
  }, [threeDone, manualPending, envReady])

  if (hide) return null

  const shown =
    manualPending > 0 && progress >= 95 ? 95 : progress

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
        fontSize: 16
      }}
    >
      Loading {shown}%
    </div>
  )
}
