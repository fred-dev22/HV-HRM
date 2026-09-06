<script setup lang="ts">
/**
 * Tour guidé (coachmarks) — surligne un élément déjà présent à l'écran
 * (via son sélecteur CSS, ex: data-tour="config") et affiche une bulle
 * descriptive juste à côté, avec Suivant/Passer et un compteur n/total.
 * Le "trou" dans l'overlay sombre est fait en pur CSS (box-shadow géant sur
 * un cadre transparent positionné exactement sur la cible) — pas de canvas
 * ni de masque SVG.
 */
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { X } from 'lucide-vue-next'

export interface TourStep {
  target: string // sélecteur CSS de l'élément à surligner (ex: '[data-tour="config"]')
  title: string
  description: string
}

const props = defineProps<{ steps: TourStep[] }>()
const emit = defineEmits<{ close: [] }>()

const stepIndex = ref(0)
const rect = ref<{ top: number; left: number; width: number; height: number } | null>(null)
const tooltipStyle = ref<Record<string, string>>({})

const currentStep = computed(() => props.steps[stepIndex.value])
const isLast = computed(() => stepIndex.value === props.steps.length - 1)

function measure() {
  const el = currentStep.value ? document.querySelector(currentStep.value.target) : null
  if (!el) { rect.value = null; return }
  el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
  const r = el.getBoundingClientRect()
  rect.value = { top: r.top, left: r.left, width: r.width, height: r.height }

  // Bulle positionnée à droite de la cible (le menu latéral est tout à
  // gauche, il y a toujours de la place) — repliée au-dessus si jamais ça
  // déborderait en bas de l'écran.
  const TOOLTIP_WIDTH = 320
  const left = Math.min(r.right + 16, window.innerWidth - TOOLTIP_WIDTH - 16)
  const top  = Math.min(r.top, window.innerHeight - 220)
  tooltipStyle.value = { top: `${Math.max(16, top)}px`, left: `${Math.max(16, left)}px` }
}

function next() {
  if (isLast.value) { emit('close'); return }
  stepIndex.value++
  nextTick(measure)
}
function skip() { emit('close') }

function onResize() { measure() }

// La cible (ex: [data-tour="config"]) est rendue par un composant frère
// (AppSidebar) dont le montage peut retarder d'un tick sur celui du tour
// (sections conditionnées par des permissions) — un seul nextTick() ne
// suffit pas toujours, d'où quelques tentatives supplémentaires avant
// d'abandonner silencieusement.
let retriesLeft = 10
function measureWithRetry() {
  measure()
  if (!rect.value && retriesLeft > 0) {
    retriesLeft--
    requestAnimationFrame(measureWithRetry)
  }
}

onMounted(() => {
  nextTick(measureWithRetry)
  window.addEventListener('resize', onResize)
})
onUnmounted(() => window.removeEventListener('resize', onResize))
</script>

<template>
  <Teleport to="body">
    <div v-if="rect" class="fixed inset-0 z-[3000]">
      <!-- Overlay sombre avec "trou" sur la cible (box-shadow géant) -->
      <div
        class="absolute rounded-lg transition-all duration-300 pointer-events-none"
        :style="{
          top: `${rect.top - 6}px`, left: `${rect.left - 6}px`,
          width: `${rect.width + 12}px`, height: `${rect.height + 12}px`,
          boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.65)',
        }"
      ></div>
      <!-- Anneau de mise en avant -->
      <div
        class="absolute rounded-lg ring-2 ring-primary pointer-events-none transition-all duration-300"
        :style="{ top: `${rect.top - 6}px`, left: `${rect.left - 6}px`, width: `${rect.width + 12}px`, height: `${rect.height + 12}px` }"
      ></div>

      <!-- Bulle descriptive -->
      <div class="absolute w-80 bg-card border border-border rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.24)] p-4 flex flex-col gap-2.5" :style="tooltipStyle">
        <div class="flex items-start justify-between gap-2">
          <span class="text-[11px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5">{{ stepIndex + 1 }}/{{ steps.length }}</span>
          <button class="text-muted-foreground hover:text-foreground cursor-pointer shrink-0" @click="skip" title="Fermer">
            <X class="w-4 h-4" />
          </button>
        </div>
        <div class="text-sm font-bold text-foreground">{{ currentStep?.title }}</div>
        <p class="text-[13px] text-muted-foreground leading-relaxed">{{ currentStep?.description }}</p>
        <div class="flex items-center justify-between mt-1">
          <button class="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors" @click="skip">Passer</button>
          <button class="text-xs font-semibold text-primary-foreground bg-primary rounded-lg px-3.5 py-1.5 cursor-pointer transition-colors hover:bg-primary/90" @click="next">
            {{ isLast ? 'Terminer' : 'Suivant →' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
