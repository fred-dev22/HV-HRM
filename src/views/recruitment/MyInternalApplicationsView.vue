<template>
  <div class="px-7 py-6">
    <div :class="L.pageHeader">
      <div>
        <div :class="L.pageTitle">Mes candidatures internes</div>
        <div :class="L.pageSub">Postulez en interne aux offres publiées et suivez vos candidatures.</div>
      </div>
    </div>

    <!-- Offres ouvertes à la candidature interne -->
    <div class="mt-2">
      <div class="text-[13px] font-semibold text-foreground mb-2">Offres ouvertes</div>
      <div v-if="openOffers.length === 0" :class="L.emptyState">
        <Briefcase class="w-8 h-8" />
        <p class="text-[13px]">Aucune offre publiée pour le moment.</p>
      </div>
      <div v-else class="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        <div v-for="o in openOffers" :key="o.id" :class="[L.card, 'flex flex-col gap-2']">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="text-sm font-semibold text-foreground truncate">{{ o.title }}</div>
              <div class="text-[11px] text-muted-foreground mt-0.5">{{ o.entityName }} · {{ o.contractType }} · {{ o.location }}</div>
            </div>
            <span class="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap bg-primary/10 text-primary shrink-0">{{ o.referenceCode }}</span>
          </div>
          <p class="text-[12px] text-muted-foreground line-clamp-2">{{ o.description }}</p>
          <button
            :class="alreadyApplied(o.title) ? L.btnOutline : L.btnPrimary"
            class="self-start"
            :disabled="alreadyApplied(o.title)"
            @click="apply(o)"
          >
            <Send class="w-3.5 h-3.5" /> {{ alreadyApplied(o.title) ? 'Déjà postulé' : 'Postuler en interne' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Mes candidatures -->
    <div class="mt-6">
      <div class="text-[13px] font-semibold text-foreground mb-2">Mes candidatures ({{ myApplications.length }})</div>
      <div v-if="myApplications.length === 0" :class="L.emptyState">
        <Briefcase class="w-8 h-8" />
        <p class="text-[13px]">Vous n'avez encore postulé à aucune offre en interne.</p>
      </div>
      <div v-else class="flex flex-col gap-3">
        <div v-for="a in myApplications" :key="a.id" :class="[L.card, 'flex items-center justify-between gap-4 flex-wrap']">
          <div class="min-w-0">
            <div class="text-sm font-semibold text-foreground truncate">{{ a.jobOfferTitle }}</div>
            <div class="text-[11px] text-muted-foreground mt-0.5">Candidature du {{ formatDate(a.appliedAt) }}</div>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <StatusPill :status="a.status" />
            <button v-if="canWithdraw(a)" :class="L.btnOutline" @click="withdraw(a)">Me désister</button>
          </div>
        </div>
      </div>
    </div>

    <p class="text-[11px] text-muted-foreground mt-4">
      Une candidature interne peut être retirée tant qu'elle n'a pas été retenue par le recruteur.
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * Espace employé, module Recrutement (US12) : l'employé postule lui-même en
 * interne à une offre publiée, depuis son espace, et suit ses candidatures.
 * Ne nécessite aucune permission recrutement.
 */
import { computed, onMounted } from 'vue'
import { Briefcase, Send } from 'lucide-vue-next'
import StatusPill from '../../components/ui/StatusPill.vue'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { confirmDialog } from '../../lib/confirm'
import { withToast } from '../../lib/withToast'
import { useApplicationStore } from '../../stores/recruitment'
import type { Application } from '../../stores/recruitment'

const applicationStore = useApplicationStore()

onMounted(() => {
  applicationStore.fetchMyInternal()
  applicationStore.fetchOpenInternalOffers()
})

const myApplications = computed(() => applicationStore.myInternal)
const openOffers = computed(() => applicationStore.openInternalOffers)

function alreadyApplied(offerTitle: string): boolean {
  return applicationStore.myInternal.some(
    (a) => a.jobOfferTitle === offerTitle && a.status !== 'Rejected',
  )
}

async function apply(o: { id: string; title: string }) {
  if (await confirmDialog(`Postuler en interne à l'offre "${o.title}" ?`, { danger: false })) {
    await withToast('Envoi de la candidature…', () => applicationStore.selfApplyInternal(o.id), () => 'Candidature impossible')
    await applicationStore.fetchMyInternal()
  }
}

function canWithdraw(a: Application): boolean {
  return a.status === 'New' || a.status === 'InReview' || a.status === 'InterviewScheduled'
}
async function withdraw(a: Application) {
  if (await confirmDialog(`Vous désister de la candidature pour "${a.jobOfferTitle}" ?`, { danger: false })) {
    await withToast('Désistement…', () => applicationStore.withdrawInternal(a.id), () => 'Désistement impossible')
  }
}
</script>
