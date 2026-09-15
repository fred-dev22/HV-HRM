<template>
  <div class="px-7 py-6">

        <!-- En-tête -->
        <div :class="L.pageHeader">
          <div>
            <div :class="L.pageTitle">{{ isEditMode ? 'Modifier l\'entité' : 'Nouvelle entité' }}</div>
            <div :class="L.pageSub" v-if="isEditMode">{{ editEntity?.name }}</div>
          </div>
          <router-link :to="{ name: 'hr-entities' }" :class="L.btnOutline">
            <ArrowLeft class="w-4 h-4" /> Annuler
          </router-link>
        </div>

        <div v-if="formLoading" class="flex justify-center">
          <div class="w-full max-w-[800px]">
            <SkeletonLoader type="form" :lines="8" />
          </div>
        </div>

        <div v-else class="flex justify-center">
          <div class="w-full max-w-[800px] bg-card border border-border rounded-lg p-6 flex flex-col gap-6">

            <!-- ── Section 1 : Informations générales ── -->
            <div class="flex flex-col gap-3.5">
              <div :class="sectionTitle"><Building class="w-4 h-4 text-primary" /> Informations générales</div>
              <div :class="fieldGrid">
                <div :class="[cls.field, 'col-span-full']">
                  <label :class="cls.fieldLabel">Intitulé *</label>
                  <input v-model="form.name" :class="[cls.fieldInput, errors.name && cls.inputError]" placeholder="ex: Direction des Ressources Humaines" />
                  <div v-if="errors.name" :class="cls.fieldError">{{ errors.name }}</div>
                </div>

                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Code * <span :class="hint">(max 10 car.)</span></label>
                  <input v-model="form.code" :class="[cls.fieldInput, errors.code && cls.inputError]" placeholder="ex: DRH" maxlength="10" @input="form.code = form.code.toUpperCase()" />
                  <div v-if="errors.code" :class="cls.fieldError">{{ errors.code }}</div>
                </div>

                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Type *</label>
                  <select v-if="!isRootEntity" v-model="form.type" :class="[cls.fieldSelect, errors.type && cls.inputError]">
                    <option value="">-- Choisir un type --</option>
                    <option value="Direction">Direction</option>
                    <option value="Department">Département</option>
                    <option value="Service">Service</option>
                  </select>
                  <div v-else :class="[cls.fieldInput, 'flex items-center bg-background']">{{ form.type }}</div>
                  <div v-if="errors.type" :class="cls.fieldError">{{ errors.type }}</div>
                </div>

                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Entité parente</label>
                  <select v-if="!isRootEntity" v-model="form.parentId" :class="cls.fieldSelect">
                    <option value="">Aucune (entité racine)</option>
                    <option v-for="e in parentOptions" :key="e.id" :value="e.id">{{ e.code }} · {{ e.name }}</option>
                  </select>
                  <div v-else :class="[cls.fieldInput, 'flex items-center bg-background']">Racine</div>
                </div>

                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Identifiant légal <span :class="hint">(optionnel)</span></label>
                  <input v-model="form.legalIdentifier" :class="cls.fieldInput" placeholder="ex: GPL-001" />
                </div>

                <div :class="[cls.field, 'col-span-full']">
                  <label :class="cls.fieldLabel">Adresse <span :class="hint">(optionnel)</span></label>
                  <textarea v-model="form.address" :class="cls.fieldTextarea" rows="2" placeholder="Adresse physique de l'entité…"></textarea>
                </div>
              </div>
            </div>

            <!-- ── Section 2 : Contact & Responsable ── -->
            <div class="flex flex-col gap-3.5">
              <div :class="sectionTitle"><User class="w-4 h-4 text-primary" /> Contact & Responsable</div>
              <div :class="fieldGrid">
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Responsable</label>
                  <select v-model="form.managerId" :class="cls.fieldSelect" @change="onResponsibleChange">
                    <option value="">-- Aucun --</option>
                    <option v-for="e in empStore.employees" :key="e.id" :value="e.id">
                      {{ e.code }} · {{ e.name }} · {{ e.jobTitle }}
                    </option>
                  </select>
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Téléphone principal</label>
                  <input v-model="form.phone" type="tel" :class="cls.fieldInput" placeholder="+230 2xx xxxx" />
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Courrier électronique</label>
                  <input v-model="form.email" type="email" :class="[cls.fieldInput, errors.email && cls.inputError]" placeholder="service@hv.com" />
                  <div v-if="errors.email" :class="cls.fieldError">{{ errors.email }}</div>
                </div>
              </div>
            </div>

            <!-- ── Section 3 : Pools de validation ── -->
            <div class="flex flex-col gap-3.5">
              <div :class="sectionTitle"><ShieldCheck class="w-4 h-4 text-primary" /> Configuration des validateurs</div>
              <ApprovalPoolConfig v-if="isEditMode && entityId" :entity-id="entityId" />
              <div v-else class="flex items-start gap-2 bg-info-bg text-info text-xs rounded-md px-3 py-2.5">
                <Info class="w-3.5 h-3.5 shrink-0 mt-px" />
                <span>Les validateurs (N+1 à N+4, par type de demande) se configurent après la création, depuis la fiche de l'entité.</span>
              </div>
            </div>

            <!-- ── Boutons ── -->
            <p v-if="saveError" class="text-xs text-danger bg-danger-bg px-3 py-2 rounded-md">{{ saveError }}</p>
            <div class="flex gap-2 justify-end pt-2 border-t border-border">
              <button :class="cls.btnOutline" @click="handleDraft">
                <Save class="w-4 h-4" />
                {{ isEditMode ? 'Enregistrer les modifications' : 'Enregistrer en brouillon' }}
              </button>
              <button :class="cls.btnPrimary" @click="handleSubmit">
                <Send class="w-4 h-4" /> Enregistrer et soumettre
              </button>
            </div>

          </div>
        </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft, Building, User, ShieldCheck, Save, Send, Info } from 'lucide-vue-next'
import { SkeletonLoader } from '../../components'
import ApprovalPoolConfig from '../../components/entities/ApprovalPoolConfig.vue'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { useAuthStore }     from '../../stores/auth'
import { useEntityStore }   from '../../stores/entities'
import { useEmployeeStore } from '../../stores/employees'
import type { EntityType } from '../../types'

const auth        = useAuthStore()
const store       = useEntityStore()
const empStore    = useEmployeeStore()
const router      = useRouter()
const route       = useRoute()

// ── Classes du design system ─────────────────────────────────
const sectionTitle = 'flex items-center gap-2 text-sm font-semibold text-foreground pb-2.5 border-b border-border'
const fieldGrid = 'grid grid-cols-2 gap-3.5 max-sm:grid-cols-1'
const hint = 'font-normal text-muted-foreground'

const entityId   = computed(() => route.params.id as string | undefined)
const isEditMode = computed(() => !!entityId.value)
const editEntity = computed(() => entityId.value ? store.getEntityById(entityId.value) : undefined)
// L'entité racine n'a jamais de parent ni de type modifiables — invariants
// structurels, pas des attributs métier. La racine est LA Direction
// Générale (voir store::directionGenerale), jamais une entité orpheline
// quelconque — sinon une entité mal rattachée (parentId vide par erreur)
// perdait pour toujours la possibilité de corriger son parent (bug client
// du 09/09, même correction que EntityCard.vue/EntityDetailView.vue).
const isRootEntity = computed(() => isEditMode.value && editEntity.value?.id === store.directionGenerale?.id)

// ── Formulaire ────────────────────────────────────────────────
const form = reactive({
  name:            '',
  code:            '',
  type:            '' as EntityType | '',
  parentId:        '' as string | null,
  legalIdentifier: '',
  address:         '',
  managerId:       '' as string | undefined,
  responsibleName: '',
  phone:           '',
  email:           '',
})
const errors = reactive({ name: '', code: '', type: '', email: '' })
const saveError = ref('')

// Options entité parente
const parentOptions = computed(() =>
  store.entities.filter(e => e.status === 'Active' && e.id !== entityId.value)
)

// Pré-remplissage en mode édition — attend que la liste soit chargée
const formLoading = ref(false)
onMounted(async () => {
  const tasks: Promise<unknown>[] = []
  if (store.entities.length === 0) tasks.push(store.fetchAll())
  if (empStore.employees.length === 0) tasks.push(empStore.fetchAll())
  if (tasks.length > 0) {
    formLoading.value = true
    await Promise.all(tasks)
  }
  if (isEditMode.value && editEntity.value) {
    const e = editEntity.value
    form.name            = e.name
    form.code            = e.code
    form.type            = e.type
    form.parentId        = e.parentId ?? ''
    form.legalIdentifier = e.legalIdentifier ?? ''
    form.address         = e.address ?? ''
    form.managerId       = e.managerId ?? ''
    form.responsibleName = e.responsibleName ?? ''
    form.phone           = e.phone ?? ''
    form.email           = e.email ?? ''
  }
  formLoading.value = false
})

// Auto-uppercase code
watch(() => form.code, v => { form.code = v.toUpperCase() })

function onResponsibleChange() {
  const emp = empStore.getById(form.managerId ?? '')
  form.responsibleName = emp?.name ?? ''
}

// ── Validation ────────────────────────────────────────────────
function validate(): boolean {
  errors.name = errors.code = errors.type = errors.email = ''
  let ok = true
  if (!form.name.trim())  { errors.name = "L'intitulé est obligatoire"; ok = false }
  if (!form.code.trim())  { errors.code = "Le code est obligatoire";    ok = false }
  if (!form.type)         { errors.type = "Veuillez choisir un type";   ok = false }
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = "Format email invalide"; ok = false
  }
  return ok
}

function buildPayload() {
  return {
    code:      form.code,
    name:      form.name,
    type:      form.type as EntityType,
    legalIdentifier: form.legalIdentifier || undefined,
    parentId:  form.parentId || null,
    managerId: form.managerId || null,
    address:   form.address || undefined,
    phone:     form.phone || undefined,
    email:     form.email || undefined,
  }
}

async function handleDraft() {
  if (!validate()) return
  saveError.value = ''
  try {
    if (isEditMode.value && entityId.value) {
      await store.updateEntity(entityId.value, buildPayload())
    } else {
      // leaveApprovalMode: toujours Pool à la création manuelle (seul
      // l'import CSV permet de choisir DirectValidator dès la création, voir
      // entityImportConfig.ts) — n'a pas sa place dans buildPayload() ci-
      // dessus, partagé avec updateEntity() qui ne doit jamais y toucher
      // (sinon un simple edit de contenu repasserait silencieusement une
      // entité DirectValidator en Pool, effet fantôme).
      await store.createEntity({ ...buildPayload(), leaveApprovalMode: 'Pool' })
    }
    router.push({ name: 'hr-entities' })
  } catch {
    saveError.value = store.error ?? "L'enregistrement a échoué. Veuillez réessayer."
  }
}

async function handleSubmit() {
  if (!validate()) return
  saveError.value = ''
  try {
    if (isEditMode.value && entityId.value) {
      await store.updateEntity(entityId.value, buildPayload())
      await store.submitEntity(entityId.value)
    } else {
      const created = await store.createEntity({ ...buildPayload(), leaveApprovalMode: 'Pool' })
      await store.submitEntity(created.id)
    }
    router.push({ name: 'hr-entities' })
  } catch {
    saveError.value = store.error ?? "L'enregistrement a échoué. Veuillez réessayer."
  }
}
</script>
