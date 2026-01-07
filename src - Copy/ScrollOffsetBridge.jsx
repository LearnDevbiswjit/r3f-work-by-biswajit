// src/ScrollOffsetBridge.jsx
import * as THREE from 'three'
import React, { useEffect, useRef } from 'react'

/**
 * Robust Scroll -> Theatre bridge
 *
 * Priority:
 * 1) use sheet.sequence.length (runtime) if available
 * 2) use exported length from window.__THEATRE_EXPORTED_LEN__ (set by ScrollSection when importing JSON or auto-detected)
 * 3) compute max keyframe position from runtime track data if present
 * 4) fallback: direct sampler -> force camera transform (window._springSampleAt + window._springImmediateCameraRef)
 *
 * Designed to be resilient to different theatre runtime shapes.
 */

export default function ScrollOffsetBridge () {
  const rafRef = useRef(null)
  const scrollerRef = useRef(null)
  const lastNormRef = useRef(0)
  const lastTimeRef = useRef(performance.now())
  const moRef = useRef(null)
  const DEBUG = false

  function dlog (...args) {
    if (DEBUG) console.debug('[ScrollBridge]', ...args)
  }

  function findScrollerCandidate () {
    const selectors = [
      '.scroll-container.lenis',
      '.scroll-container',
      '.lenis.lenis-smooth',
      '.lenis',
      '[data-scroll-container]',
      'main'
    ]
    for (const s of selectors) {
      try {
        const el = document.querySelector(s)
        if (el && el.scrollHeight > (el.clientHeight || window.innerHeight)) {
          return el
        }
      } catch (e) {}
    }

    // fallback scan for scrollable element
    try {
      const all = Array.from(document.querySelectorAll('body *'))
      for (const el of all) {
        try {
          const style = getComputedStyle(el)
          if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) continue
          if ((el.scrollHeight && el.clientHeight && el.scrollHeight > el.clientHeight + 4) &&
              (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow !== 'visible')) {
            return el
          }
        } catch (e) {}
      }
    } catch (e) {}

    return document.scrollingElement || document.documentElement || document.body
  }

  function readNormalizedFromElement (el) {
    if (!el) return 0
    try {
      if (el === document.scrollingElement || el === document.documentElement || el === document.body) {
        const total = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
        return Math.max(0, Math.min(1, (window.scrollY || window.pageYOffset) / total))
      }
      if (typeof el.scrollTop === 'number' && el.scrollHeight > el.clientHeight) {
        const total = Math.max(1, el.scrollHeight - el.clientHeight)
        return Math.max(0, Math.min(1, el.scrollTop / total))
      }
      // transform-driven scrollers (try to read translateY)
      const cs = getComputedStyle(el)
      const tr = cs.transform
      if (tr && tr !== 'none') {
        const m = tr.match(/matrix.*\((.+)\)/)
        if (m && m[1]) {
          const parts = m[1].split(',').map(s => parseFloat(s))
          const ty = parts.length >= 6 ? parts[5] : 0
          const total = Math.max(1, el.scrollHeight - (el.clientHeight || window.innerHeight))
          return Math.max(0, Math.min(1, -ty / total))
        }
      }
    } catch (e) {}
    return 0
  }

  // compute best-guess effective sequence length from runtime sheet object
  function computeEffectiveLengthFromSheet (sheet) {
    try {
      if (!sheet || !sheet.sequence) return 0
      const seq = sheet.sequence
      // prefer seq.length if it's a finite positive number
      if (typeof seq.length === 'number' && isFinite(seq.length) && seq.length > 0) {
        return seq.length
      }
      // try pointer fields
      if (seq.pointer && (typeof seq.pointer.length === 'number') && isFinite(seq.pointer.length) && seq.pointer.length > 0) {
        return seq.pointer.length
      }
      // try to inspect various possible track containers
      const containers = [seq.tracksByObject, seq.trackData, seq.tracks, seq.trackSet]
      let maxPos = 0
      for (const c of containers) {
        if (!c) continue
        // c may be object mapping objectName -> { trackData: { id: { keyframes: [.] } } }
        for (const objName of Object.keys(c)) {
          try {
            const trackGroup = c[objName] && (c[objName].trackData || c[objName])
            if (!trackGroup) continue
            const trackIds = Object.keys(trackGroup)
            for (const tid of trackIds) {
              try {
                const t = trackGroup[tid]
                const kfs = t && (t.keyframes || (t.trackData && t.trackData.keyframes)) ? (t.keyframes || t.trackData.keyframes) : (Array.isArray(t) ? t : [])
                if (Array.isArray(kfs)) {
                  for (const k of kfs) {
                    if (k && typeof k.position === 'number' && isFinite(k.position)) {
                      if (k.position > maxPos) maxPos = k.position
                    }
                  }
                }
              } catch (e) { /* ignore per-track errors */ }
            }
          } catch (e) {}
        }
        if (maxPos > 0) break
      }
      return maxPos || 0
    } catch (e) {
      return 0
    }
  }

  useEffect(() => {
    // ensure globals
    window._springScrollOffset = window._springScrollOffset ?? 0
    window._springScrollVelocity = window._springScrollVelocity ?? 0
    window.__theatre_noop_frames__ = window.__theatre_noop_frames__ || 0

    // --- NEW: try auto-detect exported length from known globals/project JSON on mount
    function detectExportedLength () {
      try {
        if (typeof window.__THEATRE_EXPORTED_LEN__ === 'number' && isFinite(window.__THEATRE_EXPORTED_LEN__) && window.__THEATRE_EXPORTED_LEN__ > 0) {
          dlog('exported len already present', window.__THEATRE_EXPORTED_LEN__)
          return
        }

        // 1) try project object (if app set window.__THEATRE_PROJECT__)
        const proj = window.__THEATRE_PROJECT__ || null
        if (proj) {
          try {
            const sheet = typeof proj.sheet === 'function' ? proj.sheet('Scene') : (proj && proj.sheets && proj.sheets['Scene']) ? proj.sheets['Scene'] : null
            if (sheet && sheet.sequence) {
              // pointer.length preferred
              const ptrLen = sheet.sequence && sheet.sequence.pointer && typeof sheet.sequence.pointer.length === 'number' ? sheet.sequence.pointer.length : null
              const seqLen = typeof sheet.sequence.length === 'number' ? sheet.sequence.length : null
              if (ptrLen && isFinite(ptrLen) && ptrLen > 0) {
                window.__THEATRE_EXPORTED_LEN__ = ptrLen
                dlog('detected exported len from project.pointer.length ->', ptrLen)
                return
              }
              if (seqLen && isFinite(seqLen) && seqLen > 0) {
                window.__THEATRE_EXPORTED_LEN__ = seqLen
                dlog('detected exported len from project.sequence.length ->', seqLen)
                return
              }
            }
          } catch (e) { /* ignore */ }
        }

        // 2) try a raw exported JSON object (if app attached it to window)
        const maybeJSON = window.__THEATRE_EXPORTED_JSON__ || window.__THEATRE_STATE_JSON__ || null
        if (maybeJSON) {
          try {
            // try different shapes: { sheets: { Scene: { sequence: { pointer: { length } }}}}
            const s = maybeJSON.sheets && maybeJSON.sheets.Scene ? maybeJSON.sheets.Scene : null
            const seq = s && (s.sequence || s.timeline || s.pointer) ? (s.sequence || s.timeline || s.pointer) : null
            if (seq) {
              const cand = seq.pointer && seq.pointer.length ? seq.pointer.length : (typeof seq.length === 'number' ? seq.length : 0)
              if (cand && isFinite(cand) && cand > 0) {
                window.__THEATRE_EXPORTED_LEN__ = cand
                dlog('detected exported len from __THEATRE_EXPORTED_JSON__ ->', cand)
                return
              }
            }
          } catch (e) {}
        }

        // 3) last attempt: if an explicitly provided value exists somewhere on window (convention)
        const alt = window.__THEATRE_EXPORTED_LEN_FALLBACK__ || 0
        if (alt && isFinite(alt) && alt > 0) {
          window.__THEATRE_EXPORTED_LEN__ = alt
          dlog('detected exported len from __THEATRE_EXPORTED_LEN_FALLBACK__ ->', alt)
          return
        }
      } catch (e) {
        // swallow
      }
    }

    detectExportedLength()

    function attach () {
      const el = findScrollerCandidate()
      scrollerRef.current = el
      try { window.removeEventListener('scroll', onScroll) } catch (e) {}
      try { scrollerRef.current && scrollerRef.current.removeEventListener('scroll', onScroll) } catch (e) {}

      if (!scrollerRef.current) {
        dlog('no scroller found')
      } else {
        if (scrollerRef.current === document.scrollingElement || scrollerRef.current === document.documentElement || scrollerRef.current === document.body) {
          window.addEventListener('scroll', onScroll, { passive: true })
        } else {
          scrollerRef.current.addEventListener('scroll', onScroll, { passive: true })
        }
      }
    }

    function onScroll () {
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(step)
    }

    function step () {
      rafRef.current = null
      const now = performance.now()
      const dt = Math.max(1e-6, (now - lastTimeRef.current) / 1000)
      lastTimeRef.current = now

      if (!scrollerRef.current || (scrollerRef.current instanceof Element && !document.body.contains(scrollerRef.current))) {
        attach()
      }

      const norm = readNormalizedFromElement(scrollerRef.current)
      window._springScrollOffset = Number.isFinite(norm) ? norm : 0
      const vel = (window._springScrollOffset - (lastNormRef.current ?? 0)) / dt
      window._springScrollVelocity = Number.isFinite(vel) ? vel : 0
      lastNormRef.current = window._springScrollOffset

      // --- main apply logic
      try {
        const proj = window.__THEATRE_PROJECT__ || null
        const sheet = proj && typeof proj.sheet === 'function' ? proj.sheet('Scene') : (proj && proj.sheets && typeof proj.sheets['Scene'] !== 'undefined' ? proj.sheets['Scene'] : null)
        let effectiveLen = 0
        if (sheet) {
          effectiveLen = computeEffectiveLengthFromSheet(sheet)
          dlog('computed effectiveLen from sheet:', effectiveLen)
        }

        // fallback: use exported-length provided by app (ScrollSection should set this)
        const exportedLen = typeof window.__THEATRE_EXPORTED_LEN__ === 'number' && isFinite(window.__THEATRE_EXPORTED_LEN__) && window.__THEATRE_EXPORTED_LEN__ > 0 ? window.__THEATRE_EXPORTED_LEN__ : 0

        // pick length preference: runtime sheet length > exportedLen > 0
        const finalLen = (effectiveLen && effectiveLen > 0) ? effectiveLen : (exportedLen && exportedLen > 0) ? exportedLen : 0

        // if we have a final length, convert normalized -> sequence position and set
        if (finalLen > 0 && sheet && sheet.sequence) {
          const targetPos = THREE.MathUtils.clamp(window._springScrollOffset, 0, 1) * finalLen
          try {
            sheet.sequence.position = targetPos
          } catch (e) {
            try { sheet.sequence.position = Math.round(targetPos) } catch (e2) {}
          }
          // mark last attempt
          sheet.__lastExternalSetPos = targetPos
          dlog('set sheet.sequence.position ->', targetPos, 'finalLen', finalLen)
        } else {
          // best-effort: try set fractional 0.1 if no length known
          try {
            if (sheet && sheet.sequence) {
              sheet.sequence.position = THREE.MathUtils.clamp(window._springScrollOffset, 0, 1)
              sheet.__lastExternalSetPos = window._springScrollOffset
              dlog('best-effort set seq.position to normalized', window._springScrollOffset)
            }
          } catch (e) { dlog('best-effort seq set failed', e) }
        }
      } catch (e) {
        dlog('theatre set error', e)
      }

      // --- fallback: force camera using sampler if theatre didn't visually apply
      try {
        const camRef = window._springImmediateCameraRef
        const sampler = window._springSampleAt
        const shouldForce = !!(typeof sampler === 'function' && camRef && camRef.current)
        if (shouldForce) {
          const sample = sampler(THREE.MathUtils.clamp(window._springScrollOffset, 0, 1))
          if (sample && sample.position && sample.quaternion && camRef.current) {
            camRef.current.position.set(sample.position.x, sample.position.y, sample.position.z)
            camRef.current.quaternion.set(sample.quaternion.x, sample.quaternion.y, sample.quaternion.z, sample.quaternion.w)
            camRef.current.updateMatrixWorld()
            dlog('forced camera from sampler t=', sample.t ?? window._springScrollOffset)
            // reset noop counter
            window.__theatre_noop_frames__ = 0
          }
        }
      } catch (e) {
        dlog('sampler fallback error', e)
      }
    }

    attach()

    // observe DOM to reattach if scroller is re-parented / removed
    try {
      moRef.current = new MutationObserver(() => {
        const el = scrollerRef.current
        if (!el || !document.body.contains(el)) {
          attach()
        }
      })
      moRef.current.observe(document.documentElement || document.body, { childList: true, subtree: true })
    } catch (e) {}

    // small auxiliary events to trigger update
    function onWheelTouch () { if (rafRef.current == null) rafRef.current = requestAnimationFrame(step) }
    window.addEventListener('wheel', onWheelTouch, { passive: true })
    window.addEventListener('touchmove', onWheelTouch, { passive: true })

    // initial tick
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(step)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      try { window.removeEventListener('scroll', onScroll) } catch (e) {}
      try { scrollerRef.current && scrollerRef.current.removeEventListener('scroll', onScroll) } catch (e) {}
      try { window.removeEventListener('wheel', onWheelTouch) } catch (e) {}
      try { window.removeEventListener('touchmove', onWheelTouch) } catch (e) {}
      try { moRef.current && moRef.current.disconnect() } catch (e) {}
    }
  }, [])

  return null
}
