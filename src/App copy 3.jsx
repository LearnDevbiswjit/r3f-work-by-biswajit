// src/App.jsx
import React, { useEffect, useState, Suspense } from 'react'
import { Provider } from 'react-redux'
import { Canvas } from '@react-three/fiber'
import { SheetProvider } from '@theatre/r3f'
import { getProject } from '@theatre/core'
import { Leva } from 'leva'
import { useGLTF } from '@react-three/drei'

import Enveremnt from './Enveremnt.jsx'
import theatreStateBundled from './assets/theatreState.json'
import { store } from './store/store'
import {
  RegistryProvider,
  useRegistry
} from './registry/TimelineRegistryContext'

import CameraRig from './components/CameraRig'
import CameraSwitcher from './components/CameraSwitcher'
import ScrollMapper from './components/ScrollMapper'
import DebugScrubber from './components/DebugScrubber'
import WaterScene from './components/WaterScene'
import StudioManager from './StudioManager'
import GsapOverlay from './GsapOverlay.jsx'
import TimelineWhiteFade from './components/TimelineWhiteFade'

import { EnvironmentGateProvider } from './loader/EnvironmentGate.jsx'
import LoaderOverlay from './components/LoaderOverlay.jsx'
import CameraIntroController from './components/CameraIntroController'

import { registerSimulatedTheatre } from './theatre/bootstrapRegisterSimulated'
import { registerSheetTimelines } from './theatre/autoRegisterSheet'

/* =========================================================
   DEVICE
   ========================================================= */
const isMobile =
  typeof window !== 'undefined' &&
  window.matchMedia('(max-width: 768px)').matches

/* =========================================================
   ASSET PRELOAD (UNCHANGED)
   ========================================================= */
const ASSET_BASE = isMobile ? 'mobile' : 'desktop'

function preloadHeroStone () {
  useGLTF.preload(`/models/${ASSET_BASE}/Rock-Product-New-5.glb`)
}

function preloadEnvironmentAssets () {
  useGLTF.preload(`/models/${ASSET_BASE}/fish-blender.glb`)
  fetch('/hdr/ocean.hdr')
}

/* =========================================================
   LEVA / STUDIO (UNCHANGED BEHAVIOUR)
   ========================================================= */
const ENABLE_LEVA = !isMobile && import.meta.env.DEV
const ENABLE_STUDIO = import.meta.env.DEV

/* =========================================================
   THEATRE STATE LOADER (ADD-ON ONLY)
   ========================================================= */
function useResolvedTheatreState () {
  const [state, setState] = useState(null)

  useEffect(() => {
    let alive = true

    async function load () {
      // DEV → EXACT old behaviour
      if (!import.meta.env.PROD) {
        setState(theatreStateBundled)
        return
      }

      // PROD → mobile / desktop split
      const mobile = window.matchMedia('(max-width: 768px)').matches
      const loaded = mobile
        ? (await import('./assets/theatreState.mobile.json')).default
        : (await import('./assets/theatreState.desktop.json')).default

      if (alive) setState(loaded)
    }

    load()
    return () => {
      alive = false
    }
  }, [])

  return state
}

/* =========================================================
   THEATRE PROJECT (ORIGINAL FLOW PRESERVED)
   ========================================================= */
let initialProject = null
let initialSheet = null

if (typeof window !== 'undefined') {
  try {
    initialProject = getProject('myProject')
    initialSheet = initialProject.sheet('Scene')
    window.__THEATRE_PROJECT__ ||= initialProject
    window.__THEATRE_SHEET__ ||= initialSheet
  } catch {}
}

/* =========================================================
   SHEET BINDER (UNCHANGED)
   ========================================================= */
function SheetBinder ({ children }) {
  const [sheet, setSheet] = useState(() =>
    window.__THEATRE_SHEET__ || null
  )

  useEffect(() => {
    let mounted = true
    const sync = () => {
      if (!mounted) return
      if (
        window.__THEATRE_SHEET__ &&
        window.__THEATRE_SHEET__ !== sheet
      ) {
        setSheet(window.__THEATRE_SHEET__)
      }
    }
    const id = setInterval(sync, 200)
    sync()
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [sheet])

  const providerSheet = sheet || window.__THEATRE_SHEET__ || initialSheet
  if (!providerSheet) return children

  return <SheetProvider sheet={providerSheet}>{children}</SheetProvider>
}

/* =========================================================
   TIMELINE BOOTSTRAP (ORIGINAL LOGIC)
   ========================================================= */
function TimelineBootstrap ({ theatreState }) {
  const registry = useRegistry()

  useEffect(() => {
    if (!theatreState) return

    let cancelled = false

    function run () {
      if (cancelled) return

      const sheet = window.__THEATRE_SHEET__ || null
      const state =
        window.__THEATRE_REMOTE_STATE__ || theatreState || null

      const st = store.getState()
      const durations = st?.timeline?.durations || state?.timeline?.durations

      if (sheet) registerSheetTimelines(registry, sheet, durations)
      else registerSimulatedTheatre(registry, state)
    }

    run()
    const id = setInterval(run, 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [registry, theatreState])

  return null
}

/* =========================================================
   APP
   ========================================================= */
export default function App () {
  const theatreState = useResolvedTheatreState()

  // scroll reset
  useEffect(() => {
    window.history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
  }, [])

  // preload
  useEffect(() => {
    preloadHeroStone()
    if ('requestIdleCallback' in window) {
      requestIdleCallback(preloadEnvironmentAssets)
    } else {
      setTimeout(preloadEnvironmentAssets, 300)
    }
  }, [])

  return (
    <Provider store={store}>
      <RegistryProvider>
        {ENABLE_LEVA && <Leva />}
        {ENABLE_STUDIO && <StudioManager />}

        {theatreState && (
          <>
            <TimelineBootstrap theatreState={theatreState} />
            <ScrollMapper pxPerSec={5} />
            <TimelineWhiteFade triggerAtSec={540} fadeDuration={1.2} />

            <EnvironmentGateProvider>
              <LoaderOverlay />
              <GsapOverlay />

              <Canvas style={{ position: 'fixed', inset: 0, zIndex: 1 }}>
                <SheetBinder>
                  <CameraSwitcher theatreKey='Camera' />

                  <CameraIntroController
                    duration={4}
                    radius={1.8}
                    angleDeg={35}
                    heightOffset={0.25}
                  />

                  <CameraRig />
                  <WaterScene />

                  <Suspense fallback={null}>
                    <Enveremnt />
                  </Suspense>
                </SheetBinder>
              </Canvas>
            </EnvironmentGateProvider>

            {!isMobile && <DebugScrubber />}
          </>
        )}
      </RegistryProvider>
    </Provider>
  )
}
