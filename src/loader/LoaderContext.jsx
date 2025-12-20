import React, { createContext, useContext, useRef, useState, useCallback } from 'react'

const LoaderContext = createContext(null)

export function LoaderProvider({ children }) {
  const itemsRef = useRef(new Map())

  const [total, setTotal] = useState(0)
  const [loaded, setLoaded] = useState(0)
  const [ready, setReady] = useState(false)

  const register = useCallback((key) => {
    if (!itemsRef.current.has(key)) {
      itemsRef.current.set(key, { status: 'registered', start: 0, end: 0 })
      setTotal(v => v + 1)
    }
  }, [])

  const start = useCallback((key) => {
    const item = itemsRef.current.get(key)
    if (!item) return
    item.status = 'loading'
    item.start = performance.now()
  }, [])

  const end = useCallback((key) => {
    const item = itemsRef.current.get(key)
    if (!item || item.status === 'done') return

    item.status = 'done'
    item.end = performance.now()
    setLoaded(v => {
      const next = v + 1
      if (next === total) setReady(true)
      return next
    })
  }, [total])

  const value = {
    register,
    start,
    end,
    total,
    loaded,
    ready,
    progress: total === 0 ? 0 : Math.round((loaded / total) * 100),
    timings: itemsRef.current
  }

  return (
    <LoaderContext.Provider value={value}>
      {children}
    </LoaderContext.Provider>
  )
}

export function useLoader() {
  const ctx = useContext(LoaderContext)
  if (!ctx) throw new Error('useLoader must be used inside LoaderProvider')
  return ctx
}
