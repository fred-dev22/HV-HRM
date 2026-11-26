<template>
  <div :class="L.card">
    <div :class="L.cardHeader">
      <div :class="L.cardTitle"><MapPin class="w-4 h-4" /> Sites de travail</div>
      <button :class="L.btnPrimary" @click="open(null)"><Plus class="w-4 h-4" /> Nouveau site</button>
    </div>
    <p class="text-[13px] text-muted-foreground mb-3">
      Les minutes d'un site (trajet et changement) sont retirées à l'arrivée et au départ de ses employés non cadres, avant le calcul des heures
      supplémentaires. Après un changement, relancez le calcul T4 des périodes non payées. Les semaines validées ne changent pas.
    </p>
    <p v-if="store.nonCadresWithoutSite" class="text-[12px] text-warning bg-warning-bg rounded-md px-3 py-2 mb-3">
      {{ store.nonCadresWithoutSite }} employé(s) non cadre(s) sans site : rien n'est retiré pour eux.
    </p>
    <div :class="L.tableCard">
      <table :class="L.table">
        <thead>
          <tr><th :class="L.th">Nom</th><th :class="L.th">Code</th><th :class="L.th">Minutes déduites</th><th :class="L.th">Employés</th><th :class="L.th"></th></tr>
        </thead>
        <tbody>
          <tr v-for="s in store.sites" :key="s.id" :class="L.rowHover">
            <td :class="L.td" class="font-medium">{{ s.name }}</td>
            <td :class="L.td">{{ s.code }}</td>
            <td :class="L.td">{{ s.deductionMinutes }} min</td>
            <td :class="L.td">{{ s.employeeCount }}</td>
            <td :class="L.td" class="text-right whitespace-nowrap">
              <button :class="quickBtn" @click="open(s)">Modifier et rattacher</button>
              <button :class="quickBtn" class="hover:!text-danger" @click="remove(s)">Supprimer</button>
            </td>
          </tr>
          <tr v-if="!store.sites.length"><td :class="L.td" colspan="5" class="text-center text-muted-foreground">{{ loading ? 'Chargement...' : 'Aucun site.' }}</td></tr>
        </tbody>
      </table>
    </div>
    <TimeSiteModal v-if="editing" :site="editing.site" @close="editing = null" />
  </div>
</template>

<script setup lang="ts">
/** Configuration des sites : liste, minutes, rattachement des employes. */
import { ref } from 'vue'
import { MapPin, Plus } from 'lucide-vue-next'
import TimeSiteModal from './TimeSiteModal.vue'
import * as L from '../../lib/listClasses'
import { getApiErrorMessage } from '../../lib/api'
import { confirmDialog } from '../../lib/confirm'
import { useToastStore } from '../../stores/toast'
import { useTimeSiteStore, type TimeSite } from '../../stores/timeSites'

const store = useTimeSiteStore()
const toast = useToastStore()
const quickBtn = 'px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer bg-background text-muted-foreground hover:text-foreground ml-1'

const loading = ref(!store.sites.length)
store.fetchAll()
  .catch((e) => toast.error(getApiErrorMessage(e, 'Chargement des sites impossible')))
  .finally(() => (loading.value = false))

const editing = ref<{ site: TimeSite | null } | null>(null)
function open(site: TimeSite | null) { editing.value = { site } }

async function remove(site: TimeSite) {
  if (!(await confirmDialog(`Supprimer le site ${site.name} ?`))) return
  toast.loading('Suppression...')
  try {
    await store.remove(site.id)
    toast.success('Effectué avec succès')
  } catch (e) {
    toast.error(getApiErrorMessage(e, 'Suppression impossible'))
  }
}
</script>
