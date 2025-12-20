import { useEffect, useState } from 'react'
import { preloadHeavyAssets } from './useAssets'

export default function ProgressiveGate({ children, delay = 300 }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => {
      preloadHeavyAssets()
      setShow(true)
    }, delay)

    return () => clearTimeout(id)
  }, [delay])

  return show ? children : null
}
