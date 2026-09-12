<script setup lang="ts">
/**
 * Actions d'une candidature : changement de statut libre (piloté à la main
 * par le RH, pas de circuit) et ajout au vivier de talents. Réutilisé dans
 * les actions contextuelles de la liste, l'aperçu rapide et la fiche
 * complète (ApplicationCard).
 */
import { Star } from 'lucide-vue-next'
import { confirmDialog } from '../../lib/confirm'
import { withToast } from '../../lib/withToast'
import { useApplicationStore } from '../../stores/recruitment'
import type { Application, ApplicationStatus } from '../../stores/recruitment'

const props = defineProps<{ item: Application }>()
const applicationStore = useApplicationStore()

const selectCls =
  'h-7 px-2 border border-border rounded-md bg-background text-xs text-foreground outline-none cursor-pointer transition-colors focus:border-primary'
const btn = 'px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer whitespace-nowrap inline-flex items-center gap-1 transition-colors'
const poolCls = btn + ' bg-warning-bg text-warning hover:brightness-95'

async function onStatusChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value as ApplicationStatus
  await withToast('Mise à jour…', () => applicationStore.setStatus(props.item.id, value), () => 'Changement de statut impossible')
}

async function addToPool() {
  if (await confirmDialog(`Ajouter ${props.item.candidateName} au vivier de talents ?`, { danger: false })) {
    await withToast(
      'Ajout au vivier…',
      () => applicationStore.addToTalentPool(props.item.id),
      () => 'Ajout au vivier impossible',
    )
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
