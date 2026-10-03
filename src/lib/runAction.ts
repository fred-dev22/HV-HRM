import { getApiErrorMessage } from './api'
import { withToast } from './withToast'
import { useToastStore } from '../stores/toast'

// Chargement initial d'un ecran Formation : lance les fetchAll en parallele et
// affiche un seul message d'erreur (celui du serveur) si l'un d'eux echoue.
export async function loadAll(...fetches: Array<() => Promise<unknown>>): Promise<void> {
  const results = await Promise.allSettled(fetches.map(f => f()))
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
  if (failed) useToastStore().error(getApiErrorMessage(failed.reason, 'Chargement impossible'))
}

// Pour les boutons d'action directs (sans formulaire) : affiche le snackbar de
// chargement puis succes, ou le message renvoye par le serveur en cas d'echec
// (ex. "Cette session est complete"). Ne leve jamais : retourne undefined si
// l'action a echoue, pour pouvoir etre appele depuis un @click sans try/catch.
export async function runAction<T>(
  loadingMessage: string,
  action: () => Promise<T>,
  fallbackError: string,
): Promise<T | undefined> {
  let message = fallbackError
  try {
    return await withToast(loadingMessage, async () => {
      try {
        return await action()
      } catch (e) {
        message = getApiErrorMessage(e, fallbackError)
        throw e
      }
    }, () => message)
  } catch {
    return undefined
  }
}
