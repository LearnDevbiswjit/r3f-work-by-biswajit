import { useEffect, useState } from 'react'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import {
  registerSource,
  updateSource,
  completeSource
} from './ByteProgressStore'

export function useByteGLTF(url, id) {
  const [gltf, setGltf] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const res = await fetch(url)
      const reader = res.body.getReader()
      const total = +res.headers.get('Content-Length') || 1

      registerSource(id, total)

      let received = 0
      const chunks = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        updateSource(id, received)
      }

      const buffer = new Uint8Array(received)
      let offset = 0
      for (const c of chunks) {
        buffer.set(c, offset)
        offset += c.length
      }

      const loader = new GLTFLoader()
      loader.parse(buffer.buffer, '', g => {
        if (!cancelled) {
          setGltf(g)
          completeSource(id)
        }
      })
    }

    load()
    return () => { cancelled = true }
  }, [url, id])

  return gltf
}
