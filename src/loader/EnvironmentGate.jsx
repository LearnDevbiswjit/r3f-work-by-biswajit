import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react'
import { subscribeAssets } from './AssetGate'

const Ctx = createContext(null)

export function EnvironmentGateProvider({ children }) {
  const readyRef = useRef(false)

  const [envReady, setEnvReady] = useState(false)
  const [manualPending, setManualPending] = useState(0)

  // listen manual asset gate
  useEffect(() => {
    return subscribeAssets(setManualPending)
  }, [])

  const reportReady = useCallback(() => {
    if (!readyRef.current) {
      readyRef.current = true
      setEnvReady(true)
      console.log('[ENV] first frame rendered')
    }
  }, [])

  return (
    <Ctx.Provider value={{ envReady, manualPending, reportReady }}>
      {children}
    </Ctx.Provider>
  )
}

export function useEnvironmentGate() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useEnvironmentGate must be inside provider')
  return ctx
}
