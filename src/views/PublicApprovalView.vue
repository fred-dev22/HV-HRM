<template>
  <div class="min-h-screen flex items-center justify-center bg-primary/10 max-[480px]:items-start max-[480px]:p-4 px-4">
    <div class="bg-card rounded-xl p-10 w-full max-w-[480px] shadow-[0_2px_16px_rgba(0,0,0,0.08)] max-[480px]:p-6 max-[480px]:w-[90%] max-[480px]:my-4">

      <div class="flex justify-center mb-4">
        <img src="/hv-logo.png" alt="Productive 247" class="h-14 w-auto" />
      </div>

      <!-- Chargement -->
      <div v-if="loading" class="flex flex-col items-center gap-3 py-6">
        <Loader2 class="w-8 h-8 text-primary animate-spin" />
        <p class="text-[13px] text-muted-foreground">Chargement de la demande…</p>
      </div>

      <!-- Lien invalide / demande introuvable -->
      <div v-else-if="loadError" class="text-center">
        <div class="flex justify-center mb-4">
          <div class="w-14 h-14 rounded-full bg-danger-bg flex items-center justify-center">
            <CircleAlert class="w-7 h-7 text-danger" />
          </div>
        </div>
        <h1 class="text-[20px] font-bold text-foreground mb-2">Lien invalide</h1>
        <p class="text-[13px] text-muted-foreground">{{ loadError }}</p>
      </div>

      <!-- Déjà traitée -->
      <div v-else-if="summary && summary.status === 'AlreadyDecided'" class="text-center">
        <div class="flex justify-center mb-4">
          <div class="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 class="w-7 h-7 text-primary" />
          </div>
        </div>
        <h1 class="text-[20px] font-bold text-foreground mb-2">Demande déjà traitée</h1>
        <p class="text-[13px] text-muted-foreground">
          Cette demande de <strong class="text-foreground">{{ summary.beneficiaryName }}</strong> a déjà été
          {{ decisionLabel(summary.decision) }}{{ summary.decidedAt ? ` le ${summary.decidedAt}` : '' }}.
        </p>
      </div>

      <!-- Décision enregistrée à l'instant -->
      <div v-else-if="done" class="text-center">
        <div class="flex justify-center mb-4">
          <div class="w-14 h-14 rounded-full bg-success-bg flex items-center justify-center">
            <CheckCircle2 class="w-7 h-7 text-success" />
          </div>
        </div>
        <h1 class="text-[20px] font-bold text-foreground mb-2">Merci !</h1>
        <p class="text-[13px] text-muted-foreground">La demande a été {{ decisionLabel(chosenDecision) }} avec succès.</p>
      </div>

      <!-- Formulaire de décision -->
      <template v-else-if="summary">
        <h1 class="text-[18px] font-bold text-foreground text-center mb-1">Demande à valider</h1>
        <p class="text-[13px] text-muted-foreground text-center mb-5">
          {{ summary.beneficiaryName }} — {{ summary.summary }}
        </p>

        <div class="bg-background border border-border rounded-lg px-4 py-3 mb-5">
          <div v-for="d in summary.details" :key="d.label" class="flex justify-between py-1 text-[13px]">
            <span class="text-muted-foreground">{{ d.label }}</span>
            <span class="font-medium text-foreground">{{ d.value }}</span>
          </div>
        </div>

        <p v-if="actionError" class="text-xs text-danger bg-danger-bg px-3 py-2 rounded-md mb-3.5">{{ actionError }}</p>

        <!-- Choix initial : 3 actions -->
        <div v-if="!pendingAction" class="flex flex-col gap-2">
          <button
            class="h-11 bg-success text-white rounded-lg text-sm font-semibold cursor-pointer transition-colors hover:opacity-90 flex items-center justify-center gap-2"
            @click="pendingAction = 'Approved'"
          >
            <Check class="w-4 h-4" /> Approuver
          </button>
          <button
            class="h-11 bg-card border border-border text-foreground rounded-lg text-sm font-semibold cursor-pointer transition-colors hover:bg-background flex items-center justify-center gap-2"
            @click="pendingAction = 'Returned'"
          >
            <Undo2 class="w-4 h-4" /> Retourner pour correction
          </button>
          <button
            class="h-11 bg-card border border-danger/30 text-danger rounded-lg text-sm font-semibold cursor-pointer transition-colors hover:bg-danger-bg flex items-center justify-center gap-2"
            @click="pendingAction = 'Rejected'"
          >
            <X class="w-4 h-4" /> Refuser
          </button>
        </div>

        <!-- Confirmation : approbation directe, ou refus/retour avec commentaire -->
        <div v-else class="flex flex-col gap-2.5">
          <div v-if="pendingAction === 'Approved'" class="bg-success-bg border border-success/20 rounded-lg px-3.5 py-3 text-[13px] text-foreground">
            Vous êtes sur le point d'<strong>approuver</strong> cette demande.
          </div>
          <template v-else>
            <label class="text-[13px] font-medium text-foreground">
              Motif {{ pendingAction === 'Rejected' ? 'du refus' : 'du retour' }} <span class="text-danger">*</span>
            </label>
            <textarea
              v-model="comment"
              rows="3"
              class="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-background text-foreground outline-none focus:border-primary resize-none"
              placeholder="Expliquez la raison…"
            ></textarea>
          </template>
          <div class="flex gap-2 mt-1">
            <button
              class="flex-1 h-11 border border-border rounded-lg text-sm font-semibold cursor-pointer hover:bg-background"
              @click="pendingAction = null; comment = ''; actionError = ''"
            >
              Annuler
            </button>
            <button
              class="flex-1 h-11 rounded-lg text-sm font-semibold cursor-pointer text-white disabled:opacity-60"
              :class="pendingAction === 'Rejected' ? 'bg-danger hover:opacity-90' : pendingAction === 'Approved' ? 'bg-success hover:opacity-90' : 'bg-warning hover:opacity-90'"
              :disabled="submitting"
              @click="confirmDecision"
            >
              {{ submitting ? 'Envoi…' : (pendingAction === 'Approved' ? "Confirmer l'approbation" : 'Confirmer') }}
            </button>
          </div>
        </div>
      </template>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Loader2, CircleAlert, CheckCircle2, Check, X, Undo2 } from 'lucide-vue-next'
import { api, getApiErrorMessage } from '../lib/api'

interface ApprovalDetail { label: string; value: string }
interface ApprovalSummary {
  status: 'Pending' | 'AlreadyDecided'
  kind: 'leave' | 'mission' | 'expense'
  referenceCode: string
  beneficiaryName: string
  summary: string
  details: ApprovalDetail[]
  decision?: string
  decidedAt?: string
}

const route = useRoute()
const token = route.params.token as string

const loading    = ref(true)
const loadError  = ref('')
const summary    = ref<ApprovalSummary | null>(null)

const pendingAction = ref<'Approved' | 'Rejected' | 'Returned' | null>(null)
const comment        = ref('')
const submitting     = ref(false)
const actionError    = ref('')
const done            = ref(false)
const chosenDecision  = ref<'Approved' | 'Rejected' | 'Returned' | null>(null)

function decisionLabel(decision?: string | null): string {
  if (decision === 'Approved') return 'approuvée'
  if (decision === 'Rejected') return 'refusée'
  if (decision === 'Returned') return 'retournée pour correction'
  return 'traitée'
}

onMounted(async () => {
  try {
    const { data } = await api.get<ApprovalSummary>(`/public/approvals/${token}`)
    summary.value = data
    // Bouton d'action cliqué directement depuis le mail (?action=Approved|
    // Rejected|Returned) — pré-sélectionne l'action pour n'avoir plus qu'à
    // confirmer, sans l'exécuter au chargement de la page (voir
    // WorkflowNotifierService.approvalActionButtons : le lien reste un GET
    // sans effet de bord, seul ce clic de confirmation agit réellement).
    const requestedAction = route.query.action
    if (data.status === 'Pending' && (requestedAction === 'Approved' || requestedAction === 'Rejected' || requestedAction === 'Returned')) {
      pendingAction.value = requestedAction
    }
  } catch (err) {
    loadError.value = getApiErrorMessage(err, "Ce lien n'est plus valide.")
  } finally {
    loading.value = false
  }
})

async function confirmDecision() {
  if (!pendingAction.value) return
  if (pendingAction.value !== 'Approved' && comment.value.trim().length === 0) {
    actionError.value = 'Le motif est requis'
    return
  }
  submitting.value = true
  actionError.value = ''
  try {
    const payload = pendingAction.value === 'Approved'
      ? { Decision: 'Approved' as const }
      : { Decision: pendingAction.value, Comment: comment.value.trim() }
    await api.post(`/public/approvals/${token}/decide`, payload)
    chosenDecision.value = pendingAction.value
    done.value = true
  } catch (err) {
    actionError.value = getApiErrorMessage(err, "L'opération a échoué.")
  } finally {
    submitting.value = false
  }
}
</script>
