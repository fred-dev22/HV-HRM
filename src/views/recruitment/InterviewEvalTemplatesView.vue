<template>
  <div class="px-7 py-6">
    <div :class="L.pageHeader">
      <div>
        <div :class="L.pageTitle">Grilles d'évaluation d'entretien</div>
        <div :class="L.pageSub">{{ store.items.length }} grille(s) · rattachables à une offre d'emploi</div>
      </div>
      <button :class="L.btnPrimary" @click="showCreate = true">
        <Plus class="w-4 h-4" /> Nouvelle grille
      </button>
    </div>

    <div v-if="store.loading" class="grid grid-cols-3 gap-3.5 max-lg:grid-cols-2 max-sm:grid-cols-1 animate-pulse" role="status" aria-busy="true" aria-label="Chargement en cours">
      <div v-for="i in 3" :key="i" :class="[L.card, 'flex flex-col gap-2.5']">
        <div class="flex items-center justify-between gap-2">
          <div class="h-4 bg-muted rounded" style="width: 55%"></div>
          <div class="h-4 bg-muted rounded-full" style="width: 70px"></div>
        </div>
        <div class="h-2.5 bg-muted rounded" style="width: 80%"></div>
        <div class="h-2.5 bg-muted rounded" style="width: 70%"></div>
        <div class="h-2.5 bg-muted rounded" style="width: 60%"></div>
        <div class="h-7 bg-muted rounded mt-auto" style="width: 100px"></div>
      </div>
    </div>
    <div v-else-if="store.items.length > 0" class="grid grid-cols-3 gap-3.5 max-lg:grid-cols-2 max-sm:grid-cols-1">
      <div v-for="t in store.items" :key="t.id" :class="[L.card, 'flex flex-col gap-2.5 cursor-pointer']" @click="openCardId = t.id">
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm font-semibold text-foreground truncate">{{ t.name }}</span>
          <span class="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap bg-primary/10 text-primary shrink-0">
            {{ t.criteria.length }} critère(s)
          </span>
        </div>
        <ul class="text-[12px] text-muted-foreground list-disc pl-4 space-y-0.5">
          <li v-for="(c, i) in t.criteria.slice(0, 5)" :key="i">{{ c }}</li>
          <li v-if="t.criteria.length > 5" class="list-none text-[11px]">+ {{ t.criteria.length - 5 }} autres</li>
        </ul>
        <div class="mt-auto pt-1">
          <button :class="L.btnOutline" @click.stop="openCardId = t.id"><FileText class="w-3.5 h-3.5" /> Ouvrir la fiche</button>
        </div>
        <p v-if="t.jobOffersCount" class="text-[11px] text-muted-foreground">Rattachée à {{ t.jobOffersCount }} offre(s).</p>
      </div>
    </div>
    <div v-else :class="L.emptyState">
      <ClipboardCheck class="w-8 h-8" />
      <p class="text-[13px]">Aucune grille d'évaluation. Créez-en une pour standardiser vos entretiens.</p>
    </div>

    <!-- Création — même coquille que partout ailleurs dans le module -->
    <CreateModalShell
      v-if="showCreate"
      title="Nouvelle grille d'évaluation"
      banner-label="Nouvelle grille d'évaluation"
      create-label="Créer"
      :is-saving="submitting"
      :save-error="error"
      @close="showCreate = false"
      @create="create"
    >
      <template #form>
        <div class="flex-1 overflow-auto px-6 py-5">
          <div class="max-w-3xl mx-auto">
            <FormSection title="Grille">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Nom de la grille <span class="text-danger">*</span></label>
                <input v-model="form.name" :class="cls.fieldInput" placeholder="ex : Grille poste terrain" />
              </div>
              <div :class="cls.field" class="mt-3">
                <label :class="cls.fieldLabel">Critères (un par ligne) <span class="text-danger">*</span></label>
                <textarea
                  v-model="form.criteriaText"
                  :class="cls.fieldTextarea"
                  rows="6"
                  placeholder="Compétences techniques&#10;Communication&#10;Motivation&#10;Adéquation culturelle"
                ></textarea>
                <p class="text-[11px] text-muted-foreground mt-1">Chaque critère sera noté de 0 à 5 lors de l'évaluation ; la note globale est la moyenne.</p>
              </div>
            </FormSection>
          </div>
        </div>
      </template>
    </CreateModalShell>

    <!-- Fiche (clic sur une carte ou "Ouvrir la fiche") -->
    <EvalTemplateCard v-if="openCardId !== null" :items="store.items" :item-id="openCardId" @close="openCardId = null" />
  </div>
</template>

<script setup lang="ts">
/**
 * Gestion des grilles d'évaluation d'entretien (US15) — le RH crée des jeux
 * de critères réutilisables, rattachables à une offre d'emploi (voir
 * JobOffersView.vue). Proposées par défaut lors de l'évaluation des
 * entretiens de cette offre (voir InterviewWorkflowActions.vue).
 *
 * Création via CreateModalShell + consultation/édition via une fiche à part
 * (EvalTemplateCard, pattern ContractTemplateCard) — même schéma que le
 * reste du module Recrutement (demande du 11/09 : rester uniforme, plus de
 * petite ModalShell partagée entre création et édition).
 */
import { ref, reactive, onMounted } from 'vue'
import { Plus, ClipboardCheck, FileText } from 'lucide-vue-next'
import { CreateModalShell } from '../../components'
import FormSection from '../../components/ui/form-field/FormSection.vue'
import EvalTemplateCard from '../../components/recruitment/EvalTemplateCard.vue'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { withToast } from '../../lib/withToast'
import { useSubmitGuard } from '../../lib/submitGuard'
import { getApiErrorMessage } from '../../lib/api'
import { useEvalTemplateStore } from '../../stores/recruitment'

const store = useEvalTemplateStore()
onMounted(() => store.fetchAll())

const openCardId = ref<string | null>(null)

/* ── Création ───────────────────────────────────────────────── */
const showCreate = ref(false)
const error = ref<string | null>(null)
const form = reactive({ name: '', criteriaText: '' })

function resetForm() {
  Object.assign(form, { name: '', criteriaText: '' })
  error.value = null
}

const { submitting, guard } = useSubmitGuard()
async function create() {
  const name = form.name.trim()
  const criteria = form.criteriaText.split('\n').map(c => c.trim()).filter(Boolean)
  if (!name) { error.value = 'Le nom est requis'; return }
  if (criteria.length === 0) { error.value = 'Ajoutez au moins un critère'; return }
  try {
    await guard(() => withToast('Création...', () => store.create({ name, criteria }), () => 'Enregistrement impossible'))
    showCreate.value = false
    resetForm()
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Enregistrement impossible')
  }
}
</script>
