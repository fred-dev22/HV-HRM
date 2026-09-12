import { ref } from 'vue'

// Empeche un double-clic (ou un clic frenetique) de declencher deux fois la
// meme action — ex: "Ajouter une note" cliquee 3 fois de suite avant que la
// premiere requete revienne creait 3 notes. `submitting` passe a true des le
// declenchement (a lier a :disabled sur le bouton) et repasse a false a la
// fin, succes ou echec ; un second appel pendant que le premier est encore
// en cours est ignore silencieusement plutot que mis en file.
export function useSubmitGuard() {
  const submitting = ref(false)

  async function guard<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (submitting.value) return undefined
    submitting.value = true
    try {
      return await action()
    } finally {
      submitting.value = false
    }
  }

  return { submitting, guard }
}
