<template>
  <div class="flex flex-col gap-3">
    <p class="text-[12px] text-muted-foreground">
      À la publication, l'offre est poussée vers les canaux actifs (webhooks de relais Zapier / Make / n8n, e-mail)
      et exposée dans les flux publics
      <a :href="feedJsonUrl" target="_blank" rel="noopener" class="text-primary hover:underline">feed.json</a> /
      <a :href="feedXmlUrl" target="_blank" rel="noopener" class="text-primary hover:underline">feed.xml</a>.
      Les canaux « manuels » sont à publier soi-même puis à marquer comme faits.
    </p>

    <div v-if="loading" class="text-[13px] text-muted-foreground py-3">Chargement...</div>
    <div v-else-if="rows.length === 0" class="text-[13px] text-muted-foreground py-3">
      Aucune diffusion pour cette offre.
      <RouterLink :to="{ name: 'hr-recruitment-distribution' }" class="text-primary hover:underline">Configurer les canaux</RouterLink>.
    </div>

    <div v-else class="border border-border rounded-lg overflow-hidden">
      <table class="w-full border-collapse text-[13px]">
        <thead>
          <tr class="bg-primary/10 text-xs">
            <th class="text-left font-semibold px-3 py-2">Canal</th>
            <th class="text-left font-semibold px-3 py-2">Statut</th>
            <th class="text-left font-semibold px-3 py-2 max-sm:hidden">Détail</th>
            <th class="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in rows" :key="d.id" class="border-t border-border align-middle">
            <td class="px-3 py-2">
              <div class="font-medium text-foreground">{{ d.channelName }}</div>
              <div class="text-[11px] text-muted-foreground">{{ KIND_LABELS[d.channelKind] ?? d.channelKind }} · {{ TRIGGER_LABELS[d.trigger] ?? d.trigger }}</div>
            </td>
            <td class="px-3 py-2">
              <span class="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap" :class="statusClass(d.status)">
                {{ STATUS_LABELS[d.status] ?? d.status }}
              </span>
            </td>
            <td class="px-3 py-2 text-[12px] text-muted-foreground max-sm:hidden">
              <a v-if="d.externalUrl" :href="d.externalUrl" target="_blank" rel="noopener" class="text-primary hover:underline break-all">{{ d.externalUrl }}</a>
              <template v-else-if="d.status === 'Failed'">
                {{ d.httpStatus ? 'HTTP ' + d.httpStatus : 'Échec' }}<template v-if="d.responseSnippet"> · {{ d.responseSnippet }}</template>
                <template v-if="d.attempts"> · {{ d.attempts }} tentative(s)</template>
              </template>
              <span v-else-if="d.lastAttemptAt">{{ formatDateTime(d.lastAttemptAt) }}</span>
              <span v-else>-</span>
            </td>
            <td class="px-3 py-2 text-right whitespace-nowrap">
              <button
                v-if="d.channelKind === 'Webhook' && (d.status === 'Failed' || d.status === 'Sent')"
                :class="miniBtn" @click="retry(d)"
              >
                <RefreshCw class="w-3.5 h-3.5" /> Relancer
              </button>
              <button
                v-if="d.channelKind === 'Manual' || d.channelKind === 'RssOnly'"
                :class="miniBtn" @click="openPost(d)"
              >
                <Link2 class="w-3.5 h-3.5" /> {{ d.status === 'Posted' ? 'Modifier le lien' : 'Marquer publié' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ModalShell :open="postModal.open" title="Marquer comme publié" max-width="max-w-[460px]" @close="postModal.open = false">
      <div :class="cls.field">
        <label :class="cls.fieldLabel">URL de l'annonce publiée</label>
        <input v-model="postModal.url" :class="cls.fieldInput" placeholder="https://www.linkedin.com/jobs/view/..." />
        <p class="text-[11px] text-muted-foreground mt-1">Renseignez le lien de l'annonce que vous avez publiée sur la plateforme.</p>
      </div>
      <div v-if="postModal.error" :class="cls.fieldError">{{ postModal.error }}</div>
      <template #footer>
        <button :class="cls.btnPrimary" @click="confirmPost">Enregistrer</button>
        <button :class="cls.btnOutline" @click="postModal.open = false">Annuler</button>
      </template>
    </ModalShell>
  </div>
</template>

<script setup lang="ts">
/**
 * Suivi de diffusion d'une offre (backlog "Diffusion multi-plateformes").
 * Embarque dans JobOfferCard.vue (section "Diffusion", offre non brouillon).
 * Lignes par canal + relance d'un webhook en echec + saisie du lien pour un
 * canal manuel.
 */
import { reactive, computed, watch, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { RefreshCw, Link2 } from 'lucide-vue-next'
import ModalShell from '../ui/ModalShell.vue'
import * as cls from '../../lib/formClasses'
import { withToast } from '../../lib/withToast'
import { getApiErrorMessage } from '../../lib/api'
import { useDistributionStore } from '../../stores/recruitment'
import type { JobOfferDistribution } from '../../stores/recruitment'

const props = defineProps<{ offerId: string }>()
const store = useDistributionStore()

const loading = ref(false)
const rows = computed(() => store.byOffer[props.offerId] ?? [])

watch(() => props.offerId, load, { immediate: true })
async function load() {
  if (!props.offerId) return
  loading.value = true
  try { await store.fetchForOffer(props.offerId) }
  catch { /* silencieux : la section reste vide */ }
  finally { loading.value = false }
}

const apiBase = (import.meta.env.VITE_API_URL as string) || ''
const feedJsonUrl = computed(() => `${apiBase}/public/careers/feed.json`)
const feedXmlUrl = computed(() => `${apiBase}/public/careers/feed.xml`)

const KIND_LABELS: Record<string, string> = { Webhook: 'Webhook', Email: 'E-mail', Manual: 'Manuel', RssOnly: 'RSS' }
const TRIGGER_LABELS: Record<string, string> = { Publish: 'à la publication', Close: 'à la clôture', Manual: 'manuel' }
const STATUS_LABELS: Record<string, string> = {
  Pending: 'En attente', Sent: 'Envoyé', Failed: 'Échec', Posted: 'Publié', Skipped: 'Ignoré',
}
function statusClass(s: string): string {
  if (s === 'Posted' || s === 'Sent') return 'bg-success-bg text-success'
  if (s === 'Failed') return 'bg-danger-bg text-danger'
  if (s === 'Skipped') return 'bg-neutral-bg text-neutral'
  return 'bg-warning-bg text-warning'
}

const miniBtn = 'inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-border bg-card text-foreground hover:bg-background transition-colors ml-1'

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

async function retry(d: JobOfferDistribution) {
  await withToast('Relance...', () => store.retryDistribution(props.offerId, d.id), () => 'Relance impossible')
}

const postModal = reactive({ open: false, distId: '', url: '', error: '' })
function openPost(d: JobOfferDistribution) {
  Object.assign(postModal, { open: true, distId: d.id, url: d.externalUrl ?? '', error: '' })
}
async function confirmPost() {
  const url = postModal.url.trim()
  if (!/^https?:\/\//i.test(url)) { postModal.error = 'Entrez une URL valide (http ou https)'; return }
  try {
    await store.markPosted(props.offerId, postModal.distId, url)
    postModal.open = false
  } catch (e) {
    postModal.error = getApiErrorMessage(e, 'Enregistrement impossible')
  }
}
</script>
