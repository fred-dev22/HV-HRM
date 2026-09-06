<template>
  <div class="min-h-screen bg-primary/10 flex flex-col items-center py-10 px-4">
    <div class="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.1)] mb-6">
      <img src="/hv-logo.png" alt="HV" class="h-9 w-auto" />
    </div>

    <!-- Offre introuvable / non publiee -->
    <div v-if="!offer" class="bg-card rounded-2xl p-8 w-full max-w-[520px] shadow-[0_4px_24px_rgba(0,0,0,0.08)] text-center">
      <div class="flex justify-center mb-4">
        <div class="w-14 h-14 rounded-full bg-danger-bg flex items-center justify-center">
          <CircleAlert class="w-7 h-7 text-danger" />
        </div>
      </div>
      <h1 class="text-[18px] font-bold text-foreground mb-2">Offre introuvable</h1>
      <p class="text-[13px] text-muted-foreground mb-5">Cette offre n'existe plus ou n'est plus ouverte aux candidatures.</p>
      <router-link :to="{ name: 'public-careers' }" class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary no-underline hover:underline">
        <ArrowLeft class="w-3.5 h-3.5" /> Voir toutes les offres
      </router-link>
    </div>

    <!-- Candidature envoyee -->
    <div v-else-if="done" class="bg-card rounded-2xl p-8 w-full max-w-[520px] shadow-[0_4px_24px_rgba(0,0,0,0.08)] text-center">
      <div class="flex justify-center mb-4">
        <div class="w-14 h-14 rounded-full bg-success-bg flex items-center justify-center">
          <CheckCircle2 class="w-7 h-7 text-success" />
        </div>
      </div>
      <h1 class="text-[18px] font-bold text-foreground mb-2">Candidature envoyée</h1>
      <p class="text-[13px] text-muted-foreground mb-5">
        Merci {{ form.candidateName }}, votre candidature pour <strong class="text-foreground">{{ offer.title }}</strong> a bien été reçue.
        Notre équipe recrutement reviendra vers vous si votre profil correspond.
      </p>
      <router-link :to="{ name: 'public-careers' }" class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary no-underline hover:underline">
        <ArrowLeft class="w-3.5 h-3.5" /> Voir toutes les offres
      </router-link>
    </div>

    <!-- Offre + formulaire -->
    <div v-else class="w-full max-w-[560px] flex flex-col gap-4">
      <router-link :to="{ name: 'public-careers' }" class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary no-underline hover:underline self-start">
        <ArrowLeft class="w-3.5 h-3.5" /> Voir toutes les offres
      </router-link>

      <div class="bg-card rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
        <div class="flex items-start justify-between gap-3">
          <h1 class="text-[20px] font-bold text-foreground">{{ offer.title }}</h1>
          <span class="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary whitespace-nowrap">
            <Briefcase class="w-3 h-3" /> {{ offer.contractType }}
          </span>
        </div>
        <div class="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-[12px] text-muted-foreground">
          <span class="inline-flex items-center gap-1"><Building2 class="w-3.5 h-3.5 shrink-0" /> {{ offer.entityName }}</span>
          <span class="inline-flex items-center gap-1"><MapPin class="w-3.5 h-3.5 shrink-0" /> {{ offer.location }}</span>
        </div>
        <div class="h-px bg-border my-4"></div>
        <p class="text-[13px] text-foreground/90 whitespace-pre-line leading-relaxed">{{ offer.description }}</p>
      </div>

      <div class="bg-card rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
        <h2 class="text-[15px] font-bold text-foreground mb-4">Postuler à cette offre</h2>

        <div class="flex flex-col gap-3.5">
          <div>
            <label :class="labelClass"><UserRound class="w-3.5 h-3.5" /> Nom complet <span class="text-danger">*</span></label>
            <input v-model="form.candidateName" :class="inputClass" placeholder="Prénom et nom" />
          </div>
          <div>
            <label :class="labelClass"><Mail class="w-3.5 h-3.5" /> Email <span class="text-danger">*</span></label>
            <input v-model="form.candidateEmail" type="email" :class="inputClass" placeholder="vous@exemple.com" />
          </div>
          <div>
            <label :class="labelClass"><Phone class="w-3.5 h-3.5" /> Téléphone <span class="text-danger">*</span></label>
            <input v-model="form.candidatePhone" :class="inputClass" placeholder="034 00 000 00" />
          </div>

          <div>
            <label :class="labelClass"><FileText class="w-3.5 h-3.5" /> CV <span class="text-danger">*</span></label>

            <label
              class="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-xl py-7 px-4 text-center transition-colors cursor-pointer"
              :class="dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-background'"
              @dragover.prevent="dragOver = true"
              @dragleave.prevent="dragOver = false"
              @drop.prevent="onDrop"
            >
              <div class="w-9 h-9 rounded-full flex items-center justify-center" :class="form.cvFileName ? 'bg-success-bg' : 'bg-primary/10'">
                <FileCheck2 v-if="form.cvFileName" class="w-4.5 h-4.5 text-success" />
                <UploadCloud v-else class="w-4.5 h-4.5 text-primary" />
              </div>
              <span v-if="form.cvFileName" class="text-[13px] font-medium text-foreground">{{ form.cvFileName }}</span>
              <span v-else class="text-[13px] font-medium text-foreground">Glissez votre CV ici, ou cliquez pour parcourir</span>
              <span class="text-[11px] text-muted-foreground">{{ form.cvFileName ? 'Cliquez pour remplacer le fichier' : 'PDF ou Word' }}</span>
              <input type="file" accept=".pdf,.doc,.docx" class="hidden" @change="onFileInput" />
            </label>
          </div>
        </div>

        <p v-if="error" class="text-xs text-danger bg-danger-bg px-3 py-2 rounded-md mt-4">{{ error }}</p>

        <button
          class="w-full h-12 bg-primary text-primary-foreground rounded-lg text-sm font-semibold cursor-pointer transition-colors hover:bg-primary/90 mt-5"
          @click="submit"
        >
          Envoyer ma candidature
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Fiche d'une offre + formulaire de candidature, portail carriere public
 * (sans connexion, voir router/index.ts). N'affiche l'offre que si elle est
 * au statut Published — memes raisons que PublicCareersView.vue. Design
 * uniquement : le depot de CV ne fait que retenir le nom du fichier
 * (applicationStore.apply), pas d'upload reel (pas de backend sur ce
 * module). Zone de glisser-deposer calquee sur celle d'ImportWizardModal.vue
 * pour rester coherente avec le reste de l'app.
 */
import { ref, reactive, computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  CircleAlert, CheckCircle2, ArrowLeft, Briefcase, Building2, MapPin,
  UserRound, Mail, Phone, FileText, UploadCloud, FileCheck2,
} from 'lucide-vue-next'
import { useJobOfferStore, useApplicationStore } from '../../stores/recruitment'

const route = useRoute()
const jobOfferStore = useJobOfferStore()
const applicationStore = useApplicationStore()

const offer = computed(() => jobOfferStore.items.find(o => o.id === route.params.id && o.status === 'Published') ?? null)

const labelClass = 'flex items-center gap-1.5 text-[13px] font-medium text-foreground mb-1.5'
const inputClass = 'w-full h-11 px-3 border border-border rounded-lg text-sm bg-background text-foreground outline-none transition-colors focus:border-primary'

const form = reactive({ candidateName: '', candidateEmail: '', candidatePhone: '', cvFileName: '' })
const error = ref('')
const done = ref(false)
const dragOver = ref(false)

function setFile(file: File | undefined) {
  if (!file) return
  form.cvFileName = file.name
}
function onFileInput(e: Event) { setFile((e.target as HTMLInputElement).files?.[0]) }
function onDrop(e: DragEvent) { dragOver.value = false; setFile(e.dataTransfer?.files?.[0]) }

function submit() {
  if (!form.candidateName.trim() || !form.candidateEmail.trim() || !form.candidatePhone.trim()) {
    error.value = 'Merci de remplir tous les champs obligatoires.'
    return
  }
  if (!form.cvFileName) {
    error.value = 'Merci de joindre votre CV.'
    return
  }
  if (!offer.value) return
  error.value = ''
  applicationStore.apply({
    jobOfferId: offer.value.id, jobOfferTitle: offer.value.title,
    candidateName: form.candidateName.trim(), candidateEmail: form.candidateEmail.trim(),
    candidatePhone: form.candidatePhone.trim(), cvFileName: form.cvFileName,
  })
  done.value = true
}
</script>
