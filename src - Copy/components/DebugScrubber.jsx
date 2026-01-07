// src/components/DebugScrubber.jsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setOverallProgress } from '../store/slices/timelineSlice';

const STORAGE_KEY = 'debugScrubberPos_v1';

export default function DebugScrubber() {
  const overall = useSelector(s => s.timeline.overallProgress);
  const phase = useSelector(s => s.timeline.phase);
  const durations = useSelector(s => s.timeline.durations);
  const dispatch = useDispatch();

  const onChange = (e) => {
    const v = parseFloat(e.target.value);
    dispatch(setOverallProgress(v));
  };

  // draggable position (persisted)
  const [pos, setPos] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.left === 'number' && typeof p.top === 'number') return p;
      }
    } catch (e) { /* ignore */ }
    // default top-right-ish
    return { left: Math.max(8, window.innerWidth - 300), top: 20 };
  });

  const containerRef = useRef(null);
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0, left: 0, top: 0 });

  // clamp helper
  const clampToViewport = useCallback((left, top) => {
    const w = containerRef.current?.offsetWidth || 280;
    const h = containerRef.current?.offsetHeight || 80;
    const minLeft = 8;
    const minTop = 8;
    const maxLeft = Math.max(8, window.innerWidth - w - 8);
    const maxTop = Math.max(8, window.innerHeight - h - 8);
    return {
      left: Math.min(Math.max(left, minLeft), maxLeft),
      top: Math.min(Math.max(top, minTop), maxTop)
    };
  }, []);

  // pointer handlers created once (stable refs)
  useEffect(() => {
    function onPointerMove(e) {
      if (!draggingRef.current) return;
      e.preventDefault();
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      const newLeft = startRef.current.left + dx;
      const newTop = startRef.current.top + dy;
      const clamped = clampToViewport(newLeft, newTop);
      setPos(clamped);
    }

    function onPointerUp(e) {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      // persist
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch (err) {}
      document.body.style.cursor = '';
      // remove listeners (we added them on pointerdown)
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    }

    // cleanup in case component unmounts while dragging
    return () => {
      draggingRef.current = false;
      document.body.style.cursor = '';
      try {
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
      } catch (e) {}
    };
    // pos not included because we persist pos on pointerup using current pos (closure uses pos from render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampToViewport]);

  // onPointerDown will attach global listeners immediately
  const onPointerDown = (e) => {
    // only left button (0) or touch (pointerType may be 'touch')
    if (e.button !== undefined && e.button !== 0) return;
    draggingRef.current = true;
    startRef.current = { x: e.clientX, y: e.clientY, left: pos.left, top: pos.top };

    // attach listeners (so we capture outside the handle element too)
    function onPointerMove(e2) {
      if (!draggingRef.current) return;
      e2.preventDefault();
      const dx = e2.clientX - startRef.current.x;
      const dy = e2.clientY - startRef.current.y;
      const newLeft = startRef.current.left + dx;
      const newTop = startRef.current.top + dy;
      const clamped = clampToViewport(newLeft, newTop);
      setPos(clamped);
    }

    function onPointerUp(e3) {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch (err) {}
      document.body.style.cursor = '';
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    }

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.body.style.cursor = 'grabbing';

    // pointer capture if available on target
    try { e.target.setPointerCapture?.(e.pointerId); } catch (err) {}
  };

  // double-click reset
  const onDoubleClick = () => {
    const defaultPos = { left: Math.max(8, window.innerWidth - 300), top: 20 };
    const clamped = clampToViewport(defaultPos.left, defaultPos.top);
    setPos(clamped);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped)); } catch (e) {}
  };

  // ensure position clamps on resize
  useEffect(() => {
    function onResize() {
      setPos(prev => clampToViewport(prev.left, prev.top));
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampToViewport]);

  const containerStyle = {
    position: 'fixed',
    left: pos.left,
    top: pos.top,
    zIndex: 999999,
    background: 'rgba(0,0,0,0.66)',
    color: '#fff',
    padding: 8,
    borderRadius: 8,
    fontFamily: 'sans-serif',
    width: 280,
    boxSizing: 'border-box',
    userSelect: 'none',
    touchAction: 'none'
  };

  const handleStyle = {
    height: 24,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'grab',
    marginBottom: 6,
    padding: '0 6px',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.03)',
    fontSize: 12
  };

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      role="group"
      aria-label="Debug scrubber (draggable)"
    >
      <div
        style={handleStyle}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        title="Drag to move. Double-click to reset."
      >
        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden style={{opacity:0.85}}>
          <path fill="white" d="M7 10h2v2H7zM11 10h2v2h-2zM15 10h2v2h-2zM7 14h2v2H7zM11 14h2v2h-2zM15 14h2v2h-2z" />
        </svg>
        <div style={{flex:1, color:'#fff', fontSize:13}}>Phase: {phase}</div>
        <div style={{fontSize:12, opacity:0.95}}>{(overall*100).toFixed(2)}%</div>
      </div>

      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.0001}
          value={overall}
          onChange={onChange}
          style={{width: '100%'}}
          aria-label="Overall progress scrubber"
        />
      </div>

      <div style={{fontSize:11, marginTop:6, color:'#ddd'}}>
        <div>Durations (s): A {durations.theatreA || 0}, H {durations.helix || 0}, B {durations.theatreB || 0}</div>
        <div style={{fontSize:10, opacity:0.85, marginTop:6}}>Drag header to reposition. Double-click header to reset.</div>
      </div>
    </div>
  );
}
