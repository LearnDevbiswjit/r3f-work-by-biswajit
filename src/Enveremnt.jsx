// ✅ Fixed version of Enveremnt.jsx
import * as THREE from 'three'
import { editable as e } from '@theatre/r3f'
import { Float } from '@react-three/drei'
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
import CloudFloatingNew from './component/CloudFloatingNew'
import TextBoxUnderWater from './component/underwater/TextBoxUnderWater'
import CloudeGradiantShader from './component/CloudeGradiantShader'
import { UnderWaterMountainSideBig } from './component/underwater/UnderWaterMountainSideBig'
 
import { HeroRock } from './rock/HeroRock'

export default function Enveremnt () {
  return (
    <group>
      <e.group theatreKey='L1stone' position={[0, 0, -1]}>
        <Float
          speed={2}
          rotationIntensity={0.1}
          floatIntensity={0.7}
          floatingRange={[-2, 2]}
        >
          <L1stone scale={10} />
        </Float>
      </e.group>

      <e.group theatreKey='L2stone' position={[0, 0, -1]}>
        <Float
          speed={5}
          rotationIntensity={0.1}
          floatIntensity={0.7}
          floatingRange={[-2, 2]}
        >
          <L2stone scale={10} />
        </Float>
      </e.group>

      <e.group theatreKey='L3stone' position={[0, 0, -1]}>
        <L3stone scale={50} />
      </e.group>

      <e.group theatreKey='R1stone' position={[0, 0, -1]}>
        <R1stone scale={50} />
      </e.group>

      <e.group theatreKey='Pillarstone' position={[0, 0, -1]}>
        <Float
          speed={1.5}
          rotationIntensity={0.1}
          floatIntensity={0.5}
          floatingRange={[-2, 2]}
        >
          <Pillarstone scale={10} />
        </Float>
      </e.group>

      <e.group theatreKey='SandSurface' position={[0, 0, -1]}>
        <SandSurface textureUrl={sandUrl} size={3000} />
      </e.group>

      <e.group theatreKey='CausticsLightProjector' position={[0, 0, -1]}>
        <CausticsLightProjector
          src={videoUrl}
          target={[0, 0, 0]}
          fitRect={[9000, 9000]}
          worldCell={4}
          cookieSize={1024}
          intensity={50}
          playbackRate={2}
        />
      </e.group>

      <e.group theatreKey='ConchShell'>
        <ConchShell scale={50} />
      </e.group>

      <e.group theatreKey='FishMain'>
        <Fish scale={100} />
      </e.group>

      {/* ✅ FIX: Use e.group for all image-based elements */}
      <e.group theatreKey='SkyPlane'>
        <ImagePlane url='./sky.png' position={[0, 0, -5]} />
      </e.group>







      <e.group theatreKey='WaterPlant1'>
        <ImageSmall url='./water-plant.png' position={[0, 0, -5]} />
      </e.group>

      <e.group theatreKey='PlantBranch1'>
        <ImageSmall
          url='./plant-image/plant-banch-1.png'
          position={[0, 0, -5]}
        />
      </e.group>
 
      <e.group theatreKey='Cloud-front-of-camera' position={[0, 0, 1]}>
        <CloudFloating
          jitterStabilize={true}
          jitterLowpassAlpha={0.06} // keeps low-frequency camera motion (large pans) intact
          jitterCompStrength={1.0} // cancel the high-frequency part fully
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
            dir: [-1.0, -0.9],
            driftSpeed: 0.018,
            wobbleFreq: 0.01,
            wobbleMag: 0.02,
            dissolveScale: 3.8,
            dissolveSpeed: 0.03,
            dissolveWidth: 0.11
          }}
        />
      </e.group>  

       <e.group theatreKey='Cloud-front-New' position={[0, 0, 1]}>
        <CloudFloatingNew
          numPlanes={30}
          opacity={0.5}
          color1='#8d8093'
          color2='#ffffff'
          speed={0.5}
          xSpread={700}
          ySpread={70}
          zSpread={200}
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
            driftSpeed: 0.058,
            wobbleFreq: 0.02,
            wobbleMag: 0.12,
            dissolveScale: 3.8,
            dissolveSpeed: 0.03,
            dissolveWidth: 0.11
          }}
        />
      </e.group>

      <e.group theatreKey='sea-cloud-1' position={[0, 0, 1]}>
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
      </e.group>

      <e.group theatreKey='CloudeGradiantShader'>
        <CloudeGradiantShader />
      </e.group>    

      <e.group theatreKey='ProductShowcase'>
        <Product scale={30} />
      </e.group>

 <e.group theatreKey='RockStone'>
    <HeroRock/>
      </e.group>

      <e.group theatreKey='TextBoxUnderWater-1' position={[0, 0, 1]}>
        <TextBoxUnderWater
          startAt={140} // এই কম্পোনেন্ট 30s এ শুরু করবে
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
        />
      </e.group>

      <e.group theatreKey='TextBoxUnderWater-2' position={[0, 0, 1]}>
        <TextBoxUnderWater
          startAt={140} // এই কম্পোনেন্ট 30s এ শুরু করবে
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
        />
      </e.group>

      <e.group theatreKey='UnderwaterSleeve' position={[0, 0, 1]}>
        <UnderwaterSleeve />
      </e.group>

      <e.mesh
        rotation={[0, 0, Math.PI / 4]}
        theatreKey='ShaderSingleBeam_C'
        position={[-607, -23, 1368]}
      >
        <ShaderSingleBeam
          position={[30, -310, -380]}
          rotation={[THREE.MathUtils.degToRad(-6), 0, 2.5]}
          seedOffset={100}
        />
      </e.mesh>
      <hemisphereLight args={['#cfe7ff', '#6b4f5f', 0.35]} />
      <directionalLight position={[30, 40, 10]} intensity={0.25} />

      <ambientLight intensity={1} />
      <e.group theatreKey='under-water-maoutain-side' position={[0, 0, 1]}>
        <UnderWaterMountainSide scale={20} />
      </e.group>
      <e.group theatreKey='UnderWaterMountainSide-Big' position={[0, 0, 1]}>
        <UnderWaterMountainSideBig scale={20} />
      </e.group>



    </group>
  )
}
