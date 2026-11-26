<template>
  <CreateModalShell
    :title="site ? `Site ${site.name}` : 'Nouveau site'"
    banner-label="Site de travail"
    :create-label="site ? 'Enregistrer' : 'Créer le site'"
    saving-label="Enregistrement…"
    :save-error="error"
    :is-saving="saving"
    @close="close"
    @create="submit"
  >
    <template #form>
      <div class="flex-1 overflow-auto px-6 py-5">
        <div class="max-w-3xl mx-auto">
          <FormSection title="Site">
            <div :class="cls.fieldRow">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Nom <span class="text-danger">*</span></label>
                <input v-model="form.name" type="text" maxlength="100" :class="cls.fieldInput" placeholder="Ex. Zone A" />
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Code <span class="text-danger">*</span></label>
                <input v-model="form.code" type="text" maxlength="20" :class="cls.fieldInput" placeholder="Ex. ZONE_A" />
              </div>
            </div>
            <div :class="cls.field" class="mt-3 max-w-[260px]">
              <label :class="cls.fieldLabel">Trajet et changement (minutes) <span class="text-danger">*</span></label>
              <input v-model.number="form.minutes" type="number" min="0" max="120" step="1" :class="cls.fieldInput" />
            </div>
            <p class="text-[12px] text-muted-foreground mt-2">{{ example }}</p>
          </FormSection>

          <FormSection title="Employés rattachés">
            <div class="flex items-end gap-3 flex-wrap mb-2">
              <div :class="cls.field" class="flex-1 min-w-[220px]">
                <label :class="cls.fieldLabel">Rechercher</label>
                <input v-model="search" type="search" :class="cls.fieldInput" placeholder="Nom, matricule ou entité" />
              </div>
              <span class="text-[12px] text-muted-foreground pb-2">{{ selected.length }} employé(s) sur ce site</span>
            </div>
            <label class="flex items-center gap-2 text-[13px] cursor-pointer mb-1.5">
              <input type="checkbox" class="accent-primary" :checked="allShownSelected" :disabled="!shown.length" @change="toggleShown" />
              Tout cocher ({{ shown.length }} affiché(s))
            </label>
            <div class="border border-border rounded-md max-h-[300px] overflow-auto">
              <label v-for="e in shown" :key="e.id" class="flex items-center gap-2.5 px-2.5 py-1.5 border-b border-border last:border-b-0 text-[13px] cursor-pointer hover:bg-background">
                <input v-model="selected" type="checkbox" :value="e.id" class="accent-primary" />
                <span class="flex-1 min-w-0 truncate">{{ e.name }} <span class="text-muted-foreground text-[11px]">{{ e.code }}<template v-if="e.isCadre"> · cadre, non concerné</template></span></span>
                <span v-if="otherSite(e)" class="text-[11px] text-warning whitespace-nowrap">actuellement : {{ otherSite(e) }}</span>
                <span class="text-muted-foreground text-[11px] truncate max-w-[180px]">{{ e.entityName }}</span>
              </label>
              <p v-if="!shown.length" class="px-2.5 py-3 text-[12px] text-muted-foreground">{{ loaded ? 'Aucun employé pour ces critères.' : 'Chargement...' }}</p>
            </div>
          </FormSection>
        </div>
      </div>
    </template>
  </CreateModalShell>
</template>

<script setup lang="ts">
/**
 * Creation ou modification d'un site : nom, code, minutes deduites et employes
 * rattaches (cocher un employe d'un autre site l'y deplace).
 */
import { computed, reactive, ref } from 'vue'
import CreateModalShell from '../shared/CreateModalShell.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import * as cls from '../../lib/formClasses'
import { getApiErrorMessage } from '../../lib/api'
import { useToastStore } from '../../stores/toast'
import { useTimeSiteStore, type SiteEmployee, type TimeSite } from '../../stores/timeSites'

const props = defineProps<{ site: TimeSite | null }>()
const emit = defineEmits<{ close: [] }>()

const store = useTimeSiteStore()
const toast = useToastStore()

const form = reactive({ name: props.site?.name ?? '', code: props.site?.code ?? '', minutes: props.site?.deductionMinutes ?? 0 })
const error = ref('')
const saving = ref(false)
const search = ref('')
const employees = ref<SiteEmployee[]>([])
const selected = ref<string[]>([])
const loaded = ref(false)
// Le rattachement n'est envoye que si la liste a bien ete chargee.
store.fetchEmployees()
  .then((list) => {
    employees.value = list
    selected.value = props.site ? list.filter(e => e.siteId === props.site!.id).map(e => e.id) : []
    loaded.value = true
  })
  .catch((e) => { error.value = getApiErrorMessage(e, 'Chargement des employés impossible') })

const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  return employees.value.filter(e => !q || `${e.name} ${e.code} ${e.entityName}`.toLowerCase().includes(q))
})
const allShownSelected = computed(() => shown.value.length > 0 && shown.value.every(e => selected.value.includes(e.id)))
function toggleShown() {
  const ids = shown.value.map(e => e.id)
  selected.value = allShownSelected.value
    ? selected.value.filter(id => !ids.includes(id))
    : [...new Set([...selected.value, ...ids])]
}
function otherSite(e: SiteEmployee): string {
  if (!e.siteId || e.siteId === props.site?.id) return ''
  return store.sites.find(s => s.id === e.siteId)?.name ?? ''
}

const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
const example = computed(() => {
  const m = Number(form.minutes) || 0
  return m > 0
    ? `Exemple : pointé de 07:00 à 17:30, compté de ${clock(420 + m)} à ${clock(1050 - m)}. Retiré une fois par jour, sur la présence sur site des non-cadres.`
    : 'À 0 minute, rien n\'est retiré.'
})

async function submit() {
  if (saving.value) return
  error.value = ''
  if (!form.name.trim() || !form.code.trim()) { error.value = 'Le nom et le code sont obligatoires.'; return }
  const minutes = Number(form.minutes)
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 120) { error.value = 'Les minutes : un nombre entier entre 0 et 120.'; return }
  saving.value = true
  toast.loading('Enregistrement...')
  try {
    const id = await store.save(props.site?.id ?? null, { Name: form.name.trim(), Code: form.code.trim(), DeductionMinutes: minutes })
    if (loaded.value) await store.setEmployees(id, selected.value)
    toast.success('Effectué avec succès')
    emit('close')
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Enregistrement impossible')
    toast.error(error.value)
  } finally {
    saving.value = false
  }
}

function close() { if (!saving.value) emit('close') }
</script>
