import * as THREE from 'three'
import { useProgress, useGLTF } from '@react-three/drei'
import { useEffect, useState } from 'react'
import { BASE_ASSETS } from './manifest.base'
import { HEAVY_ASSETS } from './manifest.heavy'
import { MOBILE_ASSETS } from './manifest.mobile'

const textureLoader = new THREE.TextureLoader()
const videoCache = new Map()

const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent)

export function preloadBaseAssets() {
  const textures = isMobile
    ? MOBILE_ASSETS.textures
    : BASE_ASSETS.textures

  BASE_ASSETS.gltf.forEach(useGLTF.preload)
  textures.forEach((url) => textureLoader.load(url))
}

export function preloadHeavyAssets() {
  HEAVY_ASSETS.textures?.forEach((url) => textureLoader.load(url))

  HEAVY_ASSETS.videos?.forEach((url) => {
    if (videoCache.has(url)) return
    const v = document.createElement('video')
    v.src = url
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    videoCache.set(url, v)
  })
}

export function useAssetsReady() {
  const { progress, active } = useProgress()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!active && progress === 100) {
      requestAnimationFrame(() => setReady(true))
    }
  }, [progress, active])

  return { ready, progress }
}
