
// src/components/CameraButtons.jsx
import React from 'react';
import { useDispatch } from 'react-redux';
import { requestForcedBlend } from '../redux/cameraSlice';

export default function CameraButtons() {
  const dispatch = useDispatch();

  const gotoHero = () => {
    dispatch(requestForcedBlend({
      id: `ui-${Date.now().toString(36)}`,
      toPos: [0, 4, 18],
      toQuat: [0, 0, 0, 1],
      durationMs: 500,
      meta: { source: 'ui' }
    }));
  };

  return (
    <div style={{ position: 'fixed', left: 12, top: 100, zIndex: 9999 }}>
      <button onClick={gotoHero} style={{ padding: '8px 12px' }}>Go Hero Cam</button>
    </div>
  );
}
