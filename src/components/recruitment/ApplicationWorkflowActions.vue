<script setup lang="ts">
/**
 * Actions de workflow d'une candidature : changement de statut et ajout au
 * vivier de talents. Ce n'est pas un circuit d'approbation classique (pas de
 * validateur, pas de commentaire de retour), mais le composant est réutilisé
 * de la même façon dans les actions contextuelles de la liste, l'aperçu
 * rapide ET la fiche complète (ApplicationCard). Calqué sur
 * MissionWorkflowActions / HiringRequestWorkflowActions.
 */
import { Star } from 'lucide-vue-next'
import { confirmDialog } from '../../lib/confirm'
import { useApplicationStore } from '../../stores/recruitment'
import type { Application, ApplicationStatus } from '../../stores/recruitment'

const props = defineProps<{ item: Application }>()
const applicationStore = useApplicationStore()

const selectCls =
  'h-7 px-2 border border-border rounded-md bg-background text-xs text-foreground outline-none cursor-pointer transition-colors focus:border-primary'
const btn = 'px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer whitespace-nowrap inline-flex items-center gap-1 transition-colors'
const poolCls = btn + ' bg-warning-bg text-warning hover:brightness-95'

function onStatusChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value as ApplicationStatus
  applicationStore.setStatus(props.item.id, value)
}

async function addToPool() {
  if (await confirmDialog(`Ajouter ${props.item.candidateName} au vivier de talents ?`)) {
    applicationStore.addToTalentPool(props.item.id)
  }
}
</script>

<template>
  <div class="flex items-center gap-1.5 flex-wrap">
    <select :class="selectCls" :value="item.status" title="Statut de la candidature" @change="onStatusChange">
      <option value="New">Nouvelle</option>
      <option value="InReview">En cours</option>
      <option value="InterviewScheduled">Entretien planifié</option>
      <option value="Retained">Retenue</option>
      <option value="Rejected">Refusé</option>
    </select>
    <button v-if="item.status !== 'Retained'" :class="poolCls" @click="addToPool">
      <Star class="w-3.5 h-3.5" /> Ajouter au vivier
    </button>
  </div>
</template>
