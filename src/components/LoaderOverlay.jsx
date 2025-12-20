import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'

export default function LoaderOverlay() {
  const { progress, active } = useProgress()
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!active && progress === 100) {
      window.dispatchEvent(new Event('APP_LOADER_DONE'))
      setTimeout(() => setVisible(false), 600)
    }
  }, [active, progress])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#3c3c3c',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: '22px',
        zIndex: 999999
      }}
    >
      Loading {Math.round(progress)}%
    </div>
  )
}
