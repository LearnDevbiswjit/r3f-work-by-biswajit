import { useEffect, useState, useRef } from 'react'
import { subscribeProgress } from '../loader/ByteProgressStore'
import { bindThreeLoader } from '../loader/ThreeByteHook'
import { useEnvironmentGate } from '../loader/EnvironmentGate'
import gsap from 'gsap'

export default function LoaderOverlay() {
  const { envReady, manualPending } = useEnvironmentGate()

  const [p, setP] = useState(0)
  const [phase, setPhase] = useState('loading') // loading | complete | done

  const overlayRef = useRef(null)
  const textRef = useRef(null)
  const finishedRef = useRef(false)

  useEffect(() => {
    bindThreeLoader()
  }, [])

  useEffect(() => {
    return subscribeProgress(v => {
      const percent = Math.round(v * 100)
      setP(percent)

      if (
        percent >= 100 &&
        envReady &&
        manualPending === 0 &&
        !finishedRef.current
      ) {
        finishedRef.current = true
        startFinishSequence()
      }
    })
  }, [envReady, manualPending])

  function startFinishSequence() {
    setTimeout(() => {
      setPhase('complete')

      gsap.fromTo(
        textRef.current,
        { scale: 0.9, opacity: 0 },
        { scale: 1, opacity: 1, duration: 1, ease: 'power2.out' }
      )

      setTimeout(() => {
        gsap.to(overlayRef.current, {
          opacity: 0,
          duration: 1,
          ease: 'power2.inOut',
          onComplete: () => {
            setPhase('done')
            window.dispatchEvent(new Event('APP_LOADER_DONE'))
          }
        })
      }, 1500)
    }, 500)
  }

  if (phase === 'done') return null

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#111',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        fontSize: 20
      }}
    >
      <div ref={textRef}>
        {phase === 'loading' && <>Loading {p}%</>}
        {phase === 'complete' && <>Complete</>}
      </div>
    </div>
  )
}
