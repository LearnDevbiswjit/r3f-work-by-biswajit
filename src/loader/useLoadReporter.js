import { useEffect } from 'react'
import { useLoader } from './LoaderContext'

export default function useLoadReporter(key) {
  const loader = useLoader()

  useEffect(() => {
    loader.register(key)
    loader.start(key)

    return () => {
      loader.end(key)
    }
  }, [key])

  return {
    end: () => loader.end(key)
  }
}
