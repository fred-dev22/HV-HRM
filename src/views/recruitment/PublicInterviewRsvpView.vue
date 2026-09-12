<template>
  <div class="min-h-screen flex items-center justify-center bg-primary/10 max-[480px]:items-start max-[480px]:p-4 px-4">
    <div class="bg-card rounded-xl p-10 w-full max-w-[480px] shadow-[0_2px_16px_rgba(0,0,0,0.08)] max-[480px]:p-6 max-[480px]:w-[90%] max-[480px]:my-4">

      <div class="flex justify-center mb-4">
        <img src="/hv-logo.png" alt="Productive 247" class="h-14 w-auto" />
      </div>

      <!-- Chargement -->
      <div v-if="loading" class="flex flex-col items-center gap-3 py-6">
        <Loader2 class="w-8 h-8 text-primary animate-spin" />
        <p class="text-[13px] text-muted-foreground">Chargement de l'invitation...</p>
      </div>

      <!-- Lien invalide -->
      <div v-else-if="loadError" class="text-center">
        <div class="flex justify-center mb-4">
          <div class="w-14 h-14 rounded-full bg-danger-bg flex items-center justify-center">
            <CircleAlert class="w-7 h-7 text-danger" />
          </div>
        </div>
        <h1 class="text-[20px] font-bold text-foreground mb-2">Lien invalide</h1>
        <p class="text-[13px] text-muted-foreground">{{ loadError }}</p>
      </div>

      <!-- Entretien annule -->
      <div v-else-if="summary && summary.interviewStatus === 'Cancelled'" class="text-center">
        <div class="flex justify-center mb-4">
          <div class="w-14 h-14 rounded-full bg-danger-bg flex items-center justify-center">
            <Ban class="w-7 h-7 text-danger" />
          </div>
        </div>
        <h1 class="text-[20px] font-bold text-foreground mb-2">Entretien annulé</h1>
        <p class="text-[13px] text-muted-foreground">
          L'entretien pour <strong class="text-foreground">{{ summary.jobOfferTitle }}</strong> a été annulé. Aucune réponse n'est nécessaire.
        </p>
      </div>

      <!-- Reponse enregistree -->
      <div v-else-if="done" class="text-center">
        <div class="flex justify-center mb-4">
          <div class="w-14 h-14 rounded-full bg-success-bg flex items-center justify-center">
            <CheckCircle2 class="w-7 h-7 text-success" />
          </div>
        </div>
        <h1 class="text-[20px] font-bold text-foreground mb-2">Merci !</h1>
        <p class="text-[13px] text-muted-foreground">Votre réponse ({{ responseLabel(chosen) }}) a bien été enregistrée. Vous pouvez la modifier depuis ce même lien.</p>
      </div>

      <!-- Choix -->
      <div v-else-if="summary" class="text-center">
        <h1 class="text-[18px] font-bold text-foreground mb-1">Invitation à un entretien</h1>
        <p class="text-[13px] text-muted-foreground mb-4">
          Bonjour {{ summary.recipientName }}, confirmez votre présence à l'entretien pour
          <strong class="text-foreground">{{ summary.jobOfferTitle }}</strong>.
        </p>
        <div class="bg-background border border-border rounded-lg p-3 text-left text-[12px] flex flex-col gap-1 mb-5">
          <div><span class="text-muted-foreground">Date : </span>{{ formattedDate }}</div>
          <div><span class="text-muted-foreground">{{ summary.mode === 'VideoCall' ? 'Lien : ' : 'Lieu : ' }}</span>{{ summary.place }}</div>
          <div v-if="summary.currentResponse !== 'Pending'">
            <span class="text-muted-foreground">Réponse actuelle : </span>{{ responseLabel(summary.currentResponse) }}
          </div>
        </div>
        <p v-if="suggested" class="text-[12px] text-muted-foreground mb-2">
          Confirmez votre réponse en cliquant sur un bouton ci-dessous.
        </p>
        <div class="flex flex-col gap-2">
          <button :class="btn('Accepted', suggested === 'accepted')" @click="respond('accepted')"><Check class="w-4 h-4" /> J'accepte</button>
          <button :class="btn('Tentative', suggested === 'tentative')" @click="respond('tentative')"><HelpCircle class="w-4 h-4" /> Peut-être</button>
          <button :class="btn('Declined', suggested === 'declined')" @click="respond('declined')"><X class="w-4 h-4" /> Je refuse</button>
        </div>
        <p v-if="submitError" class="text-xs text-danger bg-danger-bg px-3 py-2 rounded-md mt-4">{{ submitError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Page publique de reponse a une invitation d'entretien (RSVP). Aucune
 * connexion : le jeton opaque de l'URL identifie le destinataire (candidat
 * ou participant). Le GET est purement en lecture (anti-scanner) ; seul le
 * clic d'un bouton enregistre la reponse. Calquee sur PublicApprovalView.vue.
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Loader2, CircleAlert, CheckCircle2, Ban, Check, X, HelpCircle } from 'lucide-vue-next'
import { api, getApiErrorMessage } from '../../lib/api'

interface RsvpSummary {
  scope: 'participant' | 'candidate'
  recipientName: string
  jobOfferTitle: string
  scheduledAt: string
  mode: string
  place: string
  interviewStatus: 'Scheduled' | 'Done' | 'Cancelled'
  currentResponse: 'Pending' | 'Accepted' | 'Declined' | 'Tentative'
  respondedAt?: string
}

const route = useRoute()
const token = String(route.params.token)
// Bouton clique directement depuis le mail (?response=accepted|declined|
// tentative) : on met en avant le choix suggere sans l'envoyer au chargement
// (le GET reste sans effet de bord, seul le clic de confirmation agit).
const suggested = ['accepted', 'declined', 'tentative'].includes(String(route.query.response))
  ? (String(route.query.response) as 'accepted' | 'declined' | 'tentative')
  : null

const loading = ref(true)
const loadError = ref('')
const summary = ref<RsvpSummary | null>(null)
const done = ref(false)
const chosen = ref<'accepted' | 'declined' | 'tentative'>('accepted')
const submitError = ref('')

const formattedDate = computed(() =>
  summary.value ? new Date(summary.value.scheduledAt).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' }) : '',
)

function responseLabel(r: string): string {
  return r === 'Accepted' || r === 'accepted' ? 'accepté'
    : r === 'Declined' || r === 'declined' ? 'refusé'
    : r === 'Tentative' || r === 'tentative' ? 'peut-être'
    : 'en attente'
}

function btn(target: string, highlight = false): string {
  const base = 'w-full h-11 rounded-lg text-sm font-semibold cursor-pointer inline-flex items-center justify-center gap-2 border transition-colors'
  const active = summary.value?.currentResponse === target || highlight
  return `${base} ${active ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-background text-foreground hover:border-primary/40'}`
}

onMounted(async () => {
  try {
    const { data } = await api.get<RsvpSummary>(`/public/interview-rsvp/${token}`)
    summary.value = data
  } catch (e) {
    loadError.value = getApiErrorMessage(e, "Ce lien de réponse n'existe pas ou n'est plus valide.")
  } finally {
    loading.value = false
  }
})

async function respond(r: 'accepted' | 'declined' | 'tentative') {
  submitError.value = ''
  chosen.value = r
  try {
    await api.post(`/public/interview-rsvp/${token}`, { Response: r })
    done.value = true
  } catch (e) {
    submitError.value = getApiErrorMessage(e, "L'enregistrement a échoué, merci de réessayer.")
  }
}
</script>
