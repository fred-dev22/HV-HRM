<template>
  <div class="px-7 py-6">
    <div :class="L.pageHeader">
      <div>
        <div :class="L.pageTitle">Diffusion des offres</div>
        <div :class="L.pageSub">
          {{ store.channels.length }} canal(aux). Les offres publiées alimentent aussi les flux publics
          <a :href="feedJsonUrl" target="_blank" rel="noopener" class="text-primary hover:underline">feed.json</a>
          et
          <a :href="feedXmlUrl" target="_blank" rel="noopener" class="text-primary hover:underline">feed.xml</a>.
        </div>
      </div>
      <button :class="L.btnPrimary" @click="openNew">
        <Plus class="w-4 h-4" /> Nouveau canal
      </button>
    </div>

    <div v-if="store.loading" :class="L.emptyState">
      <Rss class="w-8 h-8" /><p class="text-[13px]">Chargement...</p>
    </div>
    <div v-else-if="store.channels.length > 0" class="grid grid-cols-3 gap-3.5 max-lg:grid-cols-2 max-sm:grid-cols-1">
      <div v-for="c in store.channels" :key="c.id" :class="[L.card, 'flex flex-col gap-2.5']">
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm font-semibold text-foreground truncate">{{ c.name }}</span>
          <span class="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap" :class="c.isActive ? 'bg-success-bg text-success' : 'bg-neutral-bg text-neutral'">
            {{ KIND_LABELS[c.kind] }}{{ c.isActive ? '' : ' (inactif)' }}
          </span>
        </div>
        <p v-if="c.kind === 'Webhook'" class="text-[12px] text-muted-foreground truncate font-mono">{{ c.targetUrl }}</p>
        <p v-else-if="c.kind === 'Email'" class="text-[12px] text-muted-foreground truncate">{{ c.targetEmail }}</p>
        <p v-else class="text-[12px] text-muted-foreground italic">Suivi manuel (le RH colle l'URL de l'annonce après publication).</p>
        <p v-if="c.hasSecret" class="text-[11px] text-muted-foreground">Signature HMAC activée.</p>
        <div class="flex items-center gap-2 mt-auto pt-1 flex-wrap">
          <button :class="L.btnOutline" @click="openEdit(c)"><Pencil class="w-3.5 h-3.5" /> Modifier</button>
          <button v-if="c.kind === 'Webhook'" :class="L.btnOutline" @click="test(c)"><Send class="w-3.5 h-3.5" /> Tester</button>
          <button :class="[L.btnOutline, 'text-danger']" @click="remove(c)"><Trash2 class="w-3.5 h-3.5" /> Supprimer</button>
        </div>
      </div>
    </div>
    <div v-else :class="L.emptyState">
      <Rss class="w-8 h-8" />
      <p class="text-[13px]">Aucun canal de diffusion. Ajoutez un webhook (relais Zapier / Make / n8n vers LinkedIn & co) ou un canal manuel.</p>
    </div>

    <ModalShell :open="modal.open" :title="modal.id ? 'Modifier le canal' : 'Nouveau canal de diffusion'" max-width="max-w-[520px]" @close="modal.open = false">
      <div :class="cls.field">
        <label :class="cls.fieldLabel">Nom *</label>
        <input v-model="modal.name" :class="cls.fieldInput" placeholder="ex : LinkedIn (via Make)" />
      </div>
      <div :class="cls.field" class="mt-3">
        <label :class="cls.fieldLabel">Type *</label>
        <select v-model="modal.kind" :class="cls.fieldSelect">
          <option value="Webhook">Webhook (relais Zapier / Make / n8n)</option>
          <option value="Email">E-mail (liste interne / cabinet)</option>
          <option value="Manual">Suivi manuel</option>
          <option value="RssOnly">Flux RSS uniquement</option>
        </select>
      </div>
      <div v-if="modal.kind === 'Webhook'" class="mt-3 flex flex-col gap-3">
        <div :class="cls.field">
          <label :class="cls.fieldLabel">URL cible *</label>
          <input v-model="modal.targetUrl" :class="cls.fieldInput" placeholder="https://hook.eu2.make.com/..." />
        </div>
        <div :class="cls.field">
          <label :class="cls.fieldLabel">Secret de signature <span :class="cls.fieldOptional">(optionnel)</span></label>
          <input v-model="modal.secret" :class="cls.fieldInput" :placeholder="modal.hasSecret ? 'Secret défini, laisser vide pour conserver' : 'Signe le corps en HMAC-SHA256'" />
        </div>
      </div>
      <div v-else-if="modal.kind === 'Email'" :class="cls.field" class="mt-3">
        <label :class="cls.fieldLabel">Destinataire *</label>
        <input v-model="modal.targetEmail" type="email" :class="cls.fieldInput" placeholder="recrutement@cabinet.mg" />
      </div>
      <label class="flex items-center gap-2 text-[13px] text-foreground mt-3">
        <input v-model="modal.isActive" type="checkbox" /> Canal actif
      </label>
      <div v-if="modal.error" :class="cls.fieldError">{{ modal.error }}</div>
      <template #footer>
        <button :class="cls.btnPrimary" :disabled="submitting" @click="save">{{ modal.id ? 'Enregistrer' : 'Créer' }}</button>
        <button :class="cls.btnOutline" :disabled="submitting" @click="modal.open = false">Annuler</button>
      </template>
    </ModalShell>
  </div>
</template>

<script setup lang="ts">
/**
 * Canaux de diffusion des offres (backlog "Diffusion multi-plateformes").
 * Pas d'API tierce : webhooks sortants (relais Zapier / Make / n8n), e-mail,
 * suivi manuel, + les flux publics feed.json / feed.xml tirables par les
 * agregateurs.
 */
import { reactive, computed, onMounted } from 'vue'
import { Plus, Pencil, Trash2, Send, Rss } from 'lucide-vue-next'
import ModalShell from '../../components/ui/ModalShell.vue'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { confirmDialog } from '../../lib/confirm'
import { withToast } from '../../lib/withToast'
import { useSubmitGuard } from '../../lib/submitGuard'
import { useToastStore } from '../../stores/toast'
import { getApiErrorMessage } from '../../lib/api'
import { useDistributionStore } from '../../stores/recruitment'
import type { DistributionChannel } from '../../stores/recruitment'

const store = useDistributionStore()
const toast = useToastStore()
onMounted(() => store.fetchChannels())

const KIND_LABELS: Record<string, string> = {
  Webhook: 'Webhook', Email: 'E-mail', Manual: 'Manuel', RssOnly: 'RSS',
}

const apiBase = (import.meta.env.VITE_API_URL as string) || ''
const feedJsonUrl = computed(() => `${apiBase}/public/careers/feed.json`)
const feedXmlUrl = computed(() => `${apiBase}/public/careers/feed.xml`)

const modal = reactive({
  open: false, id: '' as string, name: '', kind: 'Webhook' as DistributionChannel['kind'],
  targetUrl: '', targetEmail: '', secret: '', hasSecret: false, isActive: true, error: '',
})

function openNew() {
  Object.assign(modal, { open: true, id: '', name: '', kind: 'Webhook', targetUrl: '', targetEmail: '', secret: '', hasSecret: false, isActive: true, error: '' })
}
function openEdit(c: DistributionChannel) {
  Object.assign(modal, {
    open: true, id: c.id, name: c.name, kind: c.kind,
    targetUrl: c.targetUrl ?? '', targetEmail: c.targetEmail ?? '', secret: '',
    hasSecret: c.hasSecret, isActive: c.isActive, error: '',
  })
}

const { submitting, guard } = useSubmitGuard()
async function save() {
  if (!modal.name.trim()) { modal.error = 'Le nom est requis'; return }
  if (modal.kind === 'Webhook' && !modal.targetUrl.trim()) { modal.error = "L'URL cible est requise"; return }
  if (modal.kind === 'Email' && !modal.targetEmail.trim()) { modal.error = 'Le destinataire est requis'; return }
  try {
    const payload = {
      name: modal.name.trim(), kind: modal.kind,
      targetUrl: modal.kind === 'Webhook' ? modal.targetUrl.trim() : undefined,
      targetEmail: modal.kind === 'Email' ? modal.targetEmail.trim() : undefined,
      secret: modal.secret.trim() || undefined,
      isActive: modal.isActive,
    }
    await guard(() => withToast(
      'Enregistrement...',
      () => modal.id ? store.updateChannel(modal.id, payload) : store.createChannel(payload),
      () => 'Enregistrement impossible',
    ))
    modal.open = false
  } catch (e) {
    modal.error = getApiErrorMessage(e, 'Enregistrement impossible')
  }
}
async function remove(c: DistributionChannel) {
  if (await confirmDialog(`Supprimer le canal « ${c.name} » ?`)) {
    await withToast('Suppression...', () => store.removeChannel(c.id), () => 'Suppression impossible')
  }
}
async function test(c: DistributionChannel) {
  try {
    const r = await store.testChannel(c.id)
    toast.success(r.ok ? `Webhook OK (HTTP ${r.httpStatus ?? '?'})` : `Échec (HTTP ${r.httpStatus ?? '?'}) : ${r.snippet ?? ''}`)
  } catch (e) {
    toast.error(getApiErrorMessage(e, 'Test impossible'))
  }
}
</script>
