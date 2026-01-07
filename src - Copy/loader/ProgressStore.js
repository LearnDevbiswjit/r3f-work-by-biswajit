// src/loader/ProgressStore.js
let threeProgress = 0       // 0..1
let manualProgress = 0     // 0..1
let envProgress = 0        // 0..1

const subs = new Set()

function notify() {
  const total =
    threeProgress * 0.6 +
    manualProgress * 0.2 +
    envProgress * 0.2

  subs.forEach(fn => fn(Math.min(1, total)))
}

export function setThreeProgress(v) {
  threeProgress = Math.max(0, Math.min(1, v))
  notify()
}

export function setManualProgress(v) {
  manualProgress = Math.max(0, Math.min(1, v))
  notify()
}

export function setEnvReady() {
  envProgress = 1
  notify()
}

export function subscribeProgress(fn) {
  subs.add(fn)
  fn(
    threeProgress * 0.6 +
    manualProgress * 0.2 +
    envProgress * 0.2
  )
  return () => subs.delete(fn)
}
