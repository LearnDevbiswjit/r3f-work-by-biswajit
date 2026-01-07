import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { gsap } from 'gsap'

/*
  TimelineWhiteFade (FINAL)
  ------------------------
  - Speed independent (boundary crossing)
  - EVERY crossing → sound plays
  - Full screen white fade (1.5s)
  - GsapOverlay safe
*/

export default function TimelineWhiteFade({
  triggerAtSec = 680,   // 8 minutes
  fadeDuration = 1.5
}) {
  const overlayRef = useRef(null)
  const armedRef = useRef(false)
  const lastSecRef = useRef(0)

  const tlRef = useRef(null)
  const soundRef = useRef(null)

  const progress = useSelector(s => s.timeline.overallProgress)
  const durations = useSelector(s => s.timeline.durations)

  /* ---------- setup sound ONCE ---------- */
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

  /* ---------- main logic ---------- */
  useEffect(() => {
    if (!armedRef.current) return
    if (!durations || !overlayRef.current) return

    const totalSeconds =
      (durations.theatreA || 0) +
      (durations.helix || 0) +
      (durations.theatreB || 0)

    if (!totalSeconds) return

    const currentSec = progress * totalSeconds
    const lastSec = lastSecRef.current

    // 🔥 boundary crossing detect (both directions)
    const crossedForward =
      lastSec < triggerAtSec && currentSec >= triggerAtSec
    const crossedBackward =
      lastSec > triggerAtSec && currentSec <= triggerAtSec

    if (crossedForward || crossedBackward) {
      /* 🔊 PLAY SOUND — EVERY TIME */
      if (soundRef.current) {
        try {
          soundRef.current.pause()
          soundRef.current.currentTime = 0
          soundRef.current.play()
        } catch {}
      }

      /* 🤍 WHITE FADE (restart cleanly) */
      tlRef.current?.kill()
      tlRef.current = gsap.timeline()
        .set(overlayRef.current, { opacity: 0 })
        .to(overlayRef.current, {
          opacity: 1,
          duration: fadeDuration * 0.4,
          ease: 'power2.out'
        })
        .to(overlayRef.current, {
          opacity: 1,
          duration: fadeDuration * 0.2
        })
        .to(overlayRef.current, {
          opacity: 0,
          duration: fadeDuration * 0.4,
          ease: 'power2.in'
        })
    }

    lastSecRef.current = currentSec
  }, [progress, durations, triggerAtSec, fadeDuration])

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
