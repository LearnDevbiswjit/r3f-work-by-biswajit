// src/utils/nativeSmoothScroll.js
// Lightweight native scroll sampler + smoothed velocity publisher.
// Reads optional runtime config from window._springScrollConfig (live tuning).

export function initNativeSmoothScroll (opts = {}) {
  const {
    sampleHz = 120,
    velocitySmoothingAlpha = 0.12,
    offsetSmoothingAlpha = 0.12,
    velocityScaleForScene = 0.04,
    debug = false
  } = opts

  if (typeof window === 'undefined') return { destroy: () => {} }

  if (window.__nativeSmoothScrollHandle) {
    if (debug) console.warn('[nativeSmoothScroll] already running')
    return window.__nativeSmoothScrollHandle
  }

  let mounted = true

  const handle = {
    lastY: typeof window.scrollY === 'number' ? window.scrollY : (window.pageYOffset || 0),
    lastTime: performance.now(),
    velocitySmoothed: 0,
    offsetSmoothed: 0,
    rafId: null
  }

  function computeLimit () {
    const doc = document.documentElement
    const body = document.body
    const scrollHeight = Math.max(
      doc.scrollHeight || 0,
      body ? (body.scrollHeight || 0) : 0
    )
    const winH = window.innerHeight || 1
    return Math.max(1, scrollHeight - winH)
  }

  // initial publish
  const initialLimit = computeLimit()
  window._springScrollY = handle.lastY
  window._springScrollOffset = Math.max(0, Math.min(1, handle.lastY / Math.max(1, initialLimit)))
  window._springScrollVelocityRaw = 0
  window._springScrollVelocitySmoothed = 0
  window._springScrollVelocity = 0

  function step () {
    if (!mounted) return
    const now = performance.now()
    const y = typeof window.scrollY === 'number' ? window.scrollY : (window.pageYOffset || 0)
    const dt = Math.max(1e-6, (now - handle.lastTime) / 1000)

    // allow live override via window._springScrollConfig
    const cfg = (typeof window !== 'undefined' && window._springScrollConfig) ? window._springScrollConfig : {}
    const alphaVel = typeof cfg.velocitySmoothingAlpha === 'number' ? cfg.velocitySmoothingAlpha : velocitySmoothingAlpha
    const alphaOff = typeof cfg.offsetSmoothingAlpha === 'number' ? cfg.offsetSmoothingAlpha : offsetSmoothingAlpha
    const scaleForScene = typeof cfg.velocityScaleForScene === 'number' ? cfg.velocityScaleForScene : velocityScaleForScene
    const dbg = typeof cfg.debug === 'boolean' ? cfg.debug : debug

    const rawVel = (y - handle.lastY) / dt

    // low-pass velocity
    handle.velocitySmoothed = handle.velocitySmoothed * (1 - alphaVel) + rawVel * alphaVel

    // offset
    const limit = computeLimit()
    const rawOffset = limit > 0 ? Math.max(0, Math.min(1, y / Math.max(1, limit))) : 0
    handle.offsetSmoothed = handle.offsetSmoothed * (1 - alphaOff) + rawOffset * alphaOff

    // publish
    window._springScrollY = y
    window._springScrollOffset = handle.offsetSmoothed
    window._springScrollVelocityRaw = rawVel
    window._springScrollVelocitySmoothed = handle.velocitySmoothed
    window._springScrollVelocity = handle.velocitySmoothed * scaleForScene

    handle.lastY = y
    handle.lastTime = now

    if (dbg && Math.floor(now / 500) !== Math.floor((now - 16) / 500)) {
      console.log('[nativeSmoothScroll] y', Math.round(y), 'off', window._springScrollOffset.toFixed(3), 'vel(px/s)', Math.round(handle.velocitySmoothed), 'scene', window._springScrollVelocity.toFixed(4))
    }

    handle.rafId = requestAnimationFrame(step)
  }

  handle.rafId = requestAnimationFrame(step)

  function onResize () {}

  window.addEventListener('resize', onResize)

  function destroy () {
    mounted = false
    try { if (handle.rafId) cancelAnimationFrame(handle.rafId) } catch (e) {}
    try { window.removeEventListener('resize', onResize) } catch (e) {}
    try {
      delete window._springScrollY
      delete window._springScrollOffset
      delete window._springScrollVelocityRaw
      delete window._springScrollVelocitySmoothed
      delete window._springScrollVelocity
      delete window._springScrollConfig
    } catch (e) {}
    try { delete window.__nativeSmoothScrollHandle } catch (e) {}
    if (debug) console.log('[nativeSmoothScroll] destroyed')
  }

  const ret = { destroy, handle }
  window.__nativeSmoothScrollHandle = ret
  return ret
}
