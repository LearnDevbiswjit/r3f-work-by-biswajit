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

const THEATRE_A_SCROLL_SPEED = 1.2
const END_EPS = 0.999

export const listenerMiddleware = createListenerMiddleware()

let prevOverall = null
let prevPhase = null
let autoAdvancedA = false

listenerMiddleware.startListening({
  actionCreator: setOverallProgress,
  effect: async (action, api) => {
    const p = action.payload
    const prev = prevOverall
    prevOverall = p

    const forward = prev == null ? true : p > prev

    const state = api.getState()
    const d = state.timeline.durations
    const total = d.theatreA + d.helix + d.theatreB
    const tA = d.theatreA / total
    const tH = d.helix / total

    const registry = window.__TimelineRegistry__ || null

    /* ================= THEATRE A ================= */
    if (p <= tA) {
      // 🔁 back scroll reset
      if (!forward) autoAdvancedA = false

      let local = p / tA
      local = Math.min(1, local * THEATRE_A_SCROLL_SPEED)

      if (prevPhase !== 'theatreA') {
        api.dispatch(setPhase('theatreA'))
        api.dispatch(lockCamera())
        api.dispatch(setMode('theatre'))
        prevPhase = 'theatreA'
      }

      registry?.seekTimelineNormalized('theatreA', local)

      // 🔥 forward only auto jump
      if (forward && local >= END_EPS && !autoAdvancedA) {
        autoAdvancedA = true
        return
      }
    }

    /* ================= HELIX ================= */
    else if (p > tA && p <= tA + tH) {
      const local = (p - tA) / tH

      if (prevPhase !== 'helix') {
        api.dispatch(setPhase('helix'))
        api.dispatch(unlockCamera())
        api.dispatch(setMode('helix'))
        prevPhase = 'helix'
      }

      api.dispatch(setProgress(local))
    }

    /* ================= THEATRE B ================= */
    else {
      const local = (p - (tA + tH)) / (1 - (tA + tH))

      if (prevPhase !== 'theatreB') {
        api.dispatch(setPhase('theatreB'))
        api.dispatch(lockCamera())
        api.dispatch(setMode('theatre'))
        prevPhase = 'theatreB'
      }

      registry?.seekTimelineNormalized('theatreB', local)
    }

    api.dispatch(
      setLastCommand({
        type: 'progress-set',
        overallProgress: p,
        ts: Date.now()
      })
    )
  }
})
