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
import * as THREE from 'three'
import GsapOverlay from './GsapOverlay.jsx'
import TimelineWhiteFade from './components/TimelineWhiteFade'

// ---------- Leva / Studio toggles ----------
const isMobile =
  typeof window !== 'undefined' &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

const ENABLE_LEVA = !isMobile && process.env.NODE_ENV !== 'production'
const ENABLE_STUDIO = !isMobile && process.env.NODE_ENV !== 'production'

// ---------- Ensure Theatre project/sheet ----------
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

// ---------- Sheet Binder ----------
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

// ---------- Helpers ----------
function extractCameraFromState(state) {
  if (!state || typeof state !== 'object') return null
  if (state.camera?.position && state.camera?.quaternion)
    return { pos: state.camera.position, quat: state.camera.quaternion }
  if (state.timeline?.camera?.position && state.timeline?.camera?.quaternion)
    return {
      pos: state.timeline.camera.position,
      quat: state.timeline.camera.quaternion
    }
  try {
    const sb = state.sheetsById
    if (sb && typeof sb === 'object') {
      for (const sid in sb) {
        const sheet = sb[sid]
        const so =
          sheet?.staticOverrides || sheet?.static || sheet?.staticValues || null
        if (so?.byObject?.Camera) {
          const camObj = so.byObject.Camera
          if (camObj?.transform?.position && camObj?.transform?.quaternion) {
            return {
              pos: camObj.transform.position,
              quat: camObj.transform.quaternion
            }
          }
        }
      }
    }
  } catch (e) {}
  return null
}

// ---------- Timeline Bootstrap ----------
function TimelineBootstrap() {
  const registry = useRegistry()

  useEffect(() => {
    let cancelled = false
    async function tryRegister() {
      if (cancelled) return
      const sheet =
        typeof window !== 'undefined' ? window.__THEATRE_SHEET__ : null

      let remoteState = null
      try {
        const res = await fetch('/theatreState.json', { cache: 'no-cache' })
        if (res.ok) remoteState = await res.json()
      } catch (e) {}

      if (!remoteState)
        remoteState =
          window.__THEATRE_REMOTE_STATE__ || theatreStateBundled || null

      if (remoteState) {
        const cam = extractCameraFromState(remoteState)
        if (cam) {
          window.__THEATRE_REMOTE_STATE__ = remoteState
          window.__THEATRE_STATIC_CAMERA__ = cam
          window.__THEATRE_B_START_CAMERA__ =
            window.__THEATRE_B_START_CAMERA__ || cam
        } else {
          window.__THEATRE_REMOTE_STATE__ = remoteState
        }
      }

      const st = store.getState()
      const finalDur =
        st?.timeline?.durations ||
        remoteState?.durations ||
        remoteState?.timeline?.durations || {
          theatreA: 20 * 60,
          helix: 20 * 60,
          theatreB: 30 * 60
        }

      if (sheet) registerSheetTimelines(registry, sheet, finalDur)
      else if (remoteState) registerSimulatedTheatre(registry, remoteState)
      else registerSimulatedTheatre(registry, { durations: finalDur })
    }

    tryRegister()
    const id = setInterval(tryRegister, 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [registry])

  return null
}

// ---------- Loading Overlay ----------
// --- inside LoadingOverlay() ---

function LoadingOverlay() {
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(true)
  const [removed, setRemoved] = useState(false)
  const fadeMs = 520

  useEffect(() => {
    const mgr = THREE.DefaultLoadingManager

    const beginHide = () => {
      setProgress(100)

      // 🔥 REQUIRED FOR GSAP OVERLAY
      window.dispatchEvent(new Event('APP_LOADER_DONE'))

      setTimeout(() => {
        setVisible(false)
        setTimeout(() => setRemoved(true), fadeMs + 40)
      }, 18)
    }

    mgr.onProgress = (_, l, t) =>
      setProgress(t > 0 ? Math.round((l / t) * 100) : 0)

    mgr.onLoad = () => setTimeout(beginHide, 80)

    if (mgr.itemsLoaded === mgr.itemsTotal && mgr.itemsTotal > 0)
      setTimeout(beginHide, 40)

    return () => {
      mgr.onProgress = null
      mgr.onLoad = null
    }
  }, [])

  if (removed) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: '#3c3c3c',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: visible ? 1 : 0,
        visibility: visible ? 'visible' : 'hidden',
        transition: `opacity ${fadeMs}ms, visibility ${fadeMs}ms`
      }}
    >
      <div style={{ color: '#fff' }}>{progress}%</div>
    </div>
  )
}


// ---------- MAIN ----------
export default function App() {
  useEffect(() => {
    if ('scrollRestoration' in window.history)
      window.history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && theatreStateBundled) {
      window.__THEATRE_REMOTE_STATE__ = theatreStateBundled
      const cam = extractCameraFromState(theatreStateBundled)
      if (cam) window.__THEATRE_STATIC_CAMERA__ = cam
    }
  }, [])

  return (
    <Provider store={store}>
      <RegistryProvider>
        {ENABLE_LEVA && <Leva collapsed={false} />}
        {ENABLE_STUDIO && <StudioManager />}
        <TimelineBootstrap />
        <ScrollMapper pxPerSec={5} />
        <LoadingOverlay />
        <GsapOverlay/>
        <TimelineWhiteFade
triggerAtSec={540}   // 8 minutes
  fadeDuration={1.2}
/>
        <Canvas style={{ position: 'fixed', inset: 0, top:0, bottom:0, }}>
          <SheetBinder>
            <CameraSwitcher theatreKey="Camera" />
            <CameraRig />
            <WaterScene />
            {/* <Suspense fallback={null}>
              <Enveremnt />
            </Suspense> */}
          </SheetBinder>
        </Canvas>
        {!isMobile && <DebugScrubber />}
      </RegistryProvider>
    </Provider>
  )
}
