// src/store/listeners.js
import { createListenerMiddleware } from '@reduxjs/toolkit'
import { setPhase, setOverallProgress } from './slices/timelineSlice'
import {
  setMode,
  setProgress,
  lockCamera,
  unlockCamera,
  setLastCommand
} from './slices/cameraSlice'

/*
  FINAL BEHAVIOUR
  --------------
  - theatreA path SAME থাকে
  - scroll এ theatreA একটু fast
  - phase change হলে camera IMMEDIATELY switch + move শুরু
  - fade কখনো camera কে block করে না
*/

const THEATRE_A_SCROLL_SPEED = 1.8

export const listenerMiddleware = createListenerMiddleware()

let prevOverall = null
let prevPhase = null

// ✅ single-frame defer (camera runs during fade)
function seekNextFrame(fn) {
  if (typeof requestAnimationFrame === 'undefined') {
    fn()
    return
  }
  requestAnimationFrame(fn)
}

listenerMiddleware.startListening({
  actionCreator: setOverallProgress,
  effect: async (action, listenerApi) => {
    const p = action.payload
    if (prevOverall !== null && Math.abs(prevOverall - p) < 1e-6) return
    prevOverall = p

    const state = listenerApi.getState()
    const d =
      state.timeline.durations || {
        theatreA: 15 * 60,
        helix: 20 * 60,
        theatreB: 30 * 60
      }

    const total = Math.max(1, d.theatreA + d.helix + d.theatreB)
    const tA = d.theatreA / total
    const tH = d.helix / total

    const registry =
      typeof window !== 'undefined' && window.__TimelineRegistry__
        ? window.__TimelineRegistry__
        : null

    /* ---------- THEATRE A ---------- */
    if (p <= tA) {
      let local = tA === 0 ? 0 : p / tA
      local = Math.min(1, local * THEATRE_A_SCROLL_SPEED)

      if (prevPhase !== 'theatreA') {
        listenerApi.dispatch(setPhase('theatreA'))
        listenerApi.dispatch(lockCamera())
        listenerApi.dispatch(setMode('theatre'))
        prevPhase = 'theatreA'
      }

      seekNextFrame(() => {
        registry?.seekTimelineNormalized?.('theatreA', local)
      })
    }

    /* ---------- HELIX ---------- */
    else if (p > tA && p <= tA + tH) {
      const local = (p - tA) / tH

      if (prevPhase !== 'helix') {
        listenerApi.dispatch(setPhase('helix'))
        listenerApi.dispatch(unlockCamera())
        listenerApi.dispatch(setMode('helix'))
        prevPhase = 'helix'
      }

      seekNextFrame(() => {
        listenerApi.dispatch(setProgress(local))
      })
    }

    /* ---------- THEATRE B ---------- */
    else {
      const start = tA + tH
      const local = (p - start) / (1 - start)

      if (prevPhase !== 'theatreB') {
        listenerApi.dispatch(setPhase('theatreB'))
        listenerApi.dispatch(lockCamera())
        listenerApi.dispatch(setMode('theatre'))
        prevPhase = 'theatreB'
      }

      seekNextFrame(() => {
        registry?.seekTimelineNormalized?.('theatreB', local)
      })
    }

    listenerApi.dispatch(
      setLastCommand({
        type: 'progress-set',
        overallProgress: p,
        ts: Date.now()
      })
    )
  }
})
