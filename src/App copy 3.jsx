// src/App.jsx
import React, { useEffect, useState, Suspense } from 'react'
import { Provider } from 'react-redux'
import { Canvas } from '@react-three/fiber'
import { SheetProvider } from '@theatre/r3f'
import { PerspectiveCamera as TheatrePerspectiveCamera } from '@theatre/r3f'
import { getProject } from '@theatre/core'
import { Leva } from 'leva'

import Enveremnt from './Enveremnt.jsx'
import theatreStateDesktop from './assets/theatreState.json'
import theatreStateMobile from './assets/theatreState.mobile.json'
import { store } from './store/store'
import {
  RegistryProvider,
  useRegistry
} from './registry/TimelineRegistryContext'
import CameraRig from './components/CameraRig'
import ScrollMapper from './components/ScrollMapper'
import DebugScrubber from './components/DebugScrubber'
import WaterScene from './components/WaterScene'
import StudioManager from './StudioManager'
import { registerSimulatedTheatre } from './theatre/bootstrapRegisterSimulated'
import { registerSheetTimelines } from './theatre/autoRegisterSheet'
import GsapOverlay from './GsapOverlay.jsx'
import TimelineWhiteFade from './components/TimelineWhiteFade'
import { EnvironmentGateProvider } from './loader/EnvironmentGate.jsx'
import LoaderOverlay from './components/LoaderOverlay.jsx'
import RockTextureUI from './ui/RockTextureUI'

/* =========================================================
   DEVICE CHECK
========================================================= */
const isMobile =
  typeof window !== 'undefined' &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

const ENABLE_LEVA = !isMobile && process.env.NODE_ENV !== 'production'
const ENABLE_STUDIO = process.env.NODE_ENV !== 'production'

/* =========================================================
   THEATRE PROJECT
========================================================= */
if (typeof window !== 'undefined') {
  const deviceState = isMobile ? theatreStateMobile : theatreStateDesktop
  const projectKey = isMobile ? 'myProject-mobile' : 'myProject-desktop'

  const stateToLoad =
    process.env.NODE_ENV === 'production'
      ? deviceState
      : window.__THEATRE_REMOTE_STATE__ || deviceState

  const project = getProject(projectKey, { state: stateToLoad })
  const sheet = project.sheet('Scene')

  window.__THEATRE_PROJECT__ = project
  window.__THEATRE_SHEET__ = sheet
}

/* =========================================================
   SHEET PROVIDER
========================================================= */
function SheetBinder({ children }) {
  const [sheet, setSheet] = useState(() => window.__THEATRE_SHEET__ || null)

  useEffect(() => {
    const id = setInterval(() => {
      if (window.__THEATRE_SHEET__ && window.__THEATRE_SHEET__ !== sheet) {
        setSheet(window.__THEATRE_SHEET__)
      }
    }, 200)
    return () => clearInterval(id)
  }, [sheet])

  if (!sheet) return children
  return <SheetProvider sheet={sheet}>{children}</SheetProvider>
}

/* =========================================================
   TIMELINE BOOTSTRAP
========================================================= */
function TimelineBootstrap() {
  const registry = useRegistry()

  useEffect(() => {
    const sheet = window.__THEATRE_SHEET__ || null
    if (sheet) registerSheetTimelines(registry, sheet)
    else registerSimulatedTheatre(registry)
  }, [registry])

  return null
}

/* =========================================================
   SCENE
========================================================= */
function Scene({ rockTexture, onRockClick }) {
  return (
    <>
      <TheatrePerspectiveCamera
        theatreKey='Camera'
        makeDefault
        fov={50}
        near={0.1}
        far={6000}
      />

      <CameraRig />
      <WaterScene />

      <Suspense fallback={null}>
        <Enveremnt
          rockTexture={rockTexture}
          onRockClick={onRockClick}
        />
      </Suspense>
    </>
  )
}

/* =========================================================
   MAIN APP
========================================================= */
export default function App() {
  // ✅ GLOBAL STATE (IMPORTANT)
  const [rockTexture, setRockTexture] = useState('/textures/rock-1.jpg')
  const [showRockUI, setShowRockUI] = useState(false)

  /* ---- mobile URL bar fix ---- */
  useEffect(() => {
    window.scrollTo(0, 1)
  }, [])

  return (
    <Provider store={store}>
      <RegistryProvider>

        <TimelineWhiteFade triggerAtSec={300} fadeDuration={1.2} />

        {ENABLE_LEVA && <Leva collapsed={false} />}
        {ENABLE_STUDIO && <StudioManager />}

        <TimelineBootstrap />
        <ScrollMapper pxPerSec={isMobile ? 2 : 3} />

        <EnvironmentGateProvider>
          <LoaderOverlay />
          <GsapOverlay />

          <Canvas
            style={{ position: 'fixed', inset: 0, zIndex: 0 }}
            gl={{ antialias: true }}
            dpr={[1, 2]}
          >
            <SheetBinder>
              <Scene
                rockTexture={rockTexture}
                onRockClick={() => setShowRockUI(true)}
              />
            </SheetBinder>
          </Canvas>
        </EnvironmentGateProvider>

        {/* ✅ UI OVERLAY (Canvas-এর বাইরে) */}
        {showRockUI && (
          <RockTextureUI
            onSelect={(tex) => {
              setRockTexture(tex)
              setShowRockUI(false)
            }}
          />
        )}

        {!isMobile && <DebugScrubber />}
      </RegistryProvider>
    </Provider>
  )
}
