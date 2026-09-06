<template>
  <div class="min-h-screen bg-primary/10">
    <div class="bg-gradient-to-b from-primary to-primary/85 px-6 py-12 flex flex-col items-center text-center">
      <div class="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.15)] mb-5">
        <img src="/hv-logo.png" alt="HV" class="h-10 w-auto" />
      </div>
      <h1 class="text-[26px] font-bold text-primary-foreground">Rejoignez nos équipes</h1>
      <p class="text-[13px] text-primary-foreground/80 mt-1.5 max-w-md">
        Découvrez les offres d'emploi actuellement ouvertes chez HV et postulez en quelques clics.
      </p>
    </div>

    <div class="max-w-3xl mx-auto px-4 -mt-6 pb-12">
      <div v-if="offers.length === 0" class="bg-card border border-dashed border-border rounded-xl p-10 text-center text-muted-foreground shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
        <Briefcase class="w-8 h-8 mx-auto mb-2" />
        <p class="text-[13px]">Aucune offre n'est ouverte pour le moment. Revenez bientôt.</p>
      </div>

      <div v-else class="flex flex-col gap-4">
        <router-link
          v-for="offer in offers" :key="offer.id"
          :to="{ name: 'public-careers-offer', params: { id: offer.id } }"
          class="group relative flex flex-col bg-card border border-border rounded-xl p-5 pl-6 no-underline text-inherit overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 hover:border-primary/30"
        >
          <span class="absolute inset-y-0 left-0 w-1.5 bg-primary scale-y-0 group-hover:scale-y-100 origin-center transition-transform duration-200"></span>

          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="text-[16px] font-bold text-foreground truncate group-hover:text-primary transition-colors">{{ offer.title }}</h2>
              <div class="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[12px] text-muted-foreground">
                <span class="inline-flex items-center gap-1"><Building2 class="w-3.5 h-3.5 shrink-0" /> {{ offer.entityName }}</span>
                <span class="inline-flex items-center gap-1"><MapPin class="w-3.5 h-3.5 shrink-0" /> {{ offer.location }}</span>
              </div>
            </div>
            <span class="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary whitespace-nowrap">
              <Briefcase class="w-3 h-3" /> {{ offer.contractType }}
            </span>
          </div>

          <p class="text-[13px] text-foreground/80 mt-3.5 line-clamp-2">{{ offer.description }}</p>

          <div class="flex items-center gap-1.5 text-[13px] font-semibold text-primary mt-4">
            Voir l'offre et postuler
            <ArrowRight class="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
          </div>
        </router-link>
      </div>

      <div class="bg-card border border-dashed border-border rounded-xl p-6 mt-4 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p class="text-[13px] text-foreground/80">Vous ne trouvez pas l'offre qui vous correspond ?</p>
        <router-link
          :to="{ name: 'public-careers-spontaneous' }"
          class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary no-underline mt-1.5 hover:underline"
        >
          Postuler spontanément <ArrowRight class="w-3.5 h-3.5" />
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Portail carriere public (sans connexion, voir router/index.ts : ni
 * requiresAuth ni layout dashboard). Liste uniquement les offres au statut
 * Published — les autres statuts ne sont pas destines a un visiteur externe.
 * Design uniquement (donnees fictives, voir src/stores/recruitment).
 */
import { computed } from 'vue'
import { Briefcase, ArrowRight, Building2, MapPin } from 'lucide-vue-next'
import { useJobOfferStore } from '../../stores/recruitment'

const jobOfferStore = useJobOfferStore()
const offers = computed(() => jobOfferStore.published)
</script>
