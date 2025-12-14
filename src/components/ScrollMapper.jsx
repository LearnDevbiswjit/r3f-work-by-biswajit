import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setOverallProgress } from '../store/slices/timelineSlice'

export default function ScrollMapper({ pxPerSec = 5, smoothing = 0.12 }) {
  const dispatch = useDispatch()
  const durations = useSelector(s => s.timeline.durations)

  const target = useRef(0)
  const current = useRef(0)
  const raf = useRef(null)

  useEffect(() => {
    const totalSeconds =
      (durations.theatreA || 0) +
      (durations.helix || 0) +
      (durations.theatreB || 0)

    const h = Math.max(window.innerHeight, totalSeconds * pxPerSec)
    let spacer = document.getElementById('scroll-spacer')
    if (!spacer) {
      spacer = document.createElement('div')
      spacer.id = 'scroll-spacer'
      document.body.appendChild(spacer)
    }
    spacer.style.height = `${h}px`
  }, [durations, pxPerSec])

  useEffect(() => {
    const onScroll = () => {
      const max =
        document.documentElement.scrollHeight - window.innerHeight
      const y = window.scrollY || 0
      target.current = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    function loop() {
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
