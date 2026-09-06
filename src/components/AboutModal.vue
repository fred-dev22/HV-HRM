<script setup lang="ts">
/**
 * Panneau "About" — affiche la version du frontend (figee au build via
 * VITE_APP_VERSION) et celle du serveur API (lue en direct sur GET
 * /version), et signale si elles sont alignees. Sert au deployeur pour
 * confirmer qu'un deploiement a bien pris et que front/back ne sont pas
 * desynchronises.
 */
import { ref, onMounted } from 'vue'
import { CheckCircle2, TriangleAlert, Loader2 } from 'lucide-vue-next'
import ModalShell from './ui/ModalShell.vue'
import { api } from '../lib/api'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '0.0.0'

const status = ref<'loading' | 'ok' | 'error'>('loading')
const serverName = ref('')
const serverVersion = ref('')

async function fetchServerVersion() {
  status.value = 'loading'
  try {
    const { data } = await api.get<{ name: string; version: string }>('/version')
    serverName.value = data.name
    serverVersion.value = data.version
    status.value = 'ok'
  } catch {
    status.value = 'error'
  }
}
onMounted(fetchServerVersion)

const rowClass = 'flex items-center justify-between py-2 border-b border-border last:border-b-0'
const labelClass = 'text-xs text-muted-foreground'
const valueClass = 'text-[13px] font-medium text-foreground'
</script>

<template>
  <ModalShell :open="open" title="À propos" max-width="max-w-[420px]" @close="emit('close')">
    <div>
      <div class="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.05em] mb-1.5">Application</div>
      <div :class="rowClass">
        <span :class="labelClass">Nom</span>
        <span :class="valueClass">Productive 247 HRM</span>
      </div>
      <div :class="rowClass">
        <span :class="labelClass">Version</span>
        <span :class="[valueClass, 'font-mono']">{{ APP_VERSION }}</span>
      </div>
    </div>

    <div class="mt-4">
      <div class="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.05em] mb-1.5">Serveur API</div>
      <div v-if="status === 'loading'" class="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 class="w-3.5 h-3.5 animate-spin" /> Vérification…
      </div>
      <template v-else-if="status === 'ok'">
        <div :class="rowClass">
          <span :class="labelClass">Nom</span>
          <span :class="valueClass">{{ serverName }}</span>
        </div>
        <div :class="rowClass">
          <span :class="labelClass">Version</span>
          <span :class="[valueClass, 'font-mono']">{{ serverVersion }}</span>
        </div>
        <div v-if="serverVersion === APP_VERSION" class="flex items-center gap-1.5 text-[12px] text-success mt-2">
          <CheckCircle2 class="w-3.5 h-3.5 shrink-0" /> Version compatible avec le serveur.
        </div>
        <div v-else class="flex items-center gap-1.5 text-[12px] text-warning mt-2">
          <TriangleAlert class="w-3.5 h-3.5 shrink-0" /> Version différente du serveur. Un redéploiement peut être en cours ou incomplet.
        </div>
      </template>
      <div v-else class="flex items-center gap-1.5 text-[12px] text-danger py-2">
        <TriangleAlert class="w-3.5 h-3.5 shrink-0" /> Impossible de joindre le serveur API.
      </div>
    </div>
  </ModalShell>
</template>
