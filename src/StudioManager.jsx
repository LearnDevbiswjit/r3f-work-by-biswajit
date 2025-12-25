// src/StudioManager.jsx
import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import studio from '@theatre/studio'
import extension from '@theatre/r3f/dist/extension'

const IS_PROD = process.env.NODE_ENV === 'production'

export default function StudioManager() {
  const mode = useSelector(s => s.camera.mode)

  useEffect(() => {
    if (IS_PROD) return
    if (mode !== 'theatre') return
    if (window.__THEATRE_STUDIO_READY__) return

    try {
      studio.initialize()
      studio.extend(extension)
      window.__THEATRE_STUDIO_READY__ = true
      console.log('[Studio] initialized (dev only)')
    } catch (e) {
      console.warn('[Studio] already initialized')
    }
  }, [mode])

  return null
}
