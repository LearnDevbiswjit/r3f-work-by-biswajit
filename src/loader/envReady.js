export function markEnvReady() {
  window.__ENV_READY__ = true
  window.dispatchEvent(new Event('ENV_READY'))
}



