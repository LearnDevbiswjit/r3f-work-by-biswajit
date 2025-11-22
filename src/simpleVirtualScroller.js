// src/simpleVirtualScroller.js
// Lightweight virtual smooth scroller (no external deps).
// Exposes globals:
//  - window._smoothScroll (object with api)
//  - window._smoothScrollY (pixels)
//  - window._smoothScrollOffset (0..1)
//  - window._smoothScrollVelocity
//
// Usage:
//   import { initSimpleVirtualScroller, destroySimpleVirtualScroller } from './simpleVirtualScroller'
//   initSimpleVirtualScroller({ pages: 33 })    // call once (pages = number of 100vh pages)
//   destroySimpleVirtualScroller()              // cleanup (optional)
export function initSimpleVirtualScroller (opts = {}) {
  if (typeof window === 'undefined') return
  const pages = typeof opts.pages === 'number' ? Math.max(1, opts.pages) : 3
  const ease = typeof opts.ease === 'number' ? opts.ease : 0.08 // lerp factor
  const wheelMultiplier = typeof opts.wheelMultiplier === 'number' ? opts.wheelMultiplier : 1.0
  const touchMultiplier = typeof opts.touchMultiplier === 'number' ? opts.touchMultiplier : 1.7
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

  // Prevent double-init
  if (window._simpleVirtualScrollerInitialized) return
  window._simpleVirtualScrollerInitialized = true

  // create spacer so document has height (pages * 100vh)
  let spacer = document.getElementById('virtual-scroll-spacer')
  if (!spacer) {
    spacer = document.createElement('div')
    spacer.id = 'virtual-scroll-spacer'
    spacer.style.position = 'relative'
    spacer.style.width = '100%'
    spacer.style.pointerEvents = 'none'
    document.body.appendChild(spacer)
  }
  function updateSpacer () {
    spacer.style.height = `${pages * 100}vh`
  }
  updateSpacer()
  // if window resizes -> recalc limit in loop (we read innerHeight dynamically)

  // disable native wheel scroll from body so we fully control
  // we won't set overflow:hidden because we want other DOM interactions to work;
  // instead we prevent wheel/touch default on capture.
  let targetY = 0
  let currentY = 0
  let velocity = 0
  let lastY = 0
  let lastTime = performance.now()
  let ticking = false
  let rafId = null

  // touch support
  let touchStartY = 0
  let touchActive = false

  function getLimit () {
    return Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
  }

  function onWheel (e) {
    // if e originated from an input-like element, ignore
    const tag = e.target && e.target.tagName && e.target.tagName.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return
    e.preventDefault()
    const delta = (e.deltaY || -e.wheelDelta || e.detail) * 1.0
    targetY += delta * wheelMultiplier
    targetY = clamp(targetY, 0, getLimit())
    startTick()
  }

  function onTouchStart (e) {
    if (!e.touches || e.touches.length === 0) return
    touchActive = true
    touchStartY = e.touches[0].clientY
  }
  function onTouchMove (e) {
    if (!touchActive) return
    const ty = e.touches[0].clientY
    const dy = touchStartY - ty
    touchStartY = ty
    e.preventDefault()
    targetY += dy * touchMultiplier
    targetY = clamp(targetY, 0, getLimit())
    startTick()
  }
  function onTouchEnd () {
    touchActive = false
  }

  // optional keyboard support (PageUp/Down, arrows, home/end)
  function onKeyDown (e) {
    const limit = getLimit()
    const step = window.innerHeight * 0.9
    if (e.key === 'PageDown') { targetY = clamp(targetY + step, 0, limit); startTick(); e.preventDefault() }
    else if (e.key === 'PageUp') { targetY = clamp(targetY - step, 0, limit); startTick(); e.preventDefault() }
    else if (e.key === 'ArrowDown') { targetY = clamp(targetY + 40, 0, limit); startTick(); e.preventDefault() }
    else if (e.key === 'ArrowUp') { targetY = clamp(targetY - 40, 0, limit); startTick(); e.preventDefault() }
    else if (e.key === 'Home') { targetY = 0; startTick(); e.preventDefault() }
    else if (e.key === 'End') { targetY = limit; startTick(); e.preventDefault() }
  }

  // bind events (capture phase so we can prevent default before native)
  window.addEventListener('wheel', onWheel, { passive: false, capture: true })
  window.addEventListener('touchstart', onTouchStart, { passive: false, capture: true })
  window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true })
  window.addEventListener('touchend', onTouchEnd, { passive: true, capture: true })
  window.addEventListener('keydown', onKeyDown, { passive: false, capture: true })

  // also expose programmatic API
  window._smoothScroll = {
    setOffset (norm) { // 0..1
      const limit = getLimit()
      const px = clamp(norm, 0, 1) * limit
      targetY = clamp(px, 0, limit)
      // if immediate flag passed, you could also set currentY = targetY
    },
    setY (y) { targetY = clamp(y, 0, getLimit()) },
    getY () { return currentY },
    getOffset () { return getLimit() > 0 ? currentY / getLimit() : 0 },
    destroy () { destroySimpleVirtualScroller() }
  }

  // publisher to globals for r3f code
  function publishGlobals (now) {
    const limit = getLimit()
    window._smoothScrollY = currentY
    window._smoothScrollOffset = limit > 0 ? clamp(currentY / limit, 0, 1) : 0
    window._smoothScrollVelocity = velocity
    // optional hook for external listeners
    if (typeof window._onSmoothScroll === 'function') {
      try { window._onSmoothScroll({ y: currentY, offset: window._smoothScrollOffset, velocity }) } catch (e) {}
    }
    // r3f invalidate if available (Canvas frameloop demand)
    try {
      if (typeof window._r3fInvalidate === 'function') window._r3fInvalidate()
    } catch (e) {}
    // also update spacer in case pages changed externally
    // (we rely on pages * 100vh set initially; caller can call updateSpacerPages)
  }

  function startTick () {
    if (!ticking) {
      ticking = true
      rafId = requestAnimationFrame(tick)
    }
  }

  function tick (now) {
    // delta time
    const dt = Math.max(1e-4, (now - lastTime) / 1000)
    lastTime = now

    // simple lerp
    const prev = currentY
    const lerpFactor = 1 - Math.pow(1 - ease, 60 * dt) // frame-rate independent-ish
    currentY += (targetY - currentY) * lerpFactor

    // velocity approx
    velocity = (currentY - lastY) / Math.max(1e-6, dt)
    lastY = currentY

    // publish
    publishGlobals(now)

    // keep going until close enough
    if (Math.abs(currentY - targetY) > 0.5 || Math.abs(velocity) > 0.5) {
      rafId = requestAnimationFrame(tick)
    } else {
      // snap final
      currentY = targetY
      velocity = 0
      publishGlobals(now)
      ticking = false
      rafId = null
    }
  }

  // initial publish
  publishGlobals(performance.now())

  // expose helper to update spacer pages
  window._simpleVirtualScrollerUpdatePages = function (newPages) {
    if (!spacer) return
    const p = Math.max(1, Number(newPages) || pages)
    spacer.style.height = `${p * 100}vh`
  }

  // store cleanup ref
  window._simpleVirtualScroller_internal = {
    spacer, onWheel, onTouchStart, onTouchMove, onTouchEnd, onKeyDown, tickId: rafId
  }

  // convenience: set initial target/current to current scroll Y (if the page not at top)
  try {
    const startY = window.scrollY || window.pageYOffset || 0
    targetY = clamp(startY, 0, getLimit())
    currentY = targetY
    lastY = currentY
    publishGlobals(performance.now())
  } catch (e) {}

  // return API for caller
  return {
    setPages (p) { window._simpleVirtualScrollerUpdatePages(p) },
    setOffset (n) { window._smoothScroll.setOffset(n) }
  }
}

export function destroySimpleVirtualScroller () {
  if (typeof window === 'undefined') return
  if (!window._simpleVirtualScrollerInitialized) return
  const internal = window._simpleVirtualScroller_internal || {}
  try {
    window.removeEventListener('wheel', internal.onWheel, { capture: true })
    window.removeEventListener('touchstart', internal.onTouchStart, { capture: true })
    window.removeEventListener('touchmove', internal.onTouchMove, { capture: true })
    window.removeEventListener('touchend', internal.onTouchEnd, { capture: true })
    window.removeEventListener('keydown', internal.onKeyDown, { capture: true })
  } catch (e) {}
  try {
    if (internal && internal.spacer && internal.spacer.parentNode) internal.spacer.parentNode.removeChild(internal.spacer)
  } catch (e) {}
  // remove globals
  delete window._simpleVirtualScroller_internal
  delete window._simpleVirtualScrollerInitialized
  try { delete window._smoothScroll } catch (e) {}
  try { delete window._smoothScrollY } catch (e) {}
  try { delete window._smoothScrollOffset } catch (e) {}
  try { delete window._smoothScrollVelocity } catch (e) {}
  try { delete window._simpleVirtualScrollerUpdatePages } catch (e) {}
}
