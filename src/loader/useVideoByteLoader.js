// src/loader/useVideoByteLoader.js
import { useEffect } from 'react'
import { registerSource, updateSource, completeSource } from './ByteProgressStore'

export function useVideoByteLoader(id, videoEl) {
  useEffect(() => {
    if (!videoEl) return

    registerSource(id, 1)

    const update = () => {
      if (videoEl.buffered.length && videoEl.duration) {
        const loaded = videoEl.buffered.end(0)
        const total = videoEl.duration
        updateSource(id, loaded / total)
      }
    }

    videoEl.addEventListener('progress', update)
    videoEl.addEventListener('loadedmetadata', update)
    videoEl.addEventListener('canplaythrough', () => completeSource(id))
    videoEl.addEventListener('error', () => completeSource(id))

    return () => {
      videoEl.removeEventListener('progress', update)
      videoEl.removeEventListener('loadedmetadata', update)
    }
  }, [id, videoEl])
}
