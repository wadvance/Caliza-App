let deferredInstallPrompt: any = null
let isInstalled = false

export function initPWA() {
  if (typeof window === 'undefined') return

  isInstalled = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredInstallPrompt = e
  })

  window.addEventListener('appinstalled', () => {
    isInstalled = true
    deferredInstallPrompt = null
  })
}

export function getInstallPrompt() {
  return deferredInstallPrompt
}

export function clearInstallPrompt() {
  deferredInstallPrompt = null
}

export function isPwaInstalled() {
  return isInstalled
}

export async function triggerInstall(): Promise<boolean> {
  const prompt = deferredInstallPrompt
  if (!prompt) return false
  await prompt.prompt()
  const result = await prompt.userChoice
  if (result.outcome === 'accepted') {
    isInstalled = true
    deferredInstallPrompt = null
    return true
  }
  return false
}
