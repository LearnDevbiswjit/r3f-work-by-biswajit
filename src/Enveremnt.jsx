// src/Enveremnt.jsx
import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { editable as e } from '@theatre/r3f'
import { Float } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'

import { Fish } from './upperWater/fish'
import SandSurface from './component/underwater/SandSurface'
import CausticsLightProjector from './component/underwater/caustics/CausticsLightProjector'
import { ConchShell } from './ConchShell'
import ImageSmall from './ImageSmall'
import { R1stone } from './rock/R1stone'
import { L1stone } from './rock/L1stone'
import { L2stone } from './rock/L2stone'
import { L3stone } from './rock/L3stone'
import { Pillarstone } from './rock/Pillarstone'
import ImagePlane from './ImagePlane'
import { Product } from './component/Product'
import UnderwaterSleeve from './component/underwater/UnderwaterSleeve'
import ShaderSingleBeam from './component/underwater/ShaderSingleBeam'

import sandUrl from '../src/assets/sand.jpg?url'
import videoUrl from '../src/assets/caustics.mp4?url'

import { UnderWaterMountainSide } from './component/underwater/UnderWaterMountainSide'
import CloudFloating from './component/CloudFloating'
import TextBoxUnderWater from './component/underwater/TextBoxUnderWater'
import CloudeGradiantShader from './component/CloudeGradiantShader'
import RockStone from './rock/RockStone'

import UnderwaterFog from './component/underwater/UnderwaterFog'
import WaterTop from './component/WaterTop'
import WaterUnder from './component/WaterUnder'
import UnderwaterVolume from './component/UnderwaterVolume'

import { useEnvironmentGate } from './loader/EnvironmentGate'
import { assetStart, assetEnd } from './loader/AssetGate'

const isMobile =
  typeof window !== 'undefined' &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

export default function Enveremnt () {
  const { reportReady } = useEnvironmentGate()

  const frameSentRef = useRef(false)
  const mountedRef = useRef(false)

  /* ======================================================
     MANUAL ASSET GATE — VIDEO (MOBILE SAFE)
     ====================================================== */
  useEffect(() => {
    assetStart('caustics-video')

    const video = document.createElement('video')
    video.src = videoUrl
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true

    let released = false
    const release = () => {
      if (released) return
      released = true
      assetEnd('caustics-video')
    }

    video.onloadeddata = release
    video.onerror = release

    // 🔒 mobile fallback — never block loader forever
    const safety = setTimeout(release, isMobile ? 3000 : 1500)

    return () => {
      clearTimeout(safety)
      video.src = ''
    }
  }, [])

  /* ======================================================
     FIRST FRAME + GPU SUBMIT GUARANTEE
     ====================================================== */
  useFrame(() => {
    if (frameSentRef.current) return
    frameSentRef.current = true

    requestAnimationFrame(() => {
      setTimeout(() => {
        if (mountedRef.current) {
          reportReady()
        }
      }, 0)
    })
  })

  /* ======================================================
     WATCHDOG (MOBILE / LOW-END SAFETY)
     ====================================================== */
  useEffect(() => {
    mountedRef.current = true

    const watchdog = setTimeout(() => {
      reportReady()
    }, isMobile ? 2000 : 1200)

    return () => {
      mountedRef.current = false
      clearTimeout(watchdog)
    }
  }, [])

  /* ======================================================
     SCENE
     ====================================================== */
  return (
    <group>
      <e.group theatreKey='WaterPlant1'>
        <ImageSmall url='./water-plant.png' position={[0, 0, -5]} />
      </e.group>

      <e.group theatreKey='PlantBranch1'>
        <ImageSmall
          url='./plant-image/plant-banch-1.png'
          position={[0, 0, -5]}
        />
      </e.group>

      <e.group theatreKey='Cloud-front' position={[0, 0, 1]}>
        <CloudFloating
          numPlanes={20}
          opacity={0.5}
          xSpread={700}
          ySpread={70}
          zSpread={250}
          color1='#8d8093'
          color2='#ffffff'
          speed={9.9}
        />
      </e.group>

      <e.group theatreKey='Cloud-front-2' position={[0, 0, 1]}>
        <CloudFloating
          numPlanes={20}
          opacity={0.5}
          xSpread={700}
          ySpread={70}
          zSpread={250}
          color1='#8d8093'
          color2='#f1f1f1'
          speed={9.9}
        />
      </e.group>

      <e.group theatreKey='Cloud-Back' position={[0, 0, 1]}>
        <CloudFloating
          numPlanes={20}
          opacity={0.15}
          color1='#ffffff'
          color2='#1004b9'
          xSpread={700}
          ySpread={70}
          zSpread={250}
          speed={2.0}
        />
      </e.group>

      <e.group theatreKey='Cloud-front-of-camera' position={[0, 0, 1]}>
        <CloudFloating
          jitterStabilize
          jitterLowpassAlpha={0.06}
          jitterCompStrength={1.0}
          numPlanes={20}
          opacity={0.52}
          color1='#ffffff'
          color2='#a292aa'
          speed={0.9}
          xSpread={150}
          ySpread={150}
          zSpread={50}
        />
      </e.group>

      <e.group theatreKey='L1stone'>
        <Float speed={2} rotationIntensity={0.1} floatIntensity={0.7}>
          <L1stone scale={10} />
        </Float>
      </e.group>

      <e.group theatreKey='L2stone'>
        <Float speed={5} rotationIntensity={0.1} floatIntensity={0.7}>
          <L2stone scale={10} />
        </Float>
      </e.group>

      <e.group theatreKey='L3stone'>
        <Float speed={1.5} rotationIntensity={0.1} floatIntensity={4}>
          <L3stone scale={50} />
        </Float>
      </e.group>

      <e.group theatreKey='R1stone'>
        <R1stone scale={50} />
      </e.group>

      <e.group theatreKey='Pillarstone'>
        <Float speed={1.5} rotationIntensity={0.1} floatIntensity={4}>
          <Pillarstone scale={10} />
        </Float>
      </e.group>

      <e.group theatreKey='ConchShell'>
        <ConchShell scale={50} />
      </e.group>

      <axesHelper args={[50]} />

      <e.group theatreKey='SkyPlane'>
        <ImagePlane url='./sky.png' position={[0, 0, -5]} />
      </e.group>

      <e.group theatreKey='RockStone'>
        <RockStone scale={15} />
      </e.group>

      <e.group theatreKey='ProductShowcase'>
        <Product scale={40} />
      </e.group>

      <e.group theatreKey='UnderWaterMountainSide'>
        <UnderWaterMountainSide scale={20} />
      </e.group>

      <e.group theatreKey='UnderWaterMountainSide-2'>
        <UnderWaterMountainSide scale={20} />
      </e.group>

      {/* LIGHTS */}
      <e.pointLight theatreKey='LightBlue' position={[0, 0, 1]} />
      <e.pointLight theatreKey='LightBlue 2' position={[0, 0, 1]} />
      <e.pointLight theatreKey='Light-3' position={[0, 0, 1]} />

      <e.group theatreKey='UnderwaterSleeve' position={[0, 0, 1]}>
        <UnderwaterSleeve
          topY={-0.5}
          depth={1000}
          radius={1000}
          topColor='#4D2E69'
          bottomColor='#2E264C'
          onlyWhenUnderwater
        />
      </e.group>

      <e.group theatreKey='SandSurface'>
        <SandSurface textureUrl={sandUrl} size={3000} />
      </e.group>

      <UnderwaterFog
        waterY={0}
        surfaceColor='#E8C5D2'
        surfaceDensity={0.00009}
        underColor='#7E66A4'
        underDensity={0.0015}
        blendMeters={30}
      />

      <e.group theatreKey='TextBoxUnderWater-1' position={[0, 0, 1]}>
        <TextBoxUnderWater
          startAt={5000}
          duration={600}
          title='Skin Health'
          bullets={[
            'Anti-aging, collagen production, reduces acne.',
            'Helps with severe skin conditions.'
          ]}
          bubbleSrc='/textures/bubble1.png'
          position={[0, 0.8, 0]}
          scale={20}
        />
      </e.group>

      <e.group theatreKey='TextBoxUnderWater-2' position={[0, 0, 1]}>
        <TextBoxUnderWater
          startAt={6000}
          duration={600}
          title='Skin Health'
          bullets={[
            'Anti-aging, collagen production, reduces acne.',
            'Helps with severe skin conditions.'
          ]}
          bubbleSrc='/textures/bubble1.png'
          position={[0, 0.8, 0]}
          scale={20}
        />
      </e.group>
    </group>
  )
}
