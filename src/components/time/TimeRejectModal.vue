<template>
  <ModalShell :open="open" :title="(count ?? 1) > 1 ? `Rejeter ${count} saisies` : 'Rejeter la saisie'" max-width="max-w-[480px]" @close="emit('close')">
    <div :class="cls.field">
      <label :class="cls.fieldLabel">Motif du refus <span class="text-danger">*</span></label>
      <textarea v-model="reason" :class="cls.fieldTextarea" rows="3" maxlength="500" placeholder="Expliquez pourquoi la saisie est refusée"></textarea>
    </div>
    <template #footer>
      <button :class="L.btnOutline" @click="emit('close')">Annuler</button>
      <button :class="L.btnPrimary" :disabled="!reason.trim()" @click="emit('confirm', reason.trim())">Rejeter</button>
    </template>
  </ModalShell>
</template>

<script setup lang="ts">
/** Motif obligatoire d'un refus de saisie de temps (meme fenetre que les autres refus du HRM). */
import { ref, watch } from 'vue'
import ModalShell from '../ui/ModalShell.vue'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'

const props = defineProps<{ open: boolean; count?: number }>()
const emit = defineEmits<{ close: []; confirm: [reason: string] }>()

const reason = ref('')
watch(() => props.open, (o) => { if (o) reason.value = '' })
</script>
