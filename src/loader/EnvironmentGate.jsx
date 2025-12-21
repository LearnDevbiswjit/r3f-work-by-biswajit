// src/loader/EnvironmentGate.jsx
import { createContext, useContext, useRef, useState, useCallback } from 'react'

const Ctx = createContext(null)

export function EnvironmentGateProvider({ children }) {
  const readyRef = useRef(false)
  const [envReady, setEnvReady] = useState(false)

  const reportReady = useCallback(() => {
    if (!readyRef.current) {
      readyRef.current = true
      setEnvReady(true)
      console.log('[ENV] environment ready')
    }
  }, [])

  return (
    <Ctx.Provider value={{ envReady, reportReady }}>
      {children}
    </Ctx.Provider>
  )
}

export function useEnvironmentGate() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useEnvironmentGate must be inside provider')
  return ctx
}
