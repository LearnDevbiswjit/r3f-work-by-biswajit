import { useSelector } from 'react-redux'
import { useMemo } from 'react'

/*
  useGlobalTimelineSeconds
  ------------------------
  - Returns exact timeline seconds used by TimelineWhiteFade
  - Source of truth for ALL scroll-based animations
*/

export default function useGlobalTimelineSeconds() {
  const progress = useSelector(s => s.timeline.overallProgress)
  const durations = useSelector(s => s.timeline.durations)

  const totalSeconds = useMemo(() => {
    if (!durations) return 0
    return (
      (durations.theatreA || 0) +
      (durations.helix || 0) +
      (durations.theatreB || 0)
    )
  }, [durations])

  const currentSec = useMemo(() => {
    if (!totalSeconds) return 0
    return progress * totalSeconds
  }, [progress, totalSeconds])

  return {
    currentSec,   // 🔥 LIVE timeline second
    totalSeconds // useful for debug / alignment
  }
}
