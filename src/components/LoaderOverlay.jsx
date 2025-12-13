// src/components/LoaderOverlay.jsx
import React, { useEffect } from 'react';
import { Html, useProgress } from '@react-three/drei';

/**
 * LoaderOverlay
 * - drei.useProgress() থেকে progress/loaded/total নেয়
 * - total>0 && loaded>=total || progress>=100 হলে window.__THEATRE_ENV_READY__ = true
 * - Canvas-এর ভেতরে mount করো যাতে drei loader গুলো সব asset track করে
 */
export default function LoaderOverlay({ showOverlay = true }) {
  const { active, progress, loaded, total, item, errors } = useProgress();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ready = (total > 0 && loaded >= total) || progress >= 100;
    // important: explicitly set boolean
    window.__THEATRE_ENV_READY__ = !!ready;
  }, [loaded, total, progress]);

  if (!showOverlay) return null;

  return (
    <Html center style={{ pointerEvents: 'none' }}>
      <div style={{
        pointerEvents: 'none',
        fontFamily: 'Inter, Roboto, system-ui, sans-serif',
        background: 'rgba(0,0,0,0.48)',
        padding: '10px 14px',
        borderRadius: 8,
        color: 'white',
        minWidth: 140,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 12, opacity: 0.9 }}>Loading scene</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{Math.round(progress)}%</div>
        <div style={{ fontSize: 11, opacity: 0.8 }}>{loaded}/{total} assets</div>
      </div>
    </Html>
  );
}
