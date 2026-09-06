<template>
  <div class="min-h-screen bg-primary/10 flex flex-col items-center py-10 px-4">
    <div class="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.1)] mb-6">
      <img src="/hv-logo.png" alt="HV" class="h-9 w-auto" />
    </div>

    <!-- Candidature envoyee -->
    <div v-if="done" class="bg-card rounded-2xl p-8 w-full max-w-[520px] shadow-[0_4px_24px_rgba(0,0,0,0.08)] text-center">
      <div class="flex justify-center mb-4">
        <div class="w-14 h-14 rounded-full bg-success-bg flex items-center justify-center">
          <CheckCircle2 class="w-7 h-7 text-success" />
        </div>
      </div>
      <h1 class="text-[18px] font-bold text-foreground mb-2">Candidature envoyée</h1>
      <p class="text-[13px] text-muted-foreground mb-5">
        Merci {{ form.candidateName }}, votre candidature spontanée a bien été reçue.
        Notre équipe recrutement la gardera en tête pour une prochaine opportunité correspondant à votre profil.
      </p>
      <router-link :to="{ name: 'public-careers' }" class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary no-underline hover:underline">
        <ArrowLeft class="w-3.5 h-3.5" /> Voir les offres ouvertes
      </router-link>
    </div>

    <!-- Formulaire -->
    <div v-else class="w-full max-w-[560px] flex flex-col gap-4">
      <router-link :to="{ name: 'public-careers' }" class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary no-underline hover:underline self-start">
        <ArrowLeft class="w-3.5 h-3.5" /> Voir toutes les offres
      </router-link>

      <div class="bg-card rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
        <h1 class="text-[18px] font-bold text-foreground">Candidature spontanée</h1>
        <p class="text-[13px] text-muted-foreground mt-1.5">
          Aucune offre ne correspond exactement à votre profil ? Envoyez-nous votre CV, nous le gardons pour une prochaine opportunité chez HV.
        </p>

        <div class="h-px bg-border my-4"></div>

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
 * Candidature spontanee, portail carriere public (sans connexion, voir
 * router/index.ts) — pas d'offre a choisir, contrairement a
 * PublicJobApplicationView.vue dont ce fichier reprend le formulaire et le
 * style a l'identique. Design uniquement : le depot de CV ne retient que le
 * nom du fichier (applicationStore.applySpontaneous), pas d'upload reel.
 */
import { ref, reactive } from 'vue'
import {
  CheckCircle2, ArrowLeft, UserRound, Mail, Phone, FileText, UploadCloud, FileCheck2,
} from 'lucide-vue-next'
import { useApplicationStore } from '../../stores/recruitment'

const applicationStore = useApplicationStore()

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
  error.value = ''
  applicationStore.applySpontaneous({
    candidateName: form.candidateName.trim(), candidateEmail: form.candidateEmail.trim(),
    candidatePhone: form.candidatePhone.trim(), cvFileName: form.cvFileName,
  })
  done.value = true
}
</script>
