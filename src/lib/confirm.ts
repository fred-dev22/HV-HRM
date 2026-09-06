import { useConfirmDialogStore, type ConfirmOptions } from '../stores/confirmDialog'

// Remplacement direct de window.confirm() — même usage (`if (!(await confirmDialog(...))) return`)
// mais passe par la boîte de dialogue stylée de l'app (voir ConfirmDialog.vue).
export function confirmDialog(message: string, options?: ConfirmOptions): Promise<boolean> {
  return useConfirmDialogStore().ask(message, options)
}
