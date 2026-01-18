// src/Enveremnt.jsx
import React, { useEffect, useRef,useMemo,useState } from 'react'
import * as THREE from 'three'
import { editable as e } from '@theatre/r3f'
import { Float } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'

import { assetStart, assetEnd } from './loader/AssetGate'
import { useEnvironmentGate } from './loader/EnvironmentGate'

// ===== your existing imports (UNCHANGED) =====
import { Fish } from './upperWater/fish'
import SandSurface from './component/underwater/SandSurface'
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
import UnderwaterFog from './component/underwater/UnderwaterFog'
import { UnderWaterMountainSide } from './component/underwater/UnderWaterMountainSide'
import CloudFloating from './component/CloudFloating'
import TextBoxUnderWater from './component/underwater/TextBoxUnderWater'
// import RockStone from './rock/RockStone'
  import { RockStoneLite } from './rock/RockStoneLite'
import ShaderSingleBeam from './component/underwater/ShaderSingleBeam'

import sandUrl from '../src/assets/sand.jpg?url'
import videoUrl from '../src/assets/caustics.mp4?url'
import UnderRoundMaountain from './component/underwater/UnderRoundMaountain'
import CausticsLightProjector from './component/underwater/caustics/CausticsLightProjector'
// import CustomHelixPathDebug from './CustomHelixPathDebug'
import TextWheel from './ui/TextWheel'

export default function Enveremnt ({
  rockTexture,
  onRockClick
}) {
  const { reportReady } = useEnvironmentGate()
  const { gl, scene, camera } = useThree()
  const frameOnce = useRef(false)

  /* ================== FIXED PART ================== */
  // cursorY → REF (NO STATE → NO RE-RENDER)
  const cursorYRef = useRef(0)

  const texts = useMemo(
    () => "ThreeJS * GLSL * Redux * ".repeat(4).split(" "),
    []
  )

  useEffect(() => {
    const handleMouseMove = (e) => {
      cursorYRef.current =
        (e.clientY / window.innerHeight) * 2 - 1
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])



  // ----- MANUAL ASSET: VIDEO (deterministic) -----
  useEffect(() => {
    assetStart()
    const v = document.createElement('video')
    v.src = videoUrl
    v.preload = 'auto'
    v.muted = true
    v.playsInline = true
    v.addEventListener('loadedmetadata', () => assetEnd(), { once: true })
    v.addEventListener('error', () => assetEnd(), { once: true })
    return () => {
      v.src = ''
    }
  }, [])

  // ----- FIRST RENDER COMMIT (GPU compile + one frame) -----
  useFrame(() => {
    if (frameOnce.current) return
    frameOnce.current = true

    // force shader compile deterministically
    gl.compile(scene, camera)

    requestAnimationFrame(() => {
      reportReady()
    })
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
          speed={3.0}
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
          color2='#ffffff'
          speed={2.0}
        />
      </e.group>

      <e.group theatreKey='Cloud-back-hide' position={[0, 0, 1]}>
        <CloudFloating
          numPlanes={20}
          opacity={0.5}
          xSpread={700}
          ySpread={70}
          zSpread={250}
          color1='#8d8093'
          color2='#ffffff'
          speed={1.0}
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
          speed={0}
           
        />


      </e.group>
      <e.group theatreKey='L1stone'>
        <Float speed={2}>
          <L1stone scale={1} />
        </Float>
      </e.group>

      <e.group theatreKey='L2stone'>
        <Float speed={5}>
          <L2stone scale={10} />
        </Float>
      </e.group>

      <e.group theatreKey='L3stone'>
        <Float speed={1.5}>
          <L3stone scale={50} />
        </Float>
      </e.group>

      <e.group theatreKey='R1stone'>
        <R1stone scale={50} />
      </e.group>

      <e.group theatreKey='Pillarstone'>
        <Float speed={1.5}>
          <Pillarstone scale={10} />
        </Float>
      </e.group>

      <e.group theatreKey='ConchShell'>
        <ConchShell scale={50} />
      </e.group>

      <e.group theatreKey='SkyPlane'>
        <ImagePlane url='./sky.png' position={[0, 0, -5]} />
      </e.group>

    <e.group theatreKey='RockStone'>
  <RockStoneLite
    scale={12}
    textureUrl={rockTexture}
    onClick={onRockClick}
  />
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

      <e.group theatreKey='UnderWaterMountainSide-3'>
        <UnderWaterMountainSide scale={20} />
      </e.group>

      <e.group theatreKey='UnderWaterMountainSide-4'>
        <UnderWaterMountainSide scale={20} />
      </e.group>

      <e.group theatreKey='UnderWater-Round-Maountain'>
        <UnderRoundMaountain scale={20} />
      </e.group>

      <e.pointLight theatreKey='LightBlue' position={[0, 0, 1]} />
      <e.pointLight theatreKey='LightBlue 2' position={[0, 0, 1]} />
      <e.pointLight theatreKey='Light-3' position={[0, 0, 1]} />

      <e.group theatreKey='UnderwaterSleeve'>
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
        <SandSurface textureUrl={sandUrl} size={5000} />
      </e.group>

      <UnderwaterFog
        waterY={0}
        surfaceColor='#E8C5D2'
        surfaceDensity={0.00009}
        underColor='#7E66A4'
        underDensity={0.0015}
        blendMeters={30}
      />

      <e.group theatreKey='TextBoxUnderWater-1'>
        <TextBoxUnderWater
          startAt={5000}
          duration={3500}
          title='Skin Health'
          bullets={[
            'Anti-aging, collagen production, reduces acne.',
            'Helps with severe skin conditions.'
          ]}
          bubbleSrc='/textures/bubble1.png'
          position={[0, 0.8, 0]}
          scale={40}
        />
      </e.group>

      {/* <e.group theatreKey='TextBoxUnderWater-2'>
        <TextBoxUnderWater startAt={6000} duration={600} title='Skin Health'
          bullets={['Anti-aging, collagen production, reduces acne.','Helps with severe skin conditions.']}
          bubbleSrc='/textures/bubble1.png' position={[0,0.8,0]} scale={20} />
      </e.group> */}

      <e.group theatreKey='CausticsLightProjector' position={[0, 0, -1]}>
        <CausticsLightProjector
          src={videoUrl}
          target={[0, 200, 0]}
          fitRect={[5000, 5000]}
          worldCell={1000}
          cookieSize={512}
          intensity={10}
          playbackRate={2}
        />
      </e.group>

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


       {/* <e.group theatreKey='Custom-Helix-Path'>
        <CustomHelixPathDebug scale={1} />
      </e.group > */}


<e.group theatreKey='text-wheel'>
        <TextWheel scale={25}
          texts={texts}
          cursorYRef={cursorYRef}
          position={[0, -5.5, 0]}
        />
      </e.group>


         {/* <e.group theatreKey='TextBoxUnderWater-1' position={[0, 0, 1]}>
        <TextBoxUnderWater
          startAt={112}  
          duration={4}  
          scrollTimelineLength={145}
          title='Skin Health'
          bullets={[
            'Anti-aging, collagen production, reduces acne, hydrates skin and decreases excessive sebum oil in the skin.',
            'Helps with severe skin conditions like eczema and psoriasis.'
          ]}
          bubbleSrc='/textures/bubble1.png'
          position={[0, 0.8, 0]}
          scale={25}
        />
      </e.group> */}

       <e.group theatreKey='TextBoxUnderWater-1' position={[0, 0, 1]}>
              <TextBoxUnderWater
                startAt={112} // এই কম্পোনেন্ট 30s এ শুরু করবে
                duration={4} // 4 seconds-এর স্ক্রল পজিশনে পুরো growth হবে (0->1)
                scrollTimelineLength={145}
                title='Skin Health'
                bullets={[
                  'Anti-aging, collagen production, reduces acne, hydrates skin and decreases excessive sebum oil in the skin.',
                  'Helps with severe skin conditions like eczema and psoriasis.'
                ]}
                
                position={[0, 0.8, 0]}
                scale={20}
                depthTest={false}
depthWrite={false}
renderOrder={999}

              />
            </e.group>


        <e.group theatreKey='TextBoxUnderWater-2' position={[0, 0, 1]}>
              <TextBoxUnderWater
                startAt={140} // এই কম্পোনেন্ট 30s এ শুরু করবে
                duration={6} // 4 seconds-এর স্ক্রল পজিশনে পুরো growth হবে (0->1)
                scrollTimelineLength={145}
                title='Skin Health'
                bullets={[
                 'GPU-driven rendering pipeline: minimizing draw calls, batching geometry, and using instancing for massive performance gains.',
                'Shader-based animations (GLSL) offload work from CPU to GPU, enabling smooth underwater effects even on mobile devices.'
                ]}
                bubbleSrc='/textures/bubble1.png'
                position={[0, 0.8, 0]}
                scale={15}
                depthTest={false}
depthWrite={false}
renderOrder={999}

              />
            </e.group>
      

            <e.group theatreKey='TextBoxUnderWater-3' position={[0, 0, 1]}>
              <TextBoxUnderWater
                startAt={142} // এই কম্পোনেন্ট 30s এ শুরু করবে
                duration={6} // 4 seconds-এর স্ক্রল পজিশনে পুরো growth হবে (0->1)
                scrollTimelineLength={145}
                title='Skin Health'
                 bullets={[
                  'Anti-aging, collagen production, reduces acne, hydrates skin and decreases excessive sebum oil in the skin.',
                  'Helps with severe skin conditions like eczema and psoriasis.'
                ]}
                bubbleSrc='/textures/bubble1.png'
                position={[0, 0.8, 0]}
                scale={15}
                depthTest={false}
depthWrite={false}
renderOrder={999}

              />
            </e.group>


      
    </group>
  )
}
