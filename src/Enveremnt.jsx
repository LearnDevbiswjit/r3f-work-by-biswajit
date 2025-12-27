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

import CloudFloating from './component/CloudFloating'
import TextBoxUnderWater from './component/underwater/TextBoxUnderWater'
import CloudeGradiantShader from './component/CloudeGradiantShader'
import RockStone from './rock/RockStone'
// import BlenderPathDebug from './upperWater/BlenderPathDebug'
import { useEnvironmentGate } from './loader/EnvironmentGate'
// import BlenderPathWithBox from './upperWater/BlenderPathWithBox'

// import VolumetricFogBubble from './component/underwater/VolumetricFogBubble'
// import PostProcessingUnderwater from './component/underwater/PostProcessingUnderwater'
import UnderwaterFog from './component/underwater/UnderwaterFog'

 import WaterTop from './component/WaterTop'
 import WaterUnder from './component/WaterUnder'
import UnderwaterVolume from './component/UnderwaterVolume'

export default function Enveremnt () {
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
          sharedNoise={{
            worldScale: 50,
            warpAmt: 0.25,
            ridgePower: 0.1,
            ridgeMix: 0.1,
            dir: [-2.0, -0.9],
            driftSpeed: 0.218,
            wobbleFreq: 1.01,
            wobbleMag: 0.02,
            dissolveScale: 3.8,
            dissolveSpeed: 0.03,
            dissolveWidth: 0.11
          }}
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
          sharedNoise={{
            worldScale: 50,
            warpAmt: 0.25,
            ridgePower: 0.1,
            ridgeMix: 0.1,
            dir: [-4.0, -1.9],
            driftSpeed: 0.118,
            wobbleFreq: 1.01,
            wobbleMag: 0.02,
            dissolveScale: 3.8,
            dissolveSpeed: 0.03,
            dissolveWidth: 0.11
          }}
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
          sharedNoise={{
            worldScale: 300.0098,
            warpAmt: 0.55,
            ridgePower: 0.2,
            ridgeMix: 0.95,
            dir: [-1.0, 0.52],
            driftSpeed: 0.558,
            wobbleFreq: 0.02,
            wobbleMag: 0.12,
            dissolveScale: 3.8,
            dissolveSpeed: 0.03,
            dissolveWidth: 0.11
          }}
        />
      </e.group>
      <e.group theatreKey='Cloud-front-of-camera' position={[0, 0, 1]}>
        <CloudFloating
          jitterStabilize={true}
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
          sharedNoise={{
            worldScale: 0.0098,
            warpAmt: 0.55,
            ridgePower: 1.2,
            ridgeMix: 0.95,
            dir: [-1.0, 0.09],
            driftSpeed: 0.018,
            wobbleFreq: 0.05,
            wobbleMag: 0.12,
            dissolveScale: 3.8,
            dissolveSpeed: 0.03,
            dissolveWidth: 0.11
          }}
        />
      </e.group>
      {/* <e.group theatreKey="CloudeGradiantShader">
        <CloudeGradiantShader />
      </e.group> */}
      {/* <e.group theatreKey='sea-cloud-1' position={[0, 0, 1]}>
              <CloudFloating
                numPlanes={20}
                opacity={0.5}
                xSpread={1000}
                ySpread={100}
                zSpread={250}
                color1='#f8c2b7'
                color2='#f3a9b5'
                speed={0.9}
                sharedNoise={{
                  worldScale: 50,
                  warpAmt: 0.25,
                  ridgePower: 0.1,
                  ridgeMix: 0.1,
                  dir: [-1.0, -0.9],
                  driftSpeed: 0.018,
                  wobbleFreq: 0.01,
                  wobbleMag: 0.02,
                  dissolveScale: 3.8,
                  dissolveSpeed: 0.03,
                  dissolveWidth: 0.11
                }}
              />
            </e.group> */}

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
        <L3stone scale={50} />
      </e.group>

      <e.group theatreKey='R1stone'>
        <R1stone scale={50} />
      </e.group>

      <e.group theatreKey='Pillarstone'>
        <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.5}>
          <Pillarstone scale={10} />
        </Float>
      </e.group>

      <e.group theatreKey='ConchShell'>
        <ConchShell scale={50} />
      </e.group>

      {/* <e.group theatreKey='FishMain'>
        <Fish scale={100} />
        <BlenderPathDebug color='#00ffcc' width={3} />
      </e.group> */}

      {/* <gridHelper args={[100, 20]} /> */}
      <axesHelper args={[50]} />

      {/* <e.group
        theatreKey='FishPathRoot'
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
        scale={1}
      >
        <BlenderPathWithBox
          pathColor='#00ff66' // 🟢 blender path color
          boxColor='yellow' // 🟨 follower
        />
      </e.group> */}

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

      <e.pointLight theatreKey='LightBlue' position={[0, 0, 1]} />
      <e.pointLight theatreKey='LightBlue 2' position={[0, 0, 1]} />

      <e.group theatreKey='UnderwaterSleeve' position={[0, 0, 1]}>
        <UnderwaterSleeve
          topY={-0.52}
          depth={1000}
          radius={1000}
          topColor='#4D2E69'
          bottomColor='#2E264C'
          onlyWhenUnderwater={true}
        />
      </e.group>
      <e.group theatreKey='SandSurface'>
        <SandSurface textureUrl={sandUrl} size={3000} />
      </e.group>

      {/* <e.group theatreKey='CausticsLightProjector'>
        <CausticsLightProjector
          src={videoUrl}
          target={[0, 0, 0]}
          fitRect={[9000, 9000]}
          intensity={50}
        />
      </e.group> */}

      {/* <VolumetricFogBubble/>
 <PostProcessingUnderwater/> */}
      <UnderwaterFog
        waterY={0}
        surfaceColor='#E8C5D2'
        surfaceDensity={0.00009}
        underColor='#7E66A4'
        underDensity={0.001}
        blendMeters={30}
      />

      <e.mesh theatreKey='ShaderSingleBeam_A'>
        <ShaderSingleBeam
          rotation={[THREE.MathUtils.degToRad(-6), 0, 2.5]}
          seedOffset={100}
        />
      </e.mesh>

      <e.mesh theatreKey='ShaderSingleBeam_B'>
        <ShaderSingleBeam
          rotation={[THREE.MathUtils.degToRad(-6), 0, 2.5]}
          seedOffset={100}
        />
      </e.mesh>

      <e.mesh theatreKey='ShaderSingleBeam_C'>
        <ShaderSingleBeam seedOffset={100} />
      </e.mesh>

 
{/* <WaterTop waterY={0} />
      <WaterUnder waterY={0} />
      <UnderwaterVolume waterY={0} /> */}

    </group>
  )
}
