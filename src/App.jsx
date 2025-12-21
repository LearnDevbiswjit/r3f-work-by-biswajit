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
import { RegistryProvider, useRegistry } from './registry/TimelineRegistryContext'
import CameraRig from './components/CameraRig'
import CameraSwitcher from './components/CameraSwitcher'
import ScrollMapper from './components/ScrollMapper'
import DebugScrubber from './components/DebugScrubber'
import WaterScene from './components/WaterScene'
import StudioManager from './StudioManager'
import { registerSimulatedTheatre } from './theatre/bootstrapRegisterSimulated'
import { registerSheetTimelines } from './theatre/autoRegisterSheet'
import * as THREE from 'three'
import GsapOverlay from './GsapOverlay.jsx'
import TimelineWhiteFade from './components/TimelineWhiteFade'
 
import { EnvironmentGateProvider } from './loader/EnvironmentGate.jsx'
import LoaderOverlay from './components/LoaderOverlay.jsx'


/* =========================================================
   DEVICE + ASSET HELPERS (🆕 SAFE ADD)
   ========================================================= */
const isMobile =
  typeof window !== 'undefined' &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

const ASSET_BASE = isMobile ? 'mobile' : 'desktop'

// 🎆 HERO FIRST
function preloadHeroStone() {
  useGLTF.preload(`/models/${ASSET_BASE}/Rock-Product.glb`)
}

// 🌍 REST (idle)
function preloadEnvironmentAssets() {
  useGLTF.preload(`/models/${ASSET_BASE}/Cloud.glb`)
  fetch('/hdr/ocean.hdr')
}

/* =========================================================
   LEVA / STUDIO
   ========================================================= */
const ENABLE_LEVA = !isMobile && process.env.NODE_ENV !== 'production'
const ENABLE_STUDIO = process.env.NODE_ENV !== 'production'

/* =========================================================
   THEATRE PROJECT
   ========================================================= */
let initialProject = null
let initialSheet = null
if (typeof window !== 'undefined') {
  try {
    const stateToLoad =
      window.__THEATRE_REMOTE_STATE__ || theatreStateBundled || null
    if (stateToLoad)
      initialProject = getProject('myProject', { state: stateToLoad })
    else initialProject = getProject('myProject')
    initialSheet = initialProject.sheet('Scene')
    window.__THEATRE_PROJECT__ = window.__THEATRE_PROJECT__ || initialProject
    window.__THEATRE_SHEET__ = window.__THEATRE_SHEET__ || initialSheet
  } catch (e) {}
}

/* =========================================================
   SHEET BINDER (UNCHANGED)
   ========================================================= */
function SheetBinder({ children }) {
  const [sheet, setSheet] = useState(() =>
    typeof window !== 'undefined' ? window.__THEATRE_SHEET__ || null : null
  )

  useEffect(() => {
    let mounted = true
    const sync = () => {
      if (!mounted) return
      if (
        typeof window !== 'undefined' &&
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

  const providerSheet =
    sheet ||
    (typeof window !== 'undefined'
      ? window.__THEATRE_SHEET__ || initialSheet
      : initialSheet)

  if (!providerSheet) return children
  return <SheetProvider sheet={providerSheet}>{children}</SheetProvider>
}

/* =========================================================
   HELPERS (UNCHANGED)
   ========================================================= */
function extractCameraFromState(state) {
  if (!state || typeof state !== 'object') return null
  if (state.camera?.position && state.camera?.quaternion)
    return { pos: state.camera.position, quat: state.camera.quaternion }
  try {
    const sb = state.sheetsById
    if (sb) {
      for (const sid in sb) {
        const so = sb[sid]?.staticOverrides
        if (so?.byObject?.Camera?.transform) {
          const t = so.byObject.Camera.transform
          return { pos: t.position, quat: t.quaternion }
        }
      }
    }
  } catch (e) {}
  return null
}

/* =========================================================
   TIMELINE BOOTSTRAP (UNCHANGED)
   ========================================================= */
function TimelineBootstrap() {
  const registry = useRegistry()

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (cancelled) return
      const sheet = window.__THEATRE_SHEET__ || null
      const state =
        window.__THEATRE_REMOTE_STATE__ || theatreStateBundled || null

      const cam = extractCameraFromState(state)
      if (cam) window.__THEATRE_STATIC_CAMERA__ = cam

      const st = store.getState()
      const durations =
        st?.timeline?.durations || state?.timeline?.durations

      if (sheet) registerSheetTimelines(registry, sheet, durations)
      else registerSimulatedTheatre(registry, state)
    }

    run()
    const id = setInterval(run, 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [registry])

  return null
}

/* =========================================================
   LOADING OVERLAY (UNCHANGED)
   ========================================================= */
// function LoadingOverlay() {
//   const [progress, setProgress] = useState(0)
//   const [visible, setVisible] = useState(true)
//   const [removed, setRemoved] = useState(false)
//   const fadeMs = 520

//   useEffect(() => {
//     const mgr = THREE.DefaultLoadingManager

//     const beginHide = () => {
//       setProgress(100)
//       window.dispatchEvent(new Event('APP_LOADER_DONE'))
//       setTimeout(() => {
//         setVisible(false)
//         setTimeout(() => setRemoved(true), fadeMs + 40)
//       }, 18)
//     }

//     mgr.onProgress = (_, l, t) =>
//       setProgress(t > 0 ? Math.round((l / t) * 100) : 0)

//     mgr.onLoad = () => setTimeout(beginHide, 80)

//     if (mgr.itemsLoaded === mgr.itemsTotal && mgr.itemsTotal > 0)
//       setTimeout(beginHide, 40)

//     return () => {
//       mgr.onProgress = null
//       mgr.onLoad = null
//     }
//   }, [])

//   if (removed) return null

//   return (
//     <div
//       style={{
//         position: 'fixed',
//         inset: 0,
//         zIndex: 999999,
//         background: '#3c3c3c',
//         display: 'flex',
//         alignItems: 'center',
//         justifyContent: 'center',
//         opacity: visible ? 1 : 0,
//         transition: `opacity ${fadeMs}ms`
//       }}
//     >
//       <div style={{ color: '#fff' }}>{progress}%</div>
//     </div>
//   )
// }

/* =========================================================
   MAIN APP
   ========================================================= */
export default function App() {
  // scroll reset
  useEffect(() => {
    window.history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
  }, [])

  // 🎆 PRELOAD STRATEGY (NEW, SAFE)
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

    {/* ALWAYS ACTIVE */}
    <TimelineBootstrap />
    <ScrollMapper pxPerSec={5} />

    {/* GSAP & Fade MUST be outside loader gate */}
    <GsapOverlay />
    <TimelineWhiteFade triggerAtSec={540} fadeDuration={1.2} />

    {/* LOADER ONLY GATES SCENE */}
    <EnvironmentGateProvider>
      <LoaderOverlay />

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
