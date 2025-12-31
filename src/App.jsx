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

/* =========================================================
   DEVICE CHECK
   ========================================================= */
const isMobile =
  typeof window !== 'undefined' &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

const ENABLE_LEVA = !isMobile && process.env.NODE_ENV !== 'production'
const ENABLE_STUDIO = process.env.NODE_ENV !== 'production'

/* =========================================================
   THEATRE PROJECT — DEVICE ISOLATED
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
   SHEET PROVIDER (SAFE REBIND)
   ========================================================= */
function SheetBinder ({ children }) {
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
function TimelineBootstrap () {
  const registry = useRegistry()

  useEffect(() => {
    const sheet = window.__THEATRE_SHEET__ || null
    if (sheet) registerSheetTimelines(registry, sheet)
    else registerSimulatedTheatre(registry)
  }, [registry])

  return null
}

/* =========================================================
   SCENE (ALL 3D LIVES HERE)
   ========================================================= */
function Scene () {
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
        <Enveremnt />
      </Suspense>
    </>
  )
}

/* =========================================================
   MAIN APP
   ========================================================= */
export default function App () {
  /* ---- mobile URL bar fix ---- */
  useEffect(() => {
    window.scrollTo(0, 1)

    const setVH = () => {
      const h = window.visualViewport
        ? window.visualViewport.height
        : window.innerHeight
      document.documentElement.style.setProperty('--app-height', `${h}px`)
    }

    setVH()
    window.visualViewport?.addEventListener('resize', setVH)
    window.addEventListener('orientationchange', setVH)

    return () => {
      window.visualViewport?.removeEventListener('resize', setVH)
      window.removeEventListener('orientationchange', setVH)
    }
  }, [])

  /* ---- disable browser scroll restore ---- */
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
    window.scrollTo(0, 0)
  }, [])

  return (
    <Provider store={store}>
      <RegistryProvider>
        {/* ================= GLOBAL UI LAYERS ================= */}

        {/* ✅ FADE MUST BE ABOVE CANVAS */}
        <TimelineWhiteFade triggerAtSec={300} fadeDuration={1.2} />

        {ENABLE_LEVA && (
          <Leva
            collapsed={false}
            oneLineLabels
            theme={{ sizes: { rootWidth: '340px' } }}
          />
        )}

        {ENABLE_STUDIO && <StudioManager />}

        <TimelineBootstrap />
        <ScrollMapper pxPerSec={isMobile ? 2 : 3} />

        {/* ================= ENV GATE ================= */}
        <EnvironmentGateProvider>
          <LoaderOverlay />
          <GsapOverlay />

          {/* ================= CANVAS ================= */}
          <Canvas
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 0 // 🔥 REQUIRED FOR FADE VISIBILITY
            }}
            gl={{ antialias: true }}
            dpr={[1, 2]}
          >
            <SheetBinder>
              <Scene />
            </SheetBinder>
          </Canvas>
        </EnvironmentGateProvider>

        {!isMobile && <DebugScrubber />}
      </RegistryProvider>
    </Provider>
  )
}
