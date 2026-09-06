<script setup lang="ts">
/**
 * Coquille générique de fiche de création — portée du frontdesk
 * (P247_FD_LWL_APP/src/components/shared/CreateModalShell.vue), tokens verts.
 */
import { onMounted, onUnmounted } from 'vue'
import { ArrowLeft, Check, Loader2, Save, X, Plus, AlertCircle } from 'lucide-vue-next'

defineProps<{
  title: string
  bannerLabel: string
  createLabel: string
  // Bouton secondaire "Enregistrer le brouillon", affiché seulement si
  // fourni — regroupe les 3 actions (brouillon / soumettre / annuler) au
  // même endroit, en haut, au lieu d'un bouton brouillon isolé en bas du
  // formulaire (redemande explicite en reunion, voir Lot G #4).
  draftLabel?: string
  isSaving?: boolean
  saveError?: string | null
}>()

const emit = defineEmits<{ close: []; create: []; saveDraft: [] }>()

const onKeydown = (e: KeyboardEvent) => { if (e.key === 'Escape') emit('close') }
onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  // La coquille se positionne en absolute sur #below-topbar, pas en fixed
  // sur le viewport — si la page était scrollée (ex: onboarding, dont le
  // contenu peut dépasser l'écran), le popup apparaît décalé et son pied
  // (boutons) part hors champ. On force donc le retour en haut à l'ouverture.
  window.scrollTo({ top: 0 })
})
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="#below-topbar" defer>
    <div class="absolute inset-0 z-50 flex">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-md" @click="emit('close')"></div>

      <div class="relative z-10 flex flex-col w-full h-full bg-card overflow-hidden mx-4 lg:mx-auto lg:max-w-[1040px] shadow-[0_8px_32px_rgba(0,0,0,0.16)]">
        <!-- Bannière -->
        <div class="bg-primary text-primary-foreground px-6 py-2 flex items-center justify-between text-sm shrink-0">
          <div class="flex items-center gap-2">
            <button @click="emit('close')" class="p-1 hover:bg-white/20 rounded transition" title="Annuler">
              <ArrowLeft class="w-5 h-5" />
            </button>
            <span>{{ bannerLabel }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="flex items-center gap-1 text-yellow-200">
              <Plus class="w-4 h-4" /> Création
            </span>
          </div>
        </div>

        <!-- Barre de titre -->
        <div class="bg-card border-b border-border px-6 py-4 shrink-0">
          <div class="flex items-center justify-between">
            <h1 class="text-2xl font-semibold text-card-foreground">{{ title }}</h1>
            <div class="flex items-center gap-2">
              <button
                v-if="draftLabel"
                @click="emit('saveDraft')"
                :disabled="isSaving"
                class="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-primary-foreground bg-primary rounded hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Save class="w-4 h-4" />
                {{ draftLabel }}
              </button>
              <button
                @click="emit('create')"
                :disabled="isSaving"
                :class="draftLabel
                  ? 'inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-card-foreground border border-border rounded hover:bg-background transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
                  : 'inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-primary-foreground bg-primary rounded hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'"
              >
                <Loader2 v-if="isSaving" class="animate-spin w-4 h-4" />
                <Check v-else class="w-4 h-4" />
                {{ isSaving ? 'Création…' : createLabel }}
              </button>
              <button
                @click="emit('close')"
                :disabled="isSaving"
                class="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-card-foreground border border-border rounded hover:bg-background transition disabled:opacity-50 cursor-pointer"
              >
                <X class="w-4 h-4" /> Annuler
              </button>
            </div>
          </div>

          <div v-if="saveError" class="mt-3 px-4 py-2 bg-danger-bg border border-danger/30 rounded text-sm text-danger flex items-center gap-2">
            <AlertCircle class="w-4 h-4 shrink-0" /> {{ saveError }}
          </div>
        </div>

        <!-- Contenu -->
        <div class="flex flex-1 overflow-hidden">
          <slot name="form" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
