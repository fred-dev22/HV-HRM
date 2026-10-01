<template>
  <div class="border border-border rounded-md overflow-hidden bg-background">
    <div class="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-card">
      <button type="button" :class="[toolBtn, isActive('bold') && toolBtnActive]" title="Gras" @mousedown.prevent="exec('bold')">
        <Bold class="w-3.5 h-3.5" />
      </button>
      <button type="button" :class="[toolBtn, isActive('italic') && toolBtnActive]" title="Italique" @mousedown.prevent="exec('italic')">
        <Italic class="w-3.5 h-3.5" />
      </button>
      <button type="button" :class="[toolBtn, isActive('underline') && toolBtnActive]" title="Souligné" @mousedown.prevent="exec('underline')">
        <UnderlineIcon class="w-3.5 h-3.5" />
      </button>
      <span class="w-px h-4 bg-border mx-1"></span>
      <select :class="sizeSelect" title="Taille du texte" @mousedown="saveSelection" @change="onSizeChange">
        <option value="">Taille</option>
        <option value="2">Petit</option>
        <option value="3">Normal</option>
        <option value="5">Grand</option>
        <option value="7">Très grand</option>
      </select>
    </div>
    <div
      ref="editorEl"
      class="px-2.5 py-2 text-[13px] text-foreground outline-none min-h-[180px] max-h-[420px] overflow-auto [&_p]:m-0 [&_p+p]:mt-2.5"
      contenteditable="true"
      :data-placeholder="placeholder"
      @input="onInput"
      @keyup="refreshActiveState"
      @mouseup="refreshActiveState"
    ></div>
  </div>
</template>

<script setup lang="ts">
/**
 * Éditeur de texte enrichi minimal (gras/italique/souligné/taille), sans
 * dépendance externe (execCommand, encore largement supporté pour ce genre
 * d'usage basique). Retour client du 19/09 : la saisie des modèles de
 * contrat était un simple textarea sans mise en forme possible.
 * ContractTemplateCard.vue est le seul consommateur actuel.
 */
import { ref, reactive, onMounted, watch } from 'vue'
import { Bold, Italic, Underline as UnderlineIcon } from 'lucide-vue-next'

const props = defineProps<{ modelValue: string; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const editorEl = ref<HTMLDivElement | null>(null)
const toolBtn = 'w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-colors'
const toolBtnActive = '!bg-primary/10 !text-primary'
const sizeSelect = 'h-7 px-1.5 rounded border border-border bg-background text-[12px] text-foreground cursor-pointer'

const active = reactive({ bold: false, italic: false, underline: false })
function isActive(cmd: keyof typeof active): boolean { return active[cmd] }
function refreshActiveState() {
  active.bold = document.queryCommandState('bold')
  active.italic = document.queryCommandState('italic')
  active.underline = document.queryCommandState('underline')
}

// Un modele plus ancien (texte brut, retours a la ligne doubles) n'a pas de
// balises : injecte tel quel en innerHTML, le navigateur l'affiche en un
// seul bloc (les \n bruts ne sont jamais des sauts visuels en HTML). Meme
// conversion en <p> que le fallback de buildContractHtml (contractDocument.ts),
// pour que l'affichage dans l'editeur corresponde a l'aperçu/PDF genere.
function toEditableHtml(value: string): string {
  if (!value) return ''
  if (/<[a-z][\s\S]*>/i.test(value)) return value
  return value
    .split(/\n{2,}/)
    .map(p => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`)
    .join('')
}

onMounted(() => {
  document.execCommand('defaultParagraphSeparator', false, 'p')
  if (editorEl.value) editorEl.value.innerHTML = toEditableHtml(props.modelValue)
})

// Ne resynchronise que depuis l'exterieur (changement de modele edite),
// jamais pendant la frappe (le curseur sauterait au debut a chaque
// caractere) : on l'ignore tant que l'editeur a le focus.
watch(() => props.modelValue, (v) => {
  const html = toEditableHtml(v)
  if (editorEl.value && document.activeElement !== editorEl.value && editorEl.value.innerHTML !== html) {
    editorEl.value.innerHTML = html
  }
})

function exec(cmd: string) {
  editorEl.value?.focus()
  document.execCommand(cmd)
  refreshActiveState()
  onInput()
}

// Le select perd le focus de l'editeur avant que "change" ne se declenche :
// on sauvegarde la selection au mousedown (avant ce transfert de focus) pour
// pouvoir la restaurer juste avant d'appliquer la taille.
let savedRange: Range | null = null
function saveSelection() {
  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0 && editorEl.value?.contains(sel.anchorNode)) {
    savedRange = sel.getRangeAt(0).cloneRange()
  }
}
function onSizeChange(e: Event) {
  const select = e.target as HTMLSelectElement
  const value = select.value
  select.value = ''
  if (!value) return
  editorEl.value?.focus()
  if (savedRange) {
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(savedRange)
  }
  document.execCommand('fontSize', false, value)
  onInput()
}

function onInput() {
  emit('update:modelValue', editorEl.value?.innerHTML ?? '')
}
</script>

<style scoped>
[contenteditable]:empty:before {
  content: attr(data-placeholder);
  color: var(--color-muted-foreground);
}
</style>
