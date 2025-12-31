import { createListenerMiddleware } from '@reduxjs/toolkit'
import {
  setPhase,
  setOverallProgress,
  setTransitionStart
} from './slices/timelineSlice'
import {
  setMode,
  setProgress,
  lockCamera,
  unlockCamera,
  setLastCommand
} from './slices/cameraSlice'

const END_EPS = 0.999
const TRANSITION_TIME = 0.2 // 🔥 FIXED TIME

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
      if (!forward) autoAdvancedA = false

      const local = Math.min(1, p / tA)

      if (prevPhase !== 'theatreA') {
        api.dispatch(setPhase('theatreA'))
        api.dispatch(lockCamera())
        api.dispatch(setMode('theatre'))
        prevPhase = 'theatreA'
      }

      registry?.seekTimelineNormalized('theatreA', local)

      if (forward && local >= END_EPS && !autoAdvancedA) {
        autoAdvancedA = true
        api.dispatch(setPhase('transition_A_TO_HELIX'))
        api.dispatch(setTransitionStart(performance.now()))
        window.dispatchEvent(new Event('CAMERA_PATH_TRANSITION_START'))

        api.dispatch(lockCamera())
        prevPhase = 'transition_A_TO_HELIX'
        return
      }
    }

    /* ================= TRANSITION ================= */
    else if (state.timeline.phase === 'transition_A_TO_HELIX') {
      const t0 = state.timeline.transitionStartedAt
      if (!t0) return

      const elapsed = (performance.now() - t0) / 1000
      if (elapsed >= TRANSITION_TIME) {
        api.dispatch(setPhase('helix'))
        api.dispatch(unlockCamera())
        api.dispatch(setMode('helix'))
        prevPhase = 'helix'
      }
      return
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
