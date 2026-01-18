import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setOverallProgress } from '../store/slices/timelineSlice'

export default function ScrollMapper({
  pxPerSec = 3,
  smoothing = 0.25,
  theatreBMultiplier = 4
}) {
  const dispatch = useDispatch()
  const durations = useSelector(s => s.timeline.durations)

  const target = useRef(0)
  const current = useRef(0)
  const raf = useRef(null)
  const loaderDone = useRef(false)

  /* listen loader */
  useEffect(() => {
    const onDone = () => {
      loaderDone.current = true
      window.scrollTo(0, 0)
    }
    window.addEventListener('APP_LOADER_DONE', onDone)
    return () => window.removeEventListener('APP_LOADER_DONE', onDone)
  }, [])

  /* build scroll height */
  useEffect(() => {
    const tA = durations.theatreA || 0
    const tH = durations.helix || 0
    const tB = durations.theatreB || 0

    const weightedSeconds = tA + tH + tB * theatreBMultiplier
    const h = Math.max(window.innerHeight, weightedSeconds * pxPerSec)

    let spacer = document.getElementById('scroll-spacer')
    if (!spacer) {
      spacer = document.createElement('div')
      spacer.id = 'scroll-spacer'
      document.body.appendChild(spacer)
    }
    spacer.style.height = `${h}px`
  }, [durations, pxPerSec, theatreBMultiplier])

  /* scroll → progress */
  useEffect(() => {
    const onScroll = () => {
      if (!loaderDone.current) {
        window.scrollTo(0, 0)
        return
      }

      const max =
        document.documentElement.scrollHeight - window.innerHeight
      const y = window.scrollY || 0

      target.current =
        max > 0 ? Math.min(1, Math.max(0, y / max)) : 0
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    function loop() {
      if (!loaderDone.current) {
        current.current = 0
        dispatch(setOverallProgress(0))
        raf.current = requestAnimationFrame(loop)
        return
      }

      const alpha = 1 - Math.exp(-smoothing * 60 * 0.016)
      current.current += (target.current - current.current) * alpha

      const v = Math.max(0, Math.min(1, current.current))
      dispatch(setOverallProgress(v))
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
