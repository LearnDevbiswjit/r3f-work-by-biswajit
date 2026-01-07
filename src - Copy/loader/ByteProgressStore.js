// REAL byte / buffer based progress store

const sources = new Map()
const subs = new Set()

function compute() {
  let total = 0
  let done = 0

  for (const s of sources.values()) {
    total += s.total
    done += s.done
  }

  const p = total > 0 ? done / total : 0
  subs.forEach(fn => fn(Math.min(1, p)))
}

export function registerSource(id, total = 1) {
  if (!sources.has(id)) {
    sources.set(id, { total, done: 0 })
    compute()
  }
}

export function updateSource(id, done) {
  const s = sources.get(id)
  if (!s) return
  s.done = Math.min(s.total, done)
  compute()
}

export function completeSource(id) {
  const s = sources.get(id)
  if (!s) return
  s.done = s.total
  compute()
}

export function subscribeProgress(fn) {
  subs.add(fn)
  compute()
  return () => subs.delete(fn)
}
