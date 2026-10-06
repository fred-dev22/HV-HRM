<script setup lang="ts">
/**
 * Dialogue "Réinitialiser le mot de passe" (administrateur) : étape 1,
 * avertissement + confirmation explicite (case à cocher obligatoire) AVANT
 * toute génération ; étape 2, révélation unique du mot de passe temporaire.
 * Pour un employé qui ne reçoit pas ses emails ("Mot de passe oublié" inopérant).
 *
 * Même principe que CreateUserAccountDialog : fermeture bloquée pendant la
 * révélation (pas de clic-fond, pas d'Escape), le mot de passe n'étant plus
 * jamais affiché ensuite.
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { X, Copy, Check, ShieldAlert, TriangleAlert } from 'lucide-vue-next'
import * as cls from '../../lib/formClasses'
import { useUserStore } from '../../stores/users'

const props = defineProps<{
  userId: string
  employeeName: string
  employeeEmail?: string
}>()
const emit = defineEmits<{ close: [] }>()

const store = useUserStore()

const step = ref<'confirm' | 'reveal'>('confirm')
const understood = ref(false)
const submitting = ref(false)
const error = ref('')
const password = ref('')
const copied = ref(false)

async function generate() {
  if (!understood.value || submitting.value) return
  error.value = ''
  submitting.value = true
  try {
    const result = await store.resetUserPassword(props.userId)
    password.value = result.temporaryPassword
    step.value = 'reveal'
  } catch {
    error.value = store.error ?? 'La réinitialisation a échoué. Veuillez réessayer.'
  } finally {
    submitting.value = false
  }
}

async function copyPassword() {
  try {
    await navigator.clipboard.writeText(password.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    /* presse-papiers indisponible : le mot de passe reste sélectionnable à l'écran */
  }
}

function finish() {
  // Efface le secret de la mémoire du composant dès que l'admin a terminé.
  password.value = ''
  emit('close')
}

// Capture + stopPropagation : ce dialog s'ouvre par-dessus la fiche employé,
// qui a son propre listener Escape (voir CreateUserAccountDialog.vue).
const onKeydown = (e: KeyboardEvent) => {
  if (e.key !== 'Escape') return
  e.stopPropagation()
  if (step.value === 'confirm' && !submitting.value) emit('close')
}
onMounted(() => document.addEventListener('keydown', onKeydown, true))
onUnmounted(() => document.removeEventListener('keydown', onKeydown, true))
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[1000]"
      @click.self="step === 'confirm' && !submitting && emit('close')"
    >
      <div class="relative bg-card text-card-foreground rounded-xl p-7 max-sm:p-5 w-[90%] max-w-[480px] max-h-[92vh] overflow-y-auto shadow-[0_8px_32px_rgba(0,0,0,0.16)] flex flex-col">

        <!-- Étape 1 : avertissement + confirmation -->
        <template v-if="step === 'confirm'">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <TriangleAlert class="w-5 h-5 text-warning shrink-0" />
              <span class="text-[15px] font-semibold text-foreground">Réinitialiser le mot de passe ?</span>
            </div>
            <button class="w-7 h-7 bg-background rounded-md cursor-pointer flex items-center justify-center text-muted-foreground shrink-0 transition-colors hover:bg-border hover:text-foreground" title="Fermer" @click="emit('close')">
              <X class="w-4 h-4" />
            </button>
          </div>

          <p class="text-[13px] text-foreground mb-3">
            Vous êtes sur le point de réinitialiser le mot de passe de
            <strong>{{ employeeName }}</strong><template v-if="employeeEmail"> ({{ employeeEmail }})</template>.
          </p>

          <ul class="text-[12.5px] text-muted-foreground flex flex-col gap-1.5 mb-4 pl-4 list-disc">
            <li>Son mot de passe actuel sera <strong class="text-foreground">remplacé immédiatement</strong> et ne fonctionnera plus.</li>
            <li>Un mot de passe temporaire sera généré et <strong class="text-foreground">affiché une seule fois</strong>, à vous. Il ne sera <strong class="text-foreground">pas envoyé par email</strong>.</li>
            <li>Vous devez le lui transmettre vous-même, par un moyen sûr (en personne ou par téléphone), <strong class="text-foreground">après avoir vérifié son identité</strong>.</li>
            <li>Il devra le changer dès sa première connexion.</li>
            <li>Cette action est enregistrée.</li>
          </ul>

          <label class="flex items-start gap-2 text-[13px] text-foreground cursor-pointer bg-background border border-border rounded-md px-3 py-2.5">
            <input v-model="understood" type="checkbox" class="accent-primary mt-0.5" />
            <span>J'ai compris, je confirme vouloir réinitialiser le mot de passe de {{ employeeName }}.</span>
          </label>

          <p v-if="error" class="text-xs text-danger bg-danger-bg px-3 py-2 rounded-md mt-3">{{ error }}</p>

          <div class="flex gap-2 justify-end mt-5 pt-4 border-t border-border">
            <button :class="cls.btnOutline" :disabled="submitting" @click="emit('close')">Annuler</button>
            <button :class="cls.btnPrimary" :disabled="!understood || submitting" @click="generate">
              {{ submitting ? 'Génération…' : 'Confirmer et générer' }}
            </button>
          </div>
        </template>

        <!-- Étape 2 : révélation unique -->
        <template v-else>
          <div class="flex items-center gap-2 mb-4">
            <ShieldAlert class="w-5 h-5 text-warning shrink-0" />
            <span class="text-[15px] font-semibold text-foreground">Mot de passe réinitialisé, notez-le</span>
          </div>

          <p class="text-xs text-muted-foreground mb-3">
            Ce mot de passe ne sera <strong>plus jamais affiché</strong>. Transmettez-le à {{ employeeName }} maintenant,
            sans l'écrire dans un email. Il devra le changer à sa première connexion.
          </p>

          <div class="flex items-center gap-2 bg-background border border-border rounded-md px-3 py-2.5">
            <span class="font-mono text-sm flex-1 select-all">{{ password }}</span>
            <button type="button" :class="[cls.btnOutline, '!px-2.5 !py-1.5 !text-xs']" @click="copyPassword">
              <Check v-if="copied" class="w-3.5 h-3.5 text-success" />
              <Copy v-else class="w-3.5 h-3.5" />
              {{ copied ? 'Copié' : 'Copier' }}
            </button>
          </div>

          <div class="flex justify-end mt-5 pt-4 border-t border-border">
            <button :class="cls.btnPrimary" @click="finish">J'ai noté le mot de passe</button>
          </div>
        </template>

      </div>
    </div>
  </Teleport>
</template>
