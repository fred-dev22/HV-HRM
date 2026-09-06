import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ConfirmOptions {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Bouton de confirmation en rouge (action destructive) — true par défaut. */
  danger?: boolean
}

// État global d'une seule boîte de dialogue de confirmation — remplace les
// window.confirm() natifs (moches, non stylés, bloquants) par la même coquille
// visuelle que le reste de l'app (voir ConfirmDialog.vue / ModalShell.vue).
// ask() résout la promesse quand l'utilisateur choisit — le call-site garde
// exactement la même forme qu'avant : `if (!(await confirmDialog(...))) return`.
export const useConfirmDialogStore = defineStore('confirmDialog', () => {
  const open         = ref(false)
  const message      = ref('')
  const title        = ref('Confirmer')
  const confirmLabel = ref('Confirmer')
  const cancelLabel  = ref('Annuler')
  const danger       = ref(true)

  let resolvePromise: ((value: boolean) => void) | null = null

  function ask(msg: string, options: ConfirmOptions = {}): Promise<boolean> {
    message.value      = msg
    title.value        = options.title ?? 'Confirmer'
    confirmLabel.value = options.confirmLabel ?? 'Confirmer'
    cancelLabel.value  = options.cancelLabel ?? 'Annuler'
    danger.value       = options.danger ?? true
    open.value          = true
    return new Promise((resolve) => { resolvePromise = resolve })
  }

  function settle(value: boolean) {
    open.value = false
    resolvePromise?.(value)
    resolvePromise = null
  }

  function confirm() { settle(true) }
  function cancel()  { settle(false) }

  return { open, message, title, confirmLabel, cancelLabel, danger, ask, confirm, cancel }
})
