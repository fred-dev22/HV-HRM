<script setup lang="ts">
/**
 * Champ pour un identifiant ou un secret déjà enregistré côté serveur.
 * La valeur enregistrée n'est JAMAIS affichée ni relue : seul un indice
 * (« ••••c059 ») la rappelle. Pour la changer, il faut cliquer sur « Modifier »
 * et saisir une nouvelle valeur ; sinon elle est conservée telle quelle.
 * Sans valeur enregistrée, c'est un champ de saisie ordinaire.
 */
import { ref } from 'vue'
import * as cls from '../../../lib/formClasses'

const props = defineProps<{
  label: string
  modelValue: string
  saved: boolean
  hint?: string
  error?: string
  secret?: boolean
  placeholder?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const editing = ref(false)

function startEdit() {
  editing.value = true
}
function cancelEdit() {
  editing.value = false
  emit('update:modelValue', '')
}
</script>

<template>
  <div :class="cls.field">
    <label :class="cls.fieldLabel">{{ label }}</label>

    <div v-if="props.saved && !editing" class="flex items-center gap-2">
      <div :class="[cls.fieldInput, 'flex-1 !bg-background text-muted-foreground tracking-wider select-none']" aria-readonly="true">
        {{ props.hint || '••••••••' }}
      </div>
      <span class="text-[11px] text-muted-foreground whitespace-nowrap">Enregistré</span>
      <button type="button" :class="[cls.btnOutline, '!px-3 !py-1.5 !text-xs']" @click="startEdit">Modifier</button>
    </div>

    <div v-else class="flex items-center gap-2">
      <input
        :value="props.modelValue"
        :type="props.secret ? 'password' : 'text'"
        :class="[cls.fieldInput, 'flex-1', props.error && cls.inputError]"
        :placeholder="props.placeholder"
        autocomplete="off"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <button v-if="props.saved" type="button" :class="[cls.btnOutline, '!px-3 !py-1.5 !text-xs']" @click="cancelEdit">Annuler</button>
    </div>

    <div v-if="props.error" :class="cls.fieldError">{{ props.error }}</div>
  </div>
</template>
