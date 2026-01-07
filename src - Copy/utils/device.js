export const isMobile =
  typeof window !== 'undefined' &&
  /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent)
