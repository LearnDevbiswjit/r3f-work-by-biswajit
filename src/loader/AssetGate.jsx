// global manual asset counter (video, fetch, hdr, shader warmup etc)

let pending = 0
const subs = new Set()

function notify() {
  subs.forEach(fn => fn(pending))
}

export function assetStart(label = '') {
  pending++
  notify()
}

export function assetEnd(label = '') {
  pending = Math.max(0, pending - 1)
  notify()
}

export function subscribeAssets(fn) {
  subs.add(fn)
  fn(pending)
  return () => subs.delete(fn)
}
