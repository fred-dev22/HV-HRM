<script setup lang="ts">
/**
 * Explorateur de dossiers du SERVEUR. Un selecteur de fichiers du navigateur ne
 * peut pas servir ici : il parcourt le poste de l'utilisateur et ne donne jamais
 * un chemin utilisable par le serveur. On parcourt donc le serveur lui-meme (via
 * l'API, reservee a l'administrateur). Part du dossier deja choisi s'il existe,
 * sinon de la liste des lecteurs : aucun dossier n'est suppose present.
 */
import { ref, watch } from 'vue'
import { ArrowUp, Folder, HardDrive, FolderPlus, Check } from 'lucide-vue-next'
import ModalShell from '../ui/ModalShell.vue'
import * as cls from '../../lib/formClasses'
import { getApiErrorMessage } from '../../lib/api'
import { useStorageSettingsStore } from '../../stores/storageSettings'

const props = defineProps<{ open: boolean; start: string }>()
const emit = defineEmits<{ close: []; select: [path: string] }>()

const store = useStorageSettingsStore()
const current = ref('')
const parent = ref<string | null>(null)
const entries = ref<{ name: string; path: string }[]>([])
const loading = ref(false)
const error = ref('')
const creating = ref(false)
const newName = ref('')

async function go(path: string) {
  loading.value = true
  error.value = ''
  try {
    const r = await store.browse(path)
    current.value = r.path
    parent.value = r.parent
    entries.value = r.entries
  } catch (err) {
    error.value = getApiErrorMessage(err, 'Impossible de lire ce dossier')
  } finally {
    loading.value = false
  }
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return
    creating.value = false
    newName.value = ''
    await go(props.start)
    // Le dossier de depart n'existe peut-etre plus : on retombe sur la liste des lecteurs.
    if (error.value && props.start) await go('')
  },
)

async function addFolder() {
  const name = newName.value.trim()
  if (!name) return
  error.value = ''
  try {
    const created = await store.createFolder(current.value, name)
    creating.value = false
    newName.value = ''
    await go(created)
  } catch (err) {
    error.value = getApiErrorMessage(err, 'Impossible de créer le dossier')
  }
}
</script>

<template>
  <ModalShell :open="open" title="Choisir le dossier de stockage" max-width="max-w-[560px]" @close="emit('close')">
    <p class="text-[12px] text-muted-foreground -mt-2">
      Vous parcourez les dossiers du <strong class="text-foreground">serveur</strong> qui héberge l'application, pas ceux de votre ordinateur.
    </p>

    <div class="flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-[13px] break-all min-h-[38px]">
      <HardDrive v-if="!current" class="w-4 h-4 text-muted-foreground shrink-0" />
      <Folder v-else class="w-4 h-4 text-primary shrink-0" />
      <span :class="current ? 'text-foreground' : 'text-muted-foreground'">{{ current || 'Lecteurs du serveur' }}</span>
    </div>

    <div v-if="error" :class="cls.fieldError">{{ error }}</div>

    <div class="border border-border rounded-lg h-[280px] overflow-y-auto">
      <button
        v-if="parent !== null"
        type="button"
        class="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground hover:bg-background cursor-pointer border-b border-border"
        @click="go(parent!)"
      >
        <ArrowUp class="w-4 h-4" /> Dossier parent
      </button>
      <div v-if="loading" class="px-3 py-6 text-center text-[12px] text-muted-foreground">Chargement…</div>
      <template v-else>
        <button
          v-for="e in entries"
          :key="e.path"
          type="button"
          class="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-background cursor-pointer text-left"
          @click="go(e.path)"
        >
          <HardDrive v-if="!current" class="w-4 h-4 text-muted-foreground shrink-0" />
          <Folder v-else class="w-4 h-4 text-primary shrink-0" />
          <span class="truncate">{{ e.name }}</span>
        </button>
        <div v-if="!entries.length && !error" class="px-3 py-6 text-center text-[12px] text-muted-foreground">
          {{ current ? 'Aucun sous-dossier' : 'Aucun lecteur trouvé' }}
        </div>
      </template>
    </div>

    <div v-if="current">
      <button v-if="!creating" type="button" :class="cls.btnOutline" @click="creating = true">
        <FolderPlus class="w-4 h-4" /> Nouveau dossier
      </button>
      <form v-else class="flex items-center gap-2" @submit.prevent="addFolder">
        <input v-model="newName" :class="cls.fieldInput" placeholder="Nom du nouveau dossier" autocomplete="off" autofocus />
        <button type="submit" :class="cls.btnPrimary" :disabled="!newName.trim()">Créer</button>
        <button type="button" :class="cls.btnOutline" @click="creating = false">Annuler</button>
      </form>
    </div>

    <template #footer>
      <button :class="cls.btnOutline" @click="emit('close')">Annuler</button>
      <button :class="cls.btnPrimary" :disabled="!current" @click="emit('select', current)">
        <Check class="w-4 h-4" /> Choisir ce dossier
      </button>
    </template>
  </ModalShell>
</template>
