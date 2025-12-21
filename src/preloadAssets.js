import { useGLTF } from '@react-three/drei'
import { isMobile } from './utils/device'

const base = isMobile ? 'mobile' : 'desktop'

export function preloadHeroStone() {
  useGLTF.preload(`/models/${base}/Rock-Product-New-3.glb`)
}

export function preloadEnvironmentAssets() {
  useGLTF.preload(`/models/${base}/Cloud.glb`)
  fetch('/hdr/ocean.hdr')
}
