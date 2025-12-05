import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { Canvas } from '@react-three/fiber';
import { SheetProvider } from '@theatre/r3f';
import { getProject } from '@theatre/core';
import { Leva } from 'leva';
 

import { store } from './store/store';
import { RegistryProvider, useRegistry } from './registry/TimelineRegistryContext';
import CameraRig from './components/CameraRig';
import CameraSwitcher from './components/CameraSwitcher';
import ScrollMapper from './components/ScrollMapper';
import DebugScrubber from './components/DebugScrubber';
import WaterScene from './component/WaterScene';

import StudioManager from './StudioManager';
import { registerSimulatedTheatre } from './theatre/bootstrapRegisterSimulated';
import { registerSheetTimelines } from './theatre/autoRegisterSheet';

// ensure minimal theatre sheet early for @theatre/r3f
let initialProject = null;
let initialSheet = null;
if (typeof window !== 'undefined') {
  try {
    initialProject = getProject('myProject');
    initialSheet = initialProject.sheet('Scene');
    window.__THEATRE_PROJECT__ = window.__THEATRE_PROJECT__ || initialProject;
    window.__THEATRE_SHEET__ = window.__THEATRE_SHEET__ || initialSheet;
    console.info('[App] initial Theatre project+sheet ensured');
  } catch (e) {
    console.warn('[App] could not create initial Theatre project/sheet:', e?.message || e);
  }
}

// SheetBinder: keeps SheetProvider stable when sheet becomes available
function SheetBinder({ children }) {
  const [sheet, setSheet] = useState(() => {
    return typeof window !== 'undefined' ? window.__THEATRE_SHEET__ || null : null;
  });

  useEffect(() => {
    let mounted = true;
    function sync() {
      if (!mounted) return;
      if (typeof window !== 'undefined' && window.__THEATRE_SHEET__ && window.__THEATRE_SHEET__ !== sheet) {
        setSheet(window.__THEATRE_SHEET__);
      }
    }
    const id = setInterval(sync, 200);
    sync();
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [sheet]);

  const providerSheet = sheet || (typeof window !== 'undefined' ? window.__THEATRE_SHEET__ || initialSheet : initialSheet);
  if (!providerSheet) return children;
  return <SheetProvider sheet={providerSheet}>{children}</SheetProvider>;
}

// TimelineBootstrap: registers timelines (or simulated fallback)
function TimelineBootstrap() {
  const registry = useRegistry();

  useEffect(() => {
    let cancelled = false;

    async function tryRegister() {
      const sheet = typeof window !== 'undefined' ? window.__THEATRE_SHEET__ : null;

      // Try to load public/theatreState.json if available (used in production)
      let remoteState = null;
      try {
        const res = await fetch('/theatreState.json', { cache: 'no-cache' });
        if (res.ok) {
          remoteState = await res.json();
          console.info('[TimelineBootstrap] loaded theatreState.json');
        }
      } catch (err) {
        // ignore fetch errors
      }

      const st = store.getState();
      const durationsFromStore = (st && st.timeline && st.timeline.durations) ? st.timeline.durations : null;

      if (sheet) {
        registerSheetTimelines(registry, sheet, durationsFromStore || (remoteState && remoteState.durations) || { theatreA: 20*60, helix: 20*60, theatreB: 30*60 });
      } else if (remoteState) {
        // Pass remoteState to simulated register so app gets durations/camera initial values
        registerSimulatedTheatre(registry, remoteState);
      } else {
        registerSimulatedTheatre(registry, { durations: durationsFromStore || { theatreA: 20*60, helix: 20*60, theatreB: 30*60 }});
      }
    }

    tryRegister();
    const id = setInterval(tryRegister, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [registry]);

  return null;
}

export default function App() {
  // Ensure Leva UI above Canvas (useful with Tailwind)
  useEffect(() => {
    const id = 'app-leva-fix';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.innerHTML = `
      .leva-ui { position: fixed !important; top: 12px !important; left: 12px !important; z-index: 999999 !important; pointer-events: auto !important; }
      canvas { z-index: 0 !important; }
      body, #root { overflow: visible !important; }
    `;
    document.head.appendChild(style);
  }, []);

  // Production: preload theatreState.json and write camera/durations fallback globals (so CameraRig can apply them on mount)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV === 'production') {
      fetch('/theatreState.json', { cache: 'no-cache' })
        .then(res => {
          if (!res.ok) throw new Error('no theatreState.json');
          return res.json();
        })
        .then(state => {
          // expose parsed json for CameraRig / Registry fallback
          window.__THEATRE_REMOTE_STATE__ = state;

          // optional: extract durations top-level
          if (state && state.durations) {
            window.__THEATRE_REMOTE_DURATIONS__ = state.durations;
          } else if (state && state.timeline && state.timeline.durations) {
            window.__THEATRE_REMOTE_DURATIONS__ = state.timeline.durations;
          }

          // optional: try to extract camera initial transform if exported in your json
          // multiple theatre export shapes exist; adapt to your export format
          try {
            // Attempt common export shapes: state.camera or state.cameraInitial
            const cam = state.camera || state.cameraInitial || (state.theatre && state.theatre.camera) || null;
            if (cam && cam.position && cam.quaternion) {
              window.__THEATRE_STATIC_CAMERA__ = {
                pos: cam.position,
                quat: cam.quaternion
              };
            } else {
              // look for nested sheets->objects structure (some exports have nested sheets)
              // try to locate first Camera object with position/quaternion
              const maybeCam = findCameraInExport(state);
              if (maybeCam) window.__THEATRE_STATIC_CAMERA__ = maybeCam;
            }
          } catch (e) {
            // ignore - CameraRig will handle absence
          }
        })
        .catch(() => {
          // no JSON or parse failed - fine, fallbacks will use default durations
        });
    }
  }, []);

  // helper to scan common export shapes for a camera transform
  // (keeps simple and defensive)
  function findCameraInExport(state) {
    if (!state || typeof state !== 'object') return null;
    // check common spots
    if (state.sheetsById) {
      for (const sid in state.sheetsById) {
        const sheet = state.sheetsById[sid];
        if (!sheet) continue;
        // many exports put objects under "objects" / "byId"
        if (sheet.objects) {
          for (const id in sheet.objects) {
            const obj = sheet.objects[id];
            if (obj && obj.name && /camera/i.test(obj.name) && obj.static && obj.static.position && obj.static.quaternion) {
              return { pos: obj.static.position, quat: obj.static.quaternion };
            }
          }
        }
      }
    }
    // fallback: look for top-level camera-like keys
    if (state.camera && state.camera.position && state.camera.quaternion) {
      return { pos: state.camera.position, quat: state.camera.quaternion };
    }
    return null;
  }

  return (
    <Provider store={store}>
      <RegistryProvider>
        {/* Leva root (keep outside Canvas) */}
        <Leva collapsed={false} />

        {/* Render StudioManager only in non-production so editor stays off in Netlify builds */}
        {process.env.NODE_ENV !== 'production' && <StudioManager />}

        <TimelineBootstrap />
        <ScrollMapper pxPerSec={5} />

        <Canvas style={{ position: 'fixed', inset: 0 }}>
          <SheetBinder>
            <CameraSwitcher theatreKey="Camera" />
            <CameraRig />
            <WaterScene />
          </SheetBinder>
        </Canvas>

        <DebugScrubber />
      </RegistryProvider>
    </Provider>
  );
}
