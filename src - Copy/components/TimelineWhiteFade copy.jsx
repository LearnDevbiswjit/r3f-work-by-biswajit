import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { gsap } from 'gsap'

/*
  TimelineWhiteFade (FINAL)
  ------------------------
  - Fade triggers ONLY on camera phase change
  - Scroll up + down দুদিকেই কাজ করবে
  - Fade camera কে block করে না
  - Camera fade-এর ভেতরেই চলতে থাকে
*/

export default function TimelineWhiteFade({
  fadeDuration = 2
}) {
  const overlayRef = useRef(null)
  const armedRef = useRef(false)

  const lastPhaseRef = useRef(null)
  const tlRef = useRef(null)
  const soundRef = useRef(null)

  const phase = useSelector(s => s.timeline.phase)

  /* ---------- sound ---------- */
  useEffect(() => {
    const audio = new Audio('/sounds/whoosh.mp3')
    audio.preload = 'auto'
    audio.volume = 0.85
    soundRef.current = audio
  }, [])

  /* ---------- wait for loader ---------- */
  useEffect(() => {
    const arm = () => {
      armedRef.current = true
    }
    window.addEventListener('APP_LOADER_DONE', arm, { once: true })
    return () => window.removeEventListener('APP_LOADER_DONE', arm)
  }, [])

  /* ---------- phase change fade ---------- */
  useEffect(() => {
    if (!armedRef.current) return
    if (!overlayRef.current) return

    const last = lastPhaseRef.current
    const current = phase

    if (!last) {
      lastPhaseRef.current = current
      return
    }

    if (last !== current) {
      /* 🔊 sound */
      if (soundRef.current) {
        try {
          soundRef.current.pause()
          soundRef.current.currentTime = 0
          soundRef.current.play()
        } catch {}
      }

      /* 🤍 fade */
      tlRef.current?.kill()
      tlRef.current = gsap.timeline()
        .set(overlayRef.current, { opacity: 0 })
        .to(overlayRef.current, {
          opacity: 1,
          duration: fadeDuration * 0.3,
          ease: 'power2.out'
        })
        .to(overlayRef.current, {
          opacity: 1,
          duration: fadeDuration * 0.2
        })
        .to(overlayRef.current, {
          opacity: 0,
          duration: fadeDuration * 0.5,
          ease: 'power2.in'
        })
    }

    lastPhaseRef.current = current
  }, [phase, fadeDuration])

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#ffffff',
        opacity: 0,
        pointerEvents: 'none',
        zIndex: 999999
      }}
    />
  )
}
