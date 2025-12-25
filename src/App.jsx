// src/App.jsx
import React, { useEffect, useState, Suspense } from 'react'
import { Provider } from 'react-redux'
import { Canvas } from '@react-three/fiber'
import { SheetProvider } from '@theatre/r3f'
import { getProject } from '@theatre/core'
import { Leva } from 'leva'
 
import Enveremnt from './Enveremnt.jsx'
import theatreStateBundled from './assets/theatreState.json'
import { store } from './store/store'
import { RegistryProvider, useRegistry } from './registry/TimelineRegistryContext'
import CameraRig from './components/CameraRig'
import CameraSwitcher from './components/CameraSwitcher'
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

const isMobile =
  typeof window !== 'undefined' &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

const ENABLE_LEVA = !isMobile && process.env.NODE_ENV !== 'production'
const ENABLE_STUDIO = process.env.NODE_ENV !== 'production'

/* =========================================================
   THEATRE PROJECT (OFFICIAL DEFAULT BEHAVIOUR)
   ========================================================= */
/* =========================================================
   THEATRE PROJECT — SINGLE SOURCE OF TRUTH
   ========================================================= */
if (typeof window !== 'undefined' && !window.__THEATRE_PROJECT__) {
  const stateToLoad =
    process.env.NODE_ENV === 'production'
      ? theatreStateBundled
      : (window.__THEATRE_REMOTE_STATE__ || theatreStateBundled)

  const project = getProject('myProject', { state: stateToLoad })
  const sheet = project.sheet('Scene')

  window.__THEATRE_PROJECT__ = project
  window.__THEATRE_SHEET__ = sheet
}


/* =========================================================
   SHEET PROVIDER
   ========================================================= */
function SheetBinder({ children }) {
  const [sheet, setSheet] = useState(
    () => window.__THEATRE_SHEET__ || initialSheet
  )

  useEffect(() => {
    const id = setInterval(() => {
      if (
        window.__THEATRE_SHEET__ &&
        window.__THEATRE_SHEET__ !== sheet
      ) {
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
    const state =
      window.__THEATRE_REMOTE_STATE__ || theatreStateBundled || null

    if (sheet) registerSheetTimelines(registry, sheet)
    else registerSimulatedTheatre(registry, state)
  }, [registry])

  return null
}

/* =========================================================
   MAIN APP
   ========================================================= */
export default function App() {
  


   useEffect(() => {
    // disable browser scroll restoration
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }

    // force scroll to top
    window.scrollTo(0, 0)
  }, [])


  return (
    <Provider store={store}>
      <RegistryProvider>

        {ENABLE_LEVA && <Leva />}
        {ENABLE_STUDIO && <StudioManager />}

        <TimelineBootstrap />
        <ScrollMapper pxPerSec={5} />

        <TimelineWhiteFade triggerAtSec={540} fadeDuration={1.2} />

        <EnvironmentGateProvider>
          <LoaderOverlay />
          <GsapOverlay />

          <Canvas style={{ position: 'fixed', inset: 0 }}>
            <SheetBinder>
              <CameraSwitcher theatreKey="Camera" />
              <CameraRig />
              <WaterScene />
              <Suspense fallback={null}>
                <Enveremnt />
              </Suspense>
            </SheetBinder>
          </Canvas>
        </EnvironmentGateProvider>

        {!isMobile && <DebugScrubber />}

      </RegistryProvider>
    </Provider>
  )
}
