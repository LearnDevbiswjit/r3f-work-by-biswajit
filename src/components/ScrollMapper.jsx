import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setOverallProgress } from '../store/slices/timelineSlice'

/*
  ScrollMapper (FINAL)
  -------------------
  - Scroll height is the REAL timeline length
  - durations = ratio only
  - theatreB gets EXTRA scroll length (cinematic outro)
*/

export default function ScrollMapper({
  pxPerSec = 3,
  smoothing = 0.25,
  theatreBMultiplier = 3 // 🔥 DOUBLE scroll for TheatreB
}) {
  const dispatch = useDispatch()
  const durations = useSelector(s => s.timeline.durations)

  const target = useRef(0)
  const current = useRef(0)
  const raf = useRef(null)

  /* =========================================================
     BUILD SCROLL HEIGHT (KEY FIX HERE)
     ========================================================= */
  useEffect(() => {
    const tA = durations.theatreA || 0
    const tH = durations.helix || 0
    const tB = durations.theatreB || 0

    // 🔑 Phase-weighted scroll length
    const weightedSeconds =
      tA +
      tH +
      tB * theatreBMultiplier

    // Always at least 1 viewport tall
    const h = Math.max(
      window.innerHeight,
      weightedSeconds * pxPerSec
    )

    let spacer = document.getElementById('scroll-spacer')
    if (!spacer) {
      spacer = document.createElement('div')
      spacer.id = 'scroll-spacer'
      document.body.appendChild(spacer)
    }

    spacer.style.height = `${h}px`
  }, [durations, pxPerSec, theatreBMultiplier])

  /* =========================================================
     SCROLL → PROGRESS
     ========================================================= */
  useEffect(() => {
    const onScroll = () => {
      const max =
        document.documentElement.scrollHeight - window.innerHeight

      const y = window.scrollY || 0
      target.current = max > 0
        ? Math.min(1, Math.max(0, y / max))
        : 0
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    function loop() {
      // smooth scroll progress (frame independent)
      const alpha = 1 - Math.exp(-smoothing * 60 * 0.016)
      current.current += (target.current - current.current) * alpha

      const v = Math.max(0, Math.min(1, current.current))

      dispatch(setOverallProgress(v))

      // 🔑 GSAP OVERLAY SOURCE OF TRUTH
      window._springScrollOffset = v

      raf.current = requestAnimationFrame(loop)
    }

    raf.current = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf.current)
    }
  }, [dispatch, smoothing])

  return null
}
