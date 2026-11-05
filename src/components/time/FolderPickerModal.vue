<template>
  <ModalShell :open="open" title="Choisir le dossier des exports Morpho" max-width="max-w-[560px]" @close="emit('close')">
    <p class="text-[12px] text-muted-foreground -mt-2">Dossiers du serveur, là où les fichiers .xlsx de la pointeuse sont déposés.<template v-if="listing?.root"> Recherche limitée à <span class="font-medium text-foreground">{{ listing.root }}</span>.</template></p>

    <form class="flex items-center gap-2" @submit.prevent="go(typed)">
      <input v-model="typed" :class="cls.fieldInput" placeholder="Saisir un chemin puis Entrée" />
      <button type="submit" :class="L.btnOutline" :disabled="loading">Aller</button>
    </form>

    <div v-if="listing?.shortcuts?.length" class="flex gap-1.5 flex-wrap">
      <button
        v-for="s in listing.shortcuts" :key="s.path" type="button"
        class="px-3 py-1.5 text-[12.5px] font-medium rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
        @click="go(s.path)"
      >{{ s.name }}</button>
    </div>

    <div class="border border-border rounded-lg overflow-hidden">
      <div class="flex items-center gap-2 px-3 py-2 bg-tint border-b border-border text-[12px]">
        <button v-if="listing && (listing.parent !== null)" type="button" :class="L.actView" @click="go(listing.parent ?? '')"><ArrowUp class="w-3.5 h-3.5" /> Dossier parent</button>
        <span class="text-muted-foreground truncate">{{ listing?.path || 'Lecteurs' }}</span>
      </div>
      <div class="max-h-[300px] overflow-y-auto">
        <div v-if="loading" class="p-4 text-[13px] text-muted-foreground">Chargement...</div>
        <div v-else-if="error" class="p-4 text-[13px] text-danger">{{ error }}</div>
        <template v-else-if="listing">
          <button
            v-for="f in listing.folders" :key="f.path" type="button"
            class="w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] border-b border-border last:border-b-0 hover:bg-tint cursor-pointer bg-transparent"
            @click="go(f.path)"
          ><Folder class="w-4 h-4 text-primary shrink-0" /> <span class="truncate">{{ f.name }}</span></button>
          <div v-if="listing.folders.length === 0" class="p-4 text-[13px] text-muted-foreground">Aucun sous-dossier.</div>
        </template>
      </div>
    </div>

    <p v-if="listing?.path" class="text-[12px]" :class="listing.xlsxCount > 0 ? 'text-success' : 'text-muted-foreground'">
      {{ listing.xlsxCount > 0 ? `${listing.xlsxCount} fichier(s) .xlsx dans ce dossier.` : 'Aucun fichier .xlsx dans ce dossier pour le moment.' }}
    </p>

    <template #footer>
      <button :class="L.btnOutline" @click="emit('close')">Annuler</button>
      <button :class="L.btnPrimary" :disabled="!listing?.path" @click="listing?.path && emit('select', listing.path)">Choisir ce dossier</button>
    </template>
  </ModalShell>
</template>

<script setup lang="ts">
/**
 * Choix du dossier d'import de la pointeuse en parcourant les dossiers du
 * serveur (un navigateur ne peut pas donner le chemin d'un dossier : les
 * exports sont lus par le serveur, pas par l'ordinateur de l'utilisateur).
 */
import { ref, watch } from 'vue'
import { Folder, ArrowUp } from 'lucide-vue-next'
import ModalShell from '../ui/ModalShell.vue'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { getApiErrorMessage } from '../../lib/api'
import { useTimeStore, type FolderListing } from '../../stores/time'

const props = defineProps<{ open: boolean; startPath?: string }>()
const emit = defineEmits<{ close: []; select: [path: string] }>()

const store = useTimeStore()
const listing = ref<FolderListing | null>(null)
const typed = ref('')
const loading = ref(false)
const error = ref('')

async function go(path: string) {
  loading.value = true
  error.value = ''
  try {
    listing.value = await store.browseFolder(path)
    typed.value = listing.value.path
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Dossier inaccessible')
  } finally {
    loading.value = false
  }
}

// A l'ouverture : le dossier deja configure s'il existe encore, sinon les lecteurs.
watch(() => props.open, async (isOpen) => {
  if (!isOpen) return
  await go(props.startPath ?? '')
  if (error.value && props.startPath) await go('')
}, { immediate: true })
</script>
