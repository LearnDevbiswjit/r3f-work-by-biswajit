// src/components/CameraInspector.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/*
  CameraInspector
  - shows live camera pos/quat
  - provides 4 slots (save / apply) — saved slots persist to window.__CAMERA_SLOTS__
  - shows current helix progress (if provided in window.__HELIX_PROGRESS__ or from redux via global)
  - visually updates as scroll/timeline changes
*/

function formatVec3(v) {
  if (!v) return '—';
  return `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`;
}
function formatQuat(q) {
  if (!q) return '—';
  return `${q.x.toFixed(3)}, ${q.y.toFixed(3)}, ${q.z.toFixed(3)}, ${q.w.toFixed(3)}`;
}

export default function CameraInspector({ registry }) {
  const { camera } = useThree();
  const rafRef = useRef(null);

  const [pos, setPos] = useState(new THREE.Vector3());
  const [quat, setQuat] = useState(new THREE.Quaternion());
  const [progress, setProgress] = useState(0);
  const [slots, setSlots] = useState(() => (typeof window !== 'undefined' && window.__CAMERA_SLOTS__) ? window.__CAMERA_SLOTS__ : [null, null, null, null]);
  const [liveSlotIndex, setLiveSlotIndex] = useState(0);

  // Keep window slots in sync
  useEffect(() => {
    if (typeof window !== 'undefined') window.__CAMERA_SLOTS__ = slots;
  }, [slots]);

  // animation loop to update live camera values
  useEffect(() => {
    function tick() {
      if (camera) {
        const p = camera.position;
        const q = camera.quaternion;
        setPos(p.clone());
        setQuat(q.clone());
      }
      // read global helix progress if present
      const helixProgress = (typeof window !== 'undefined' && typeof window.__HELIX_PROGRESS__ === 'number') ? window.__HELIX_PROGRESS__ : null;
      if (helixProgress !== null) setProgress(Math.round(helixProgress * 100) / 100);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [camera]);

  // helpers
  function saveToSlot(i) {
    const slot = {
      pos: { x: pos.x, y: pos.y, z: pos.z },
      quat: { x: quat.x, y: quat.y, z: quat.z, w: quat.w },
      savedAt: Date.now()
    };
    const copy = slots.slice();
    copy[i] = slot;
    setSlots(copy);
  }

  function applySlot(i) {
    const s = slots[i];
    if (!s) return;
    // prefer using registry helper smoothJumpToTransform if available
    if (registry && typeof registry.getCameraRef === 'function') {
      const camRef = registry.getCameraRef && registry.getCameraRef();
      // Many Registry implementations use setCameraRef earlier; we try common helper
    }
    if (typeof window !== 'undefined' && window.__CAMERA_SMOOTH_JUMP__) {
      try {
        window.__CAMERA_SMOOTH_JUMP__({ pos: new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z), quat: new THREE.Quaternion(s.quat.x, s.quat.y, s.quat.z, s.quat.w) });
        return;
      } catch (e) {}
    }

    // fallback: directly set active three camera
    try {
      camera.position.set(s.pos.x, s.pos.y, s.pos.z);
      camera.quaternion.set(s.quat.x, s.quat.y, s.quat.z, s.quat.w);
      camera.updateMatrixWorld();
    } catch (e) {
      console.warn('[CameraInspector] applySlot fallback failed', e);
    }
  }

  function clearSlot(i) {
    const copy = slots.slice();
    copy[i] = null;
    setSlots(copy);
  }

  // small UI styles
  const panelStyle = {
    position: 'fixed',
    right: 12,
    top: 12,
    width: 320,
    maxWidth: 'calc(100vw - 24px)',
    background: 'rgba(8,10,20,0.86)',
    color: '#dfe7ff',
    borderRadius: 10,
    padding: 12,
    fontFamily: 'Inter, Roboto, system-ui, sans-serif',
    zIndex: 200000,
    boxShadow: '0 8px 30px rgba(0,0,0,0.6)'
  };
  const small = { fontSize: 12, color: '#9fb0ff' };

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 700 }}>Camera Inspector</div>
        <div style={{ fontSize: 12, color: '#9fb0ff' }}>progress: <span style={{ fontWeight: 700 }}>{progress}</span></div>
      </div>

      <div style={{ fontSize: 13, marginBottom: 8 }}>
        <div style={small}>Pos</div>
        <div style={{ fontWeight: 600 }}>{formatVec3(pos)}</div>

        <div style={{ marginTop: 6 }}><div style={small}>Quat</div>
        <div style={{ fontWeight: 600 }}>{formatQuat(quat)}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <button
          onClick={() => { saveToSlot(liveSlotIndex); }}
          style={{ padding: '6px 10px', borderRadius: 6, background: '#2b6cff', color: '#fff', border: 'none', cursor: 'pointer' }}>
          Save to slot #{liveSlotIndex + 1}
        </button>

        <select value={liveSlotIndex} onChange={e => setLiveSlotIndex(Number(e.target.value))} style={{ padding: 6, borderRadius: 6 }}>
          <option value={0}>Slot 1</option>
          <option value={1}>Slot 2</option>
          <option value={2}>Slot 3</option>
          <option value={3}>Slot 4</option>
        </select>

        <button
          onClick={() => applySlot(liveSlotIndex)}
          style={{ padding: '6px 10px', borderRadius: 6, background: '#06c875', color: '#fff', border: 'none', cursor: 'pointer' }}>
          Jump → slot
        </button>
      </div>

      <div style={{ marginTop: 4 }}>
        {slots.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6, background: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 6 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#9fb0ff' }}>Slot {i + 1}</div>
              {s ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{formatVec3(s.pos)}</div>
                  <div style={{ fontSize: 11, color: '#9fb0ff' }}>saved {new Date(s.savedAt).toLocaleTimeString()}</div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: '#9fb0ff' }}>empty</div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={() => applySlot(i)} style={{ fontSize: 12, padding: '6px 8px', background: '#1f2937', color: '#fff', borderRadius: 6, border: 'none' }}>Apply</button>
              <button onClick={() => saveToSlot(i)} style={{ fontSize: 12, padding: '6px 8px', background: '#2b6cff', color: '#fff', borderRadius: 6, border: 'none' }}>Save</button>
              <button onClick={() => clearSlot(i)} style={{ fontSize: 11, padding: '4px 6px', background: '#7b1b1b', color: '#fff', borderRadius: 6, border: 'none' }}>Clear</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: '#9fb0ff' }}>
        Tip: Save camera while on helix, then apply after swap to theatre (keeps continuity).
      </div>
    </div>
  );
}
