import { useToastStore } from '../stores/toast'

// Enrobe un appel backend : affiche le snackbar pendant l'attente, bascule
// sur un message de confirmation si l'API réussit, ou sur un message
// d'erreur si elle échoue — jamais fermée puis rouverte, seul le texte/
// statut de la même barre change en place. Dès que la réponse arrive, le
// résultat est rendu à l'appelant IMMÉDIATEMENT (rien n'attend le snackbar),
// sans retarder la fermeture du popup ni la mise à jour de la liste.
// getErrorMessage est appelé APRÈS le catch interne de l'appelant (donc
// après que error.value a été renseigné côté store) pour réutiliser son
// message. Message de succès volontairement générique et identique partout
// (voir stores/toast.ts) : un seul comportement uniforme dans toute l'app,
// pas un texte à personnaliser par appelant.
const SUCCESS_MESSAGE = 'Effectué avec succès'

export async function withToast<T>(
  loadingMessage: string,
  action: () => Promise<T>,
  getErrorMessage: () => string,
): Promise<T> {
  const toast = useToastStore()
  toast.loading(loadingMessage)
  try {
    const result = await action()
    toast.success(SUCCESS_MESSAGE)
    return result
  } catch (err) {
    toast.error(getErrorMessage())
    throw err
  }
}
