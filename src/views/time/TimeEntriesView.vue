<template>
  <div class="px-7 py-6 max-w-[1100px] mx-auto w-full">
    <div :class="L.pageHeader">
      <div>
        <div :class="L.pageTitle">Mes saisies de temps</div>
        <div :class="L.pageSub">
          Missions, réunions extérieures, panier et permanence. Chaque saisie est validée par votre validateur.
          Saisie possible jusqu'à la fin du mois concerné.
        </div>
      </div>
    </div>

    <!-- Nouvelle saisie -->
    <form class="bg-card border border-border rounded-lg p-3.5 mb-4 flex items-end gap-3 flex-wrap" @submit.prevent="submit">
      <div :class="cls.field">
        <label :class="cls.fieldLabel">Date</label>
        <input v-model="form.date" type="date" required :class="cls.fieldInput" />
      </div>
      <div :class="cls.field">
        <label :class="cls.fieldLabel">Type</label>
        <select v-model="form.entryType" :class="cls.fieldSelect">
          <option v-for="(label, key) in ENTRY_TYPE_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
      </div>
      <div :class="cls.field">
        <label :class="cls.fieldLabel">Heures</label>
        <input v-model.number="form.hours" type="number" min="0.25" max="24" step="0.25" required :class="cls.fieldInput" class="!w-24 shrink-0" />
      </div>
      <div :class="cls.field" class="flex-1 min-w-[200px]">
        <label :class="cls.fieldLabel">Commentaire <span :class="cls.fieldOptional">(facultatif)</span></label>
        <input v-model="form.comments" type="text" maxlength="500" :class="cls.fieldInput" />
      </div>
      <button type="submit" :class="L.btnPrimary" :disabled="saving"><Plus class="w-4 h-4" /> Enregistrer</button>
    </form>

    <!-- Feuille de temps de la periode -->
    <div class="flex items-end gap-3 flex-wrap mb-3">
      <div :class="cls.field">
        <label :class="cls.fieldLabel">Du</label>
        <input v-model="from" type="date" :class="cls.fieldInput" />
      </div>
      <div :class="cls.field">
        <label :class="cls.fieldLabel">Au</label>
        <input v-model="to" type="date" :class="cls.fieldInput" />
      </div>
      <button :class="L.btnOutline" @click="reload"><Search class="w-4 h-4" /> Afficher</button>
    </div>

    <div v-if="sheet" class="grid grid-cols-4 gap-3 mb-4 max-sm:grid-cols-2">
      <div v-for="s in summary" :key="s.label" :class="L.card">
        <div class="text-[11px] text-muted-foreground">{{ s.label }}</div>
        <div class="text-lg font-semibold" :class="s.tone">{{ s.value }} h</div>
      </div>
    </div>

    <div :class="L.tableCard" class="mb-5">
      <table :class="L.table">
        <thead>
          <tr>
            <th :class="L.th">Date</th><th :class="L.th">Type</th><th :class="L.th">Heures</th>
            <th :class="L.th">Statut</th><th :class="L.th">Commentaire</th><th :class="L.th"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="store.myEntries.length === 0">
            <td :class="L.td" colspan="6" class="text-center text-muted-foreground">Aucune saisie sur cette période.</td>
          </tr>
          <tr v-for="e in store.myEntries" :key="e.id" :class="L.rowHover">
            <td :class="L.td" class="whitespace-nowrap">{{ formatDate(e.date) }}</td>
            <td :class="L.td">{{ e.entryType ? ENTRY_TYPE_LABELS[e.entryType] : '-' }}</td>
            <td :class="L.td">{{ e.hours }}</td>
            <td :class="L.td">
              <span class="text-[11px] font-medium px-2 py-0.5 rounded-full" :class="statusClass(e.status)">{{ ENTRY_STATUS_LABELS[e.status] }}</span>
            </td>
            <td :class="L.td" class="text-muted-foreground">{{ e.status === 'Rejected' && e.rejectionReason ? `Refusée : ${e.rejectionReason}` : e.comments || '-' }}</td>
            <td :class="L.td" class="text-right">
              <button v-if="e.status === 'Pending'" :class="L.actReject" @click="cancel(e.id)">Annuler</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <template v-if="sheet">
      <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Feuille de temps (pointeuse)</div>
      <div :class="L.tableCard">
        <table :class="L.table">
          <thead>
            <tr>
              <th :class="L.th">Date</th><th :class="L.th">Entrée</th><th :class="L.th">Sortie</th>
              <th :class="L.th">Prévu</th><th :class="L.th">Travaillé</th><th :class="L.th">Heures supp.</th><th :class="L.th">Absence</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in sheet.days" :key="d.date" :class="L.rowHover">
              <td :class="L.td" class="whitespace-nowrap">{{ formatDate(d.date) }}</td>
              <td :class="L.td">{{ clock(d.in) }}</td>
              <td :class="L.td">{{ clock(d.out) }}</td>
              <td :class="L.td">{{ d.required }}</td>
              <td :class="L.td">{{ d.worked }}</td>
              <td :class="[L.td, d.overtime > 0 ? 'text-success font-medium' : '']">{{ d.overtime }}</td>
              <td :class="[L.td, d.absence > 0 ? 'text-danger font-medium' : '']">{{ d.absence }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Espace employe : saisie de ses temps (mission, reunion, panier, permanence)
 * et consultation de sa feuille de temps issue de la pointeuse.
 */
import { ref, computed, onMounted } from 'vue'
import { Plus, Search } from 'lucide-vue-next'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { formatDate, todayIso } from '../../lib/date'
import { getApiErrorMessage } from '../../lib/api'
import { useToastStore } from '../../stores/toast'
import { useTimeStore, ENTRY_TYPE_LABELS, ENTRY_STATUS_LABELS, type TimeEntryType, type Timesheet } from '../../stores/time'

const store = useTimeStore()
const toast = useToastStore()

const today = todayIso()
const from = ref(`${today.slice(0, 8)}01`)
const to = ref(today)
const sheet = ref<Timesheet | null>(null)
const saving = ref(false)
const form = ref({ date: today, entryType: 'mission' as TimeEntryType, hours: 8, comments: '' })

const summary = computed(() => {
  const s = sheet.value?.summary
  if (!s) return []
  return [
    { label: 'Prévu', value: s.required, tone: '' },
    { label: 'Travaillé', value: s.worked, tone: '' },
    { label: 'Heures supplémentaires', value: s.overtime, tone: 'text-success' },
    { label: 'Absences', value: s.absence, tone: s.absence > 0 ? 'text-danger' : '' },
  ]
})

async function reload() {
  await store.fetchMine(from.value, to.value)
  try {
    sheet.value = await store.fetchTimesheet(from.value, to.value)
  } catch {
    sheet.value = null // pas de pointage pour cet employe : la feuille reste vide
  }
}
onMounted(reload)

async function run(label: string, action: () => Promise<unknown>, fallback: string) {
  toast.loading(label)
  try {
    await action()
    toast.success('Effectué avec succès')
    return true
  } catch (e) {
    toast.error(getApiErrorMessage(e, fallback))
    return false
  }
}

async function submit() {
  saving.value = true
  const ok = await run('Enregistrement...', () => store.create({
    Date: form.value.date,
    Hours: form.value.hours,
    EntryType: form.value.entryType,
    Comments: form.value.comments || undefined,
  }), "Enregistrement impossible")
  saving.value = false
  if (ok) {
    form.value.comments = ''
    await reload()
  }
}

async function cancel(id: string) {
  if (await run('Annulation...', () => store.cancel(id), 'Annulation impossible')) await reload()
}

function statusClass(status: string) {
  if (status === 'Approved') return 'bg-success-bg text-success'
  if (status === 'Rejected') return 'bg-danger-bg text-danger'
  if (status === 'Cancelled') return 'bg-neutral-bg text-neutral'
  return 'bg-warning-bg text-warning'
}

function clock(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-'
}
</script>
