<script setup lang="ts">
/**
 * Bande d'alerte affichée en haut de l'application tant qu'un réglage de
 * l'application manque : envoi d'emails, stockage des fichiers. UNE seule bande
 * liste tout ce qui manque (jamais deux bandes empilées, jamais une seule à la
 * fois, ce qui cacherait l'autre problème). Deux messages :
 *  - le compte administrateur de l'application voit un bouton par réglage
 *    manquant, vers l'écran correspondant des Paramètres ;
 *  - les autres utilisateurs sont seulement prévenus de ce qui ne fonctionne
 *    pas, et de contacter l'administrateur.
 * L'état vient de GET /mail-settings/status et GET /storage-settings/status
 * (ouverts à tout utilisateur connecté), relus quand l'onglet reprend le focus :
 * la bande disparaît donc chez tout le monde peu après la configuration.
 */
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TriangleAlert } from 'lucide-vue-next'
import { useMailSettingsStore } from '../stores/mailSettings'
import { useStorageSettingsStore } from '../stores/storageSettings'

const mail = useMailSettingsStore()
const storage = useStorageSettingsStore()
const router = useRouter()
const route = useRoute()

const isAdmin = computed(() => mail.canConfigure === true || storage.canConfigure === true)

// Uniquement quand le serveur a répondu "non configuré" : jamais pendant le chargement.
const missing = computed(() => {
  const items: { key: string; routeName: string; button: string; admin: string; user: string }[] = []
  if (mail.configured === false) {
    items.push({
      key: 'mail', routeName: 'settings-mail', button: 'Configurer la messagerie',
      admin: "l'envoi d'emails",
      user: "les emails (validations, création de comptes)",
    })
  }
  if (storage.configured === false) {
    items.push({
      key: 'storage', routeName: 'settings-storage', button: 'Configurer le stockage',
      admin: 'le stockage des fichiers',
      user: "l'envoi de justificatifs et de pièces jointes",
    })
  }
  return items
})

function joined(list: string[]): string {
  return list.length <= 1 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} et ${list[list.length - 1]}`
}

const adminText = computed(() => joined(missing.value.map((m) => m.admin)))
const userText = computed(() => joined(missing.value.map((m) => m.user)))

function refresh() {
  if (document.visibilityState === 'visible') {
    mail.fetchStatus()
    storage.fetchStatus()
  }
}

onMounted(() => {
  refresh()
  document.addEventListener('visibilitychange', refresh)
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', refresh))
</script>

<template>
  <div
    v-if="missing.length"
    role="alert"
    class="shrink-0 flex items-center gap-3 px-5 py-2 bg-warning-bg text-warning text-[13px] border-b border-border max-md:flex-wrap"
  >
    <TriangleAlert class="w-4 h-4 shrink-0" />
    <p v-if="isAdmin" class="flex-1 min-w-0">
      <strong class="font-semibold">Configuration incomplète : {{ adminText }}.</strong>
      <template v-if="mail.configured === false"> Aucun email ne part tant qu'un mode d'envoi n'est pas choisi.</template>
      <template v-if="storage.configured === false"> Aucun fichier ne peut être envoyé tant qu'un stockage n'est pas choisi.</template>
    </p>
    <p v-else class="flex-1 min-w-0">
      Certaines fonctions ne marchent pas pour le moment : {{ userText }}.
      Veuillez contacter l'administrateur.
    </p>
    <template v-if="isAdmin">
      <button
        v-for="m in missing.filter((x) => route.name !== x.routeName)"
        :key="m.key"
        class="shrink-0 px-3 py-1 rounded-md bg-warning text-white text-xs font-medium cursor-pointer hover:brightness-95"
        @click="router.push({ name: m.routeName })"
      >
        {{ m.button }}
      </button>
    </template>
  </div>
</template>
