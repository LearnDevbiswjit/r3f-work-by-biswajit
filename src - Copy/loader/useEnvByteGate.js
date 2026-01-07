// src/loader/useEnvByteGate.js
import { useRef } from 'react'
import { registerSource, completeSource } from './ByteProgressStore'

export function useEnvByteGate() {
  const fired = useRef(false)

  registerSource('env', 1)

  return function reportEnvReady() {
    if (fired.current) return
    fired.current = true
    completeSource('env')
  }
}
