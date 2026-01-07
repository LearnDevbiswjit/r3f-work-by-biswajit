// src/loader/renderConfirm.js
let rendered = false
const subs = new Set()

export function markRendered() {
  if (rendered) return
  rendered = true
  subs.forEach(fn => fn(true))
}

export function subscribeRendered(fn) {
  subs.add(fn)
  fn(rendered)
  return () => subs.delete(fn)
}
