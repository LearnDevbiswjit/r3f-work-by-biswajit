// src/theatre/initStudio.js
import { getProject } from '@theatre/core'
import studio from '@theatre/studio'

export function initTheatreStudio({
  projectName = 'myProject',
  sheetName = 'Scene',
  stateJson = null
} = {}) {
  if (typeof window === 'undefined') return null

  // 🚫 Production → NO studio
  if (process.env.NODE_ENV === 'production') {
    const project = stateJson
      ? getProject(projectName, { state: stateJson })
      : getProject(projectName)

    const sheet = project.sheet(sheetName)

    window.__THEATRE_PROJECT__ = project
    window.__THEATRE_SHEET__ = sheet

    return { project, sheet }
  }

  // 🟢 Dev → Studio
  try {
    studio.initialize()
  } catch {}

  const project = stateJson
    ? getProject(projectName, { state: stateJson })
    : getProject(projectName)

  const sheet = project.sheet(sheetName)

  window.__THEATRE_PROJECT__ = project
  window.__THEATRE_SHEET__ = sheet

  return { studio, project, sheet }
}
