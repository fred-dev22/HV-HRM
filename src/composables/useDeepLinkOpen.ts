import type { Ref } from 'vue'
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// Ouvre automatiquement la fiche d'un element au chargement d'une liste si
// l'URL porte `?open=<id>` — utilise par les notifications et les emails
// pour deep-linker directement sur l'element concerne plutot que sur la
// liste generale (voir workflow-notifier.service.ts hrefMine/hrefToValidate).
// A appeler APRES que le fetch qui alimente la liste ait resolu, sinon la
// fiche s'ouvrirait sur un id introuvable dans une liste encore vide.
//
// Surveille aussi les changements ulterieurs de la query (watch ci-dessous) :
// naviguer vers une route deja active (ex. cliquer une notif en etant deja
// sur /employee/absences) ne remonte pas le composant, donc onMounted seul
// ne suffit pas a rouvrir une seconde fiche.
export function useDeepLinkOpen(openIdRef: Ref<string | null>) {
  const route = useRoute()
  const router = useRouter()

  function applyDeepLink() {
    const id = route.query.open
    if (typeof id !== 'string' || !id) return
    openIdRef.value = id
    // Retire le parametre de l'URL une fois consomme — un rechargement
    // manuel ne doit pas rouvrir la fiche a chaque fois.
    const { open, ...rest } = route.query
    void open
    router.replace({ query: rest })
  }

  watch(() => route.query.open, (id) => { if (id) applyDeepLink() })

  return { applyDeepLink }
}
