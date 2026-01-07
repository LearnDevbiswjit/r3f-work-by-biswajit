import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  phase: 'theatreA',
  durations: { theatreA: 5 * 60, helix: 30 * 60, theatreB: 40 * 60 },
  overallProgress: 0,
  isSeeking: false,
  transitionStartedAt: null // 🔥 NEW
}

const timelineSlice = createSlice({
  name: 'timeline',
  initialState,
  reducers: {
    setPhase: (s, a) => { s.phase = a.payload },
    setDurations: (s, a) => { s.durations = { ...s.durations, ...a.payload } },
    setOverallProgress: (s, a) => {
      s.overallProgress = Math.max(0, Math.min(1, a.payload))
    },
    setSeeking: (s, a) => { s.isSeeking = !!a.payload },
    setTransitionStart: (s, a) => { s.transitionStartedAt = a.payload }
  }
})

export const {
  setPhase,
  setDurations,
  setOverallProgress,
  setSeeking,
  setTransitionStart
} = timelineSlice.actions

export default timelineSlice.reducer
