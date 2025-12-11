// src/App.jsx
import React, { useEffect, useState, Suspense } from 'react'
import { Provider } from 'react-redux'
import { Canvas } from '@react-three/fiber'
import { SheetProvider } from '@theatre/r3f'
import { getProject } from '@theatre/core'
import { Leva } from 'leva'

import Enveremnt from './Enveremnt.jsx'
import theatreStateBundled from './assets/theatreState.json' // ensure exists
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
import { registerSimulatedTheatre } from './theatre/bootstrapRegisterSimulated'
import { registerSheetTimelines } from './theatre/autoRegisterSheet'

import * as THREE from 'three'

// ensure theatre project/sheet
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
    console.info(
      '[App] initial Theatre project+sheet ensured (state injected?)'
    )
  } catch (e) {
    console.warn(
      '[App] could not create initial Theatre project/sheet:',
      e?.message || e
    )
  }
}

// Sheet binder
function SheetBinder ({ children }) {
  const [sheet, setSheet] = useState(() =>
    typeof window !== 'undefined' ? window.__THEATRE_SHEET__ || null : null
  )

  useEffect(() => {
    let mounted = true
    function sync () {
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

// extractor helper (kept)
function extractCameraFromState (state) {
  if (!state || typeof state !== 'object') return null
  if (state.camera && state.camera.position && state.camera.quaternion)
    return { pos: state.camera.position, quat: state.camera.quaternion }
  if (
    state.timeline &&
    state.timeline.camera &&
    state.timeline.camera.position &&
    state.timeline.camera.quaternion
  )
    return {
      pos: state.timeline.camera.position,
      quat: state.timeline.camera.quaternion
    }

  try {
    const sb = state.sheetsById
    if (sb && typeof sb === 'object') {
      for (const sid in sb) {
        if (!Object.prototype.hasOwnProperty.call(sb, sid)) continue
        const sheet = sb[sid]
        if (!sheet) continue
        const so =
          sheet.staticOverrides || sheet.static || sheet.staticValues || null
        if (so && so.byObject && so.byObject.Camera) {
          const camObj = so.byObject.Camera
          if (
            camObj.transform &&
            camObj.transform.position &&
            camObj.transform.quaternion
          ) {
            return {
              pos: camObj.transform.position,
              quat: camObj.transform.quaternion
            }
          }
          if (camObj.position && camObj.quaternion) {
            return { pos: camObj.position, quat: camObj.quaternion }
          }
          if (
            camObj.transform &&
            camObj.transform.position &&
            camObj.transform.target
          ) {
            try {
              const p = new THREE.Vector3(
                camObj.transform.position.x,
                camObj.transform.position.y,
                camObj.transform.position.z
              )
              const t = new THREE.Vector3(
                camObj.transform.target.x,
                camObj.transform.target.y,
                camObj.transform.target.z
              )
              const m = new THREE.Matrix4()
              m.lookAt(p, t, new THREE.Vector3(0, 1, 0))
              const q = new THREE.Quaternion().setFromRotationMatrix(m)
              return {
                pos: camObj.transform.position,
                quat: { x: q.x, y: q.y, z: q.z, w: q.w }
              }
            } catch (e) {
              /* ignore */
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('[extractCameraFromState] parse error', e?.message || e)
  }

  try {
    const walker = o => {
      if (!o || typeof o !== 'object') return null
      if (o.position && o.quaternion)
        return { pos: o.position, quat: o.quaternion }
      for (const k in o) {
        if (!Object.prototype.hasOwnProperty.call(o, k)) continue
        const r = walker(o[k])
        if (r) return r
      }
      return null
    }
    return walker(state)
  } catch (e) {
    /* ignore */
  }

  return null
}

// Timeline bootstrap
function TimelineBootstrap () {
  const registry = useRegistry()

  useEffect(() => {
    let cancelled = false

    async function tryRegister () {
      if (cancelled) return
      const sheet =
        typeof window !== 'undefined' ? window.__THEATRE_SHEET__ : null

      let remoteState = null
      try {
        const res = await fetch('/theatreState.json', { cache: 'no-cache' })
        if (res.ok) {
          remoteState = await res.json()
          console.info('[TimelineBootstrap] fetched /theatreState.json')
        } else {
          console.info(
            '[TimelineBootstrap] /theatreState.json not served (status)',
            res.status
          )
        }
      } catch (err) {}

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
          if (remoteState.durations)
            window.__THEATRE_REMOTE_DURATIONS__ = remoteState.durations
          if (remoteState.timeline && remoteState.timeline.durations)
            window.__THEATRE_REMOTE_DURATIONS__ = remoteState.timeline.durations
        } else {
          window.__THEATRE_REMOTE_STATE__ = remoteState
        }
      }

      const st = store.getState()
      const durationsFromStore =
        st && st.timeline && st.timeline.durations
          ? st.timeline.durations
          : null
      const finalDur = durationsFromStore ||
        (remoteState &&
          (remoteState.durations ||
            (remoteState.timeline && remoteState.timeline.durations))) || {
          theatreA: 20 * 60,
          helix: 20 * 60,
          theatreB: 30 * 60
        }

      if (sheet) {
        registerSheetTimelines(registry, sheet, finalDur)
      } else if (remoteState) {
        registerSimulatedTheatre(registry, remoteState)
      } else {
        registerSimulatedTheatre(registry, { durations: finalDur })
      }
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

/* ---------------- Loading Overlay ----------------
   Small enhanced loader using THREE.DefaultLoadingManager.
*/
function LoadingOverlay () {
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(true)
  const [removed, setRemoved] = useState(false)
  const fadeMs = 520

  useEffect(() => {
    const mgr = THREE.DefaultLoadingManager

    function beginHide () {
      setProgress(100)
      setTimeout(() => {
        setVisible(false)
        setTimeout(() => setRemoved(true), fadeMs + 40)
      }, 18)
    }

    if (mgr.itemsTotal === 0 && mgr.itemsLoaded === 0) {
      setProgress(100)
      setTimeout(() => {
        setVisible(false)
        setTimeout(() => setRemoved(true), fadeMs + 40)
      }, 80)
      return
    }

    const onStart = (url, itemsLoaded, itemsTotal) => {
      const p =
        itemsTotal > 0 ? Math.round((itemsLoaded / itemsTotal) * 100) : 0
      setProgress(p)
      setVisible(true)
    }
    const onProgress = (url, itemsLoaded, itemsTotal) => {
      const p =
        itemsTotal > 0 ? Math.round((itemsLoaded / itemsTotal) * 100) : 0
      setProgress(p)
    }
    const onLoad = () => {
      setTimeout(beginHide, 80)
    }
    const onError = url => {
      console.warn('[LoadingOverlay] asset load error', url)
      setTimeout(beginHide, 220)
    }

    mgr.onStart = onStart
    mgr.onProgress = onProgress
    mgr.onLoad = onLoad
    mgr.onError = onError

    if (mgr.itemsLoaded === mgr.itemsTotal && mgr.itemsTotal > 0) {
      setTimeout(beginHide, 40)
    }

    return () => {
      try {
        if (mgr.onStart === onStart) mgr.onStart = null
      } catch (e) {}
      try {
        if (mgr.onProgress === onProgress) mgr.onProgress = null
      } catch (e) {}
      try {
        if (mgr.onLoad === onLoad) mgr.onLoad = null
      } catch (e) {}
      try {
        if (mgr.onError === onError) mgr.onError = null
      } catch (e) {}
    }
  }, [])

  if (removed) return null

  const r = 42
  const circumference = Math.PI * 2 * r
  const dash = Math.max(0, Math.min(1, progress / 100))
  const dashOffset = circumference * (1 - dash)

  return (
    <div
      role='status'
      aria-hidden={!visible}
      style={{
        pointerEvents: visible ? 'auto' : 'none',
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(60,60,60,1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: `opacity ${fadeMs}ms cubic-bezier(.2,.0,.0,1), visibility ${fadeMs}ms`,
        opacity: visible ? 1 : 0,
        visibility: visible ? 'visible' : 'hidden'
      }}
    >
      <div style={{ textAlign: 'center', userSelect: 'none' }}>
        <div
          style={{
            width: 120,
            height: 120,
            margin: '0 auto',
            position: 'relative'
          }}
        >
          <svg
            viewBox='0 0 100 100'
            style={{
              width: '100%',
              height: '100%',
              transform: 'rotate(-90deg)'
            }}
          >
            <circle
              cx='50'
              cy='50'
              r={r}
              stroke='#17004d'
              strokeWidth='6'
              fill='none'
              opacity='0.15'
            />
            <circle
              cx='50'
              cy='50'
              r={r}
              stroke='rgba(255,255,255,0.92)'
              strokeWidth='6'
              fill='none'
              strokeLinecap='round'
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 260ms linear' }}
            />
          </svg>

          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              fontFamily: 'Inter, Roboto, system-ui, sans-serif',
              color: '#fff'
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700 }}>{progress}%</div>
          </div>
        </div>

        <div style={{ marginTop: 14, color: '#ddd', fontSize: 13 }}>
          Loading scene — অনুগ্রহ করে অপেক্ষা করো...
        </div>
      </div>
    </div>
  )
}

// MAIN APP
export default function App () {
  useEffect(() => {
    const id = 'app-leva-fix'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.innerHTML = `
      .leva-ui { position: fixed !important; top: 12px !important; left: 12px !important; z-index: 999999 !important; pointer-events: auto !important; }
      canvas { z-index: 0 !important; display:block; }
      body, #root { overflow: visible !important; }
    `
    document.head.appendChild(style)
  }, [])

  // Reset scroll + theatre sequence on mount so every reload starts from top/zero
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      if ('scrollRestoration' in window.history)
        window.history.scrollRestoration = 'manual'
    } catch (e) {}
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0
    } catch (e) {}
    try {
      sessionStorage.removeItem('r3f_scroll_offset')
      localStorage.removeItem('r3f_scroll_offset')
    } catch (e) {}

    try {
      const sheet =
        window.__THEATRE_SHEET__ ||
        (window.__THEATRE_PROJECT__ &&
          window.__THEATRE_PROJECT__.sheet &&
          window.__THEATRE_PROJECT__.sheet('Scene'))
      if (sheet && sheet.sequence) {
        try {
          sheet.sequence.position = 0
        } catch (e) {}
        try {
          if (
            sheet.sequence.pointer &&
            typeof sheet.sequence.pointer.time === 'number'
          )
            sheet.sequence.pointer.time = 0
        } catch (e) {}
        try {
          sheet.sequence.pause && sheet.sequence.pause()
        } catch (e) {}
        setTimeout(() => {
          try {
            sheet.sequence.position = 0
          } catch (e) {}
          try {
            sheet.sequence.play && sheet.sequence.play()
          } catch (e) {}
        }, 50)
      }
    } catch (e) {
      console.warn('[App] reset theatre sheet failed', e)
    }

    const onBeforeUnload = () => {
      try {
        window.scrollTo(0, 0)
        if (document.scrollingElement) document.scrollingElement.scrollTop = 0
      } catch (e) {}
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('pagehide', onBeforeUnload)

    return () => {
      try {
        window.removeEventListener('beforeunload', onBeforeUnload)
      } catch (e) {}
      try {
        window.removeEventListener('pagehide', onBeforeUnload)
      } catch (e) {}
      try {
        if ('scrollRestoration' in window.history)
          window.history.scrollRestoration = 'auto'
      } catch (e) {}
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (process.env.NODE_ENV === 'production') {
      if (typeof theatreStateBundled !== 'undefined' && theatreStateBundled) {
        window.__THEATRE_REMOTE_STATE__ = theatreStateBundled
        const cam = extractCameraFromState(theatreStateBundled)
        if (cam) {
          window.__THEATRE_STATIC_CAMERA__ = cam
          window.__THEATRE_B_START_CAMERA__ =
            window.__THEATRE_B_START_CAMERA__ || cam
          if (theatreStateBundled.durations)
            window.__THEATRE_REMOTE_DURATIONS__ = theatreStateBundled.durations
          if (
            theatreStateBundled.timeline &&
            theatreStateBundled.timeline.durations
          )
            window.__THEATRE_REMOTE_DURATIONS__ =
              theatreStateBundled.timeline.durations
        } else {
          window.__THEATRE_REMOTE_STATE__ = theatreStateBundled
        }
        console.info('[App] applied bundled theatreState fallback (production)')
      }
    }
  }, [])

  return (
    <Provider store={store}>
      <RegistryProvider>
        <Leva collapsed={false} />
        {process.env.NODE_ENV !== 'production' && <StudioManager />}
        <TimelineBootstrap />
        <ScrollMapper pxPerSec={5} />
        <LoadingOverlay />
        <Canvas style={{ position: 'fixed', inset: 0 }}>
          <SheetBinder>
            <CameraSwitcher theatreKey='Camera' />
            <CameraRig />
            <WaterScene />
            <Suspense fallback={null}>
              <Enveremnt />
            </Suspense>
          </SheetBinder>
        </Canvas>
        <DebugScrubber />
      </RegistryProvider>
    </Provider>
  )
}
