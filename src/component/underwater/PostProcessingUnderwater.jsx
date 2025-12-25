// src/underwater/PostProcessingUnderwater.js
import { useThree, useFrame } from '@react-three/fiber'
import {
  EffectComposer,
  Bloom,
  HueSaturation, 
  BrightnessContrast,
} from '@react-three/postprocessing'
import { useRef } from 'react'

export default function PostProcessingUnderwater({
  enabledY = 0,
}) {
  const { camera } = useThree()
  const composerRef = useRef()

  useFrame(() => {
    if (!composerRef.current) return
    composerRef.current.enabled = camera.position.y < enabledY
  })

  return (
    <EffectComposer ref={composerRef} multisampling={4}>
      <Bloom
        intensity={0.25}
        luminanceThreshold={0.4}
        luminanceSmoothing={0.85}
      />
      <HueSaturation
        hue={-0.03}
        saturation={-0.15}
      />
      <BrightnessContrast
        brightness={-0.02}
        contrast={-0.12}
      />
    </EffectComposer>
  )
}
