<template>
  <div class="px-7 py-6">
    <div :class="L.pageHeader">
      <div>
        <div :class="L.pageTitle">Mes candidatures internes</div>
        <div :class="L.pageSub">{{ myApplications.length }} candidature(s)</div>
      </div>
    </div>

    <div v-if="myApplications.length === 0" :class="L.emptyState">
      <Briefcase class="w-8 h-8" />
      <p class="text-[13px]">Vous n'avez été proposé comme candidat interne à aucune offre pour le moment.</p>
    </div>

    <div v-else class="flex flex-col gap-3 mt-2">
      <div v-for="a in myApplications" :key="a.id" :class="[L.card, 'flex items-center justify-between gap-4 flex-wrap']">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-foreground truncate">{{ a.jobOfferTitle }}</div>
          <div class="text-[11px] text-muted-foreground mt-0.5">Proposé le {{ formatDate(a.appliedAt) }}</div>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <StatusPill :status="a.status" />
          <button v-if="canWithdraw(a)" :class="L.btnOutline" @click="withdraw(a)">Me désister</button>
        </div>
      </div>
    </div>

    <p class="text-[11px] text-muted-foreground mt-4">
      Ces candidatures sont proposées par un recruteur depuis une offre publiée. Vous pouvez vous en désister à tout moment tant qu'elle n'est pas encore retenue.
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * Espace employé, module Recrutement (design uniquement, voir
 * src/stores/recruitment) : visibilité des candidatures internes proposées
 * pour cet employé (voir JobOfferCard.vue, "Ajouter un employé comme
 * candidat interne"). Sans cet écran, la personne concernée n'avait aucun
 * moyen de savoir qu'elle avait été proposée — corrige ce trou (voir échange
 * du 29/08).
 */
import { computed } from 'vue'
import { Briefcase } from 'lucide-vue-next'
import StatusPill from '../../components/ui/StatusPill.vue'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { confirmDialog } from '../../lib/confirm'
import { useApplicationStore } from '../../stores/recruitment'
import type { Application } from '../../stores/recruitment'
import { useAuthStore } from '../../stores/auth'

const applicationStore = useApplicationStore()
const auth = useAuthStore()

// Application.employeeId est l'id du salarie (voir applyInternal), qui
// correspond exactement a auth.user.id (construit depuis le meme Employee.Id
// cote backend, voir stores/auth.ts buildAuthUser).
const myApplications = computed(() =>
  applicationStore.items.filter(a => a.source === 'Internal' && a.employeeId === auth.user?.id),
)

function canWithdraw(a: Application): boolean {
  return a.status === 'New' || a.status === 'InReview' || a.status === 'InterviewScheduled'
}
async function withdraw(a: Application) {
  if (await confirmDialog(`Vous désister de la candidature pour "${a.jobOfferTitle}" ?`)) {
    // Note tracee avant le changement de statut : "Rejected" est le seul
    // statut terminal negatif disponible (voir ApplicationStatus), la note
    // distingue un desistement d'un refus decide par le recruteur.
    applicationStore.addNote(a.id, a.candidateName, 'Candidat désisté de sa candidature interne.')
    applicationStore.setStatus(a.id, 'Rejected')
  }
}
</script>
