import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastStatus = 'loading' | 'success' | 'error'

// État global d'un seul snackbar (bas-droite) — reflète une action backend en
// cours (POST/PATCH/DELETE). N'affiche jamais un résultat avant que l'API
// n'ait réellement répondu : voir withToast() dans lib/withToast.ts, qui
// bascule la même barre sur un message de confirmation en cas de succès, ou
// la fait virer au rouge sur échec — jamais fermée puis rouverte, seul le
// texte/statut change en place.
export const useToastStore = defineStore('toast', () => {
  const visible = ref(false)
  const message = ref('')
  const status  = ref<ToastStatus>('loading')

  let hideTimer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
  }

  function loading(text: string) {
    clearTimer()
    message.value = text
    status.value  = 'loading'
    visible.value = true
  }

  function hide() {
    clearTimer()
    visible.value = false
  }

  // Masque après un délai, annulable — si un nouvel appel loading()/error()/
  // hideAfter() survient avant l'échéance, clearTimer() l'annule (via ces
  // mêmes fonctions), évitant qu'un minuteur d'une action terminée ne masque
  // le snackbar d'une action suivante déjà en cours.
  function hideAfter(ms: number) {
    clearTimer()
    hideTimer = setTimeout(() => { visible.value = false }, ms)
  }

  function success(text: string) {
    message.value = text
    status.value  = 'success'
    visible.value = true
    hideAfter(2000)
  }

  function error(text: string) {
    message.value = text
    status.value  = 'error'
    visible.value = true
    hideAfter(5000)
  }

  return { visible, message, status, loading, hide, hideAfter, success, error }
})
