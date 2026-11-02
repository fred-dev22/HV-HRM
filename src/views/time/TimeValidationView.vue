<template>
  <div class="px-7 py-6 max-w-[1100px] mx-auto w-full">
    <div :class="L.pageHeader">
      <div>
        <div :class="L.pageTitle">Saisies de temps à valider</div>
        <div :class="L.pageSub">Les saisies de votre équipe en attente de votre décision.</div>
      </div>
    </div>

    <div v-if="store.loading" :class="L.emptyState"><ClipboardCheck class="w-8 h-8" /><p class="text-[13px]">Chargement...</p></div>
    <div v-else-if="store.error" :class="L.emptyState"><CircleAlert class="w-8 h-8 text-danger" /><p class="text-[13px]">{{ store.error }}</p></div>
    <div v-else-if="store.pending.length === 0" :class="L.emptyState"><ClipboardCheck class="w-8 h-8" /><p class="text-[13px]">Aucune saisie en attente.</p></div>
    <div v-else :class="L.tableCard">
      <table :class="L.table">
        <thead>
          <tr>
            <th :class="L.th">Employé</th><th :class="L.th">Date</th><th :class="L.th">Type</th>
            <th :class="L.th">Heures</th><th :class="L.th">Commentaire</th><th :class="L.th"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="e in store.pending" :key="e.id">
            <tr :class="L.rowHover">
              <td :class="L.td" class="font-medium">{{ e.employeeName }} <span class="text-muted-foreground font-normal">{{ e.employeeNumber }}</span></td>
              <td :class="L.td" class="whitespace-nowrap">{{ formatDate(e.date) }}</td>
              <td :class="L.td">{{ e.entryType ? ENTRY_TYPE_LABELS[e.entryType] : '-' }}</td>
              <td :class="L.td">{{ e.hours }}</td>
              <td :class="L.td" class="text-muted-foreground">{{ e.comments || '-' }}</td>
              <td :class="L.td" class="text-right whitespace-nowrap">
                <button :class="L.actApprove" class="mr-1.5" @click="approve(e.id)">Approuver</button>
                <button :class="L.actReject" @click="startReject(e.id)">Refuser</button>
              </td>
            </tr>
            <tr v-if="rejectingId === e.id">
              <td :class="L.td" colspan="6">
                <div class="flex items-center gap-2">
                  <input v-model="rejectReason" type="text" maxlength="500" placeholder="Motif du refus (obligatoire)" :class="cls.fieldInput" class="flex-1" />
                  <button :class="L.btnPrimary" :disabled="!rejectReason.trim()" @click="reject(e.id)">Confirmer le refus</button>
                  <button :class="L.btnOutline" @click="rejectingId = null">Annuler</button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
/** Espace validateur : approuver ou refuser (motif obligatoire) les saisies de temps de son equipe. */
import { ref, onMounted } from 'vue'
import { ClipboardCheck, CircleAlert } from 'lucide-vue-next'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { getApiErrorMessage } from '../../lib/api'
import { useToastStore } from '../../stores/toast'
import { useTimeStore, ENTRY_TYPE_LABELS } from '../../stores/time'

const store = useTimeStore()
const toast = useToastStore()
const rejectingId = ref<string | null>(null)
const rejectReason = ref('')

onMounted(() => store.fetchPending())

async function run(label: string, action: () => Promise<unknown>, fallback: string) {
  toast.loading(label)
  try {
    await action()
    toast.success('Effectué avec succès')
    await store.fetchPending()
  } catch (e) {
    toast.error(getApiErrorMessage(e, fallback))
  }
}

const approve = (id: string) => run('Validation...', () => store.approve(id), 'Validation impossible')

function startReject(id: string) {
  rejectingId.value = id
  rejectReason.value = ''
}
async function reject(id: string) {
  await run('Refus...', () => store.reject(id, rejectReason.value.trim()), 'Refus impossible')
  rejectingId.value = null
}
</script>
