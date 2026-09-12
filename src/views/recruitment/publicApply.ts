/**
 * Helpers partages par les formulaires publics de candidature
 * (PublicJobApplicationView, PublicSpontaneousApplicationView) : validation
 * cote client du CV + integration optionnelle de Cloudflare Turnstile.
 */
import { onMounted, onBeforeUnmount, ref, type Ref } from 'vue'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_EXT = ['.pdf', '.doc', '.docx']

// Retourne un message d'erreur FR, ou '' si le fichier est acceptable.
export function validateCvFile(file: File): string {
  const name = file.name.toLowerCase()
  if (!ALLOWED_EXT.some((ext) => name.endsWith(ext))) {
    return 'Format de fichier non accepté. Formats autorisés : PDF, DOC, DOCX.'
  }
  if (file.size > MAX_BYTES) {
    return 'Le fichier dépasse la taille maximale de 5 Mo.'
  }
  return ''
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (id?: string) => void
      remove: (id?: string) => void
    }
  }
}

let scriptInjected = false

// Widget Turnstile optionnel : rendu seulement si VITE_TURNSTILE_SITE_KEY est
// defini. Sinon, no-op complet (dev / demo).
export function useTurnstile(): {
  turnstileEl: Ref<HTMLElement | null>
  turnstileSiteKey: string
  turnstileToken: Ref<string>
  resetTurnstile: () => void
} {
  const turnstileEl = ref<HTMLElement | null>(null)
  const turnstileToken = ref('')
  const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string) || ''
  let widgetId: string | undefined

  function render() {
    if (!turnstileSiteKey || !turnstileEl.value || !window.turnstile) return
    widgetId = window.turnstile.render(turnstileEl.value, {
      sitekey: turnstileSiteKey,
      callback: (t: string) => { turnstileToken.value = t },
      'expired-callback': () => { turnstileToken.value = '' },
      'error-callback': () => { turnstileToken.value = '' },
      theme: 'light',
    })
  }

  onMounted(() => {
    if (!turnstileSiteKey) return
    if (window.turnstile) { render(); return }
    if (!scriptInjected) {
      scriptInjected = true
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      s.async = true
      s.defer = true
      document.head.appendChild(s)
    }
    const iv = window.setInterval(() => {
      if (window.turnstile) { window.clearInterval(iv); render() }
    }, 200)
    window.setTimeout(() => window.clearInterval(iv), 8000)
  })

  onBeforeUnmount(() => {
    if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
  })

  return {
    turnstileEl,
    turnstileSiteKey,
    turnstileToken,
    resetTurnstile: () => {
      turnstileToken.value = ''
      if (widgetId && window.turnstile) window.turnstile.reset(widgetId)
    },
  }
}
