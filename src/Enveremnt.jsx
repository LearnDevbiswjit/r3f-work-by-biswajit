// src/Enveremnt.jsx
import React, { useRef } from 'react'
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
import { UnderWaterMountainSideBig } from './component/underwater/UnderWaterMountainSideBig'

import CloudFloating from './component/CloudFloating'
import TextBoxUnderWater from './component/underwater/TextBoxUnderWater'
import CloudeGradiantShader from './component/CloudeGradiantShader'
import RockStone from './rock/RockStone'

import { useEnvironmentGate } from './loader/EnvironmentGate'

export default function Enveremnt() {
  const { reportReady } = useEnvironmentGate()
  const sentRef = useRef(false)

  // 🔥 REAL guarantee: first render frame completed
  useFrame(() => {
    if (!sentRef.current) {
      sentRef.current = true
      reportReady()
    }
  })

  return (
    <group>

      <e.group theatreKey='Cloud-front' position={[0, 0, 1]}>
              <CloudFloating
                numPlanes={20}
                opacity={0.5}
                xSpread={700}
                ySpread={70}
                zSpread={250}
                color1='#8d8093'
                color2='#ffffff'
                speed={5.9}
                sharedNoise={{
                  worldScale: 50,
                  warpAmt: 0.25,
                  ridgePower: 0.1,
                  ridgeMix: 0.1,
                  dir: [-2.0, -0.9],
                  driftSpeed: 0.018,
                  wobbleFreq: 0.01,
                  wobbleMag: 0.02,
                  dissolveScale: 3.8,
                  dissolveSpeed: 0.03,
                  dissolveWidth: 0.11
                }}
              />
            </e.group> 


      <e.group theatreKey="L1stone">
        <Float speed={2} rotationIntensity={0.1} floatIntensity={0.7}>
          <L1stone scale={10} />
        </Float>
      </e.group>

      <e.group theatreKey="L2stone">
        <Float speed={5} rotationIntensity={0.1} floatIntensity={0.7}>
          <L2stone scale={10} />
        </Float>
      </e.group>

      <e.group theatreKey="L3stone">
        <L3stone scale={50} />
      </e.group>

      <e.group theatreKey="R1stone">
        <R1stone scale={50} />
      </e.group>

      <e.group theatreKey="Pillarstone">
        <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.5}>
          <Pillarstone scale={10} />
        </Float>
      </e.group>

      <e.group theatreKey="SandSurface">
        <SandSurface textureUrl={sandUrl} size={3000} />
      </e.group>

      <e.group theatreKey="CausticsLightProjector">
        <CausticsLightProjector
          src={videoUrl}
          target={[0, 0, 0]}
          fitRect={[9000, 9000]}
          intensity={50}
        />
      </e.group>

      <e.group theatreKey="ConchShell">
        <ConchShell scale={50} />
      </e.group>

      <e.group theatreKey="FishMain">
        <Fish scale={100} />
      </e.group>

      <e.group theatreKey="SkyPlane">
        <ImagePlane url="./sky.png" position={[0, 0, -5]} />
      </e.group>

      <e.group theatreKey="RockStone">
        <RockStone scale={30} />
      </e.group>

      <e.group theatreKey="ProductShowcase">
        <Product scale={30} />
      </e.group>

      <e.group theatreKey="CloudeGradiantShader">
        <CloudeGradiantShader />
      </e.group>

      <ambientLight intensity={1} />
      <directionalLight position={[30, 40, 10]} intensity={0.75} />

      <e.group theatreKey="UnderWaterMountainSide">
        <UnderWaterMountainSide scale={20} />
      </e.group>

      <e.group theatreKey="UnderWaterMountainSideBig">
        <UnderWaterMountainSideBig scale={20} />
      </e.group>
    </group>
  )
}
