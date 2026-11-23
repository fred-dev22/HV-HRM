<script setup lang="ts">
/**
 * Bande d'alerte affichée en haut de l'application tant que l'envoi d'emails
 * n'est pas configuré. Deux messages :
 *  - le compte administrateur de l'application voit un bouton vers
 *    Paramètres > Messagerie ;
 *  - les autres utilisateurs sont seulement prévenus que les actions qui
 *    envoient un email ne fonctionnent pas, et de contacter l'administrateur.
 * L'état vient de GET /mail-settings/status (ouvert à tout utilisateur
 * connecté), relu quand l'onglet reprend le focus : la bande disparaît donc
 * chez tout le monde peu après la configuration.
 */
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TriangleAlert } from 'lucide-vue-next'
import { useMailSettingsStore } from '../stores/mailSettings'

const mail = useMailSettingsStore()
const router = useRouter()
const route = useRoute()

const isAdmin = computed(() => mail.canConfigure === true)
// Uniquement quand le serveur a répondu "non configuré" : jamais pendant le chargement.
const visible = computed(() => mail.configured === false)

function refresh() {
  if (document.visibilityState === 'visible') mail.fetchStatus()
}

onMounted(() => {
  mail.fetchStatus()
  document.addEventListener('visibilitychange', refresh)
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', refresh))
</script>

<template>
  <div
    v-if="visible"
    role="alert"
    class="shrink-0 flex items-center gap-3 px-5 py-2 bg-warning-bg text-warning text-[13px] border-b border-border"
  >
    <TriangleAlert class="w-4 h-4 shrink-0" />
    <p v-if="isAdmin" class="flex-1 min-w-0">
      <strong class="font-semibold">L'envoi d'emails n'est pas configuré.</strong>
      Aucun email (validations, création de comptes, justificatifs) ne part tant qu'un mode n'est pas choisi.
    </p>
    <p v-else class="flex-1 min-w-0">
      Les actions qui envoient un email (validation d'une demande, création de compte, etc.) ne fonctionnent pas pour le moment.
      Veuillez contacter l'administrateur.
    </p>
    <button
      v-if="isAdmin && route.name !== 'settings-mail'"
      class="shrink-0 px-3 py-1 rounded-md bg-warning text-white text-xs font-medium cursor-pointer hover:brightness-95"
      @click="router.push({ name: 'settings-mail' })"
    >
      Configurer maintenant
    </button>
  </div>
</template>
