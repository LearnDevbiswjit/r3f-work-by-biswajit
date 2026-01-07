// src/StudioManager.jsx
import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { getProject } from '@theatre/core'
import studio from '@theatre/studio'
import extension from '@theatre/r3f/dist/extension'

import theatreState from './assets/theatreState.json'

const IS_PROD = process.env.NODE_ENV === 'production'
const BROWSER_STATE_KEY = 'theatreBrowserState'

export default function StudioManager({
  projectName = 'myProject',
  sheetName = 'Scene'
}) {
  const mode = useSelector(s => s.camera.mode)
  const ref = useRef({ project: null, sheet: null })

  function loadBrowserState() {
    if (IS_PROD) return null
    try {
      const raw = localStorage.getItem(BROWSER_STATE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  useEffect(() => {
    // =========================
    // DEV → live Studio
    // =========================
    if (!IS_PROD && mode === 'theatre') {
      try {
        studio.initialize()
        studio.extend(extension)
      } catch {}

      const project = getProject(projectName)
      const sheet = project.sheet(sheetName)

      window.__THEATRE_PROJECT__ = project
      window.__THEATRE_SHEET__ = sheet
      window.__THEATRE_CONTROL_ACTIVE = true

      ref.current = { project, sheet }
      return
    }

    // =========================
    // PROD → JSON only
    // =========================
    window.__THEATRE_CONTROL_ACTIVE = false

    const browserState = loadBrowserState()
    const stateToUse = browserState || theatreState || null

    const project = stateToUse
      ? getProject(projectName, { state: stateToUse })
      : getProject(projectName)

    const sheet = project.sheet(sheetName)

    window.__THEATRE_PROJECT__ = project
    window.__THEATRE_SHEET__ = sheet

    ref.current = { project, sheet }
  }, [mode, projectName, sheetName])

  return null
}
