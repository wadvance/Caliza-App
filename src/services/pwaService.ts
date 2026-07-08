let deferredInstallPrompt: any = null

export function initPWA() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredInstallPrompt = e
  })
}

export function getInstallPrompt() {
  return deferredInstallPrompt
}

export function useInstallPrompt() {
  return deferredInstallPrompt
}

export function clearInstallPrompt() {
  deferredInstallPrompt = null
}
