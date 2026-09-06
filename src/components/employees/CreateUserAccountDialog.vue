<script setup lang="ts">
/**
 * Dialogue "Créer un compte utilisateur" — formulaire (username/rôle/mot de
 * passe généré) puis révélation unique du mot de passe après succès.
 * Volontairement pas sur ModalShell.vue : la fermeture doit être bloquée
 * (pas de clic-fond, pas d'Escape) pendant l'étape de révélation.
 */
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { X, RefreshCw, Copy, Check, ShieldAlert } from 'lucide-vue-next'
import * as cls from '../../lib/formClasses'
import { generatePassword } from '../../lib/password'
import { useUserStore } from '../../stores/users'
import { useEmployeeStore } from '../../stores/employees'
import { useEmployeeCategoryStore } from '../../stores/employeeCategories'

const props = defineProps<{
  employeeId: string
  employeeName: string
  employeeEmail?: string
}>()
const emit = defineEmits<{ close: []; created: [userId: string] }>()

const store = useUserStore()
const employeeStore = useEmployeeStore()
const categoryStore = useEmployeeCategoryStore()
onMounted(() => {
  if (categoryStore.categories.length === 0) categoryStore.fetchAll()
})

const step = ref<'form' | 'reveal'>('form')
const error = ref('')
const submitting = ref(false)
const copied = ref(false)
const createdUserId = ref('')

// Présélectionne la catégorie déjà assignée à l'employé (voir
// Employee.employeeCategoryId, Configuration > Catégories) — l'admin RH
// peut toujours en choisir une autre à cet instant.
const form = reactive({
  username: props.employeeEmail ?? '',
  employeeCategoryId: employeeStore.getById(props.employeeId)?.employeeCategoryId ?? '',
  password: generatePassword(),
  mustChangePassword: true,
})

function regenerate() {
  form.password = generatePassword()
  copied.value = false
}

async function copyPassword() {
  await navigator.clipboard.writeText(form.password)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

async function submit() {
  if (!form.username.trim()) { error.value = "Le nom d'utilisateur est obligatoire"; return }
  if (!form.employeeCategoryId) { error.value = 'La catégorie est obligatoire'; return }
  if (!props.employeeEmail) { error.value = "L'employé doit avoir un email pour créer un compte"; return }
  error.value = ''
  submitting.value = true
  try {
    const created = await store.createUserAccount({
      employeeId: props.employeeId, username: form.username,
      email: props.employeeEmail, password: form.password, employeeCategoryId: form.employeeCategoryId,
      mustChangePassword: form.mustChangePassword,
    }) as { Id: string }
    createdUserId.value = created.Id
    step.value = 'reveal'
  } catch {
    error.value = store.error ?? 'La création a échoué. Veuillez réessayer.'
  } finally {
    submitting.value = false
  }
}

function finish() {
  emit('created', createdUserId.value)
  emit('close')
}

// Fermeture bloquée pendant la révélation — seul le bouton explicite ferme.
// Capture (3e argument true) + stopPropagation : ce dialog s'ouvre par-dessus
// une CardModalShell (fiche employé) qui a son propre listener Escape en
// phase bubble, monté avant celui-ci — sans la phase capture, ce listener-ci
// se déclencherait après celui de la fiche et ne pourrait plus l'empêcher de
// se fermer.
const onKeydown = (e: KeyboardEvent) => {
  if (e.key !== 'Escape') return
  e.stopPropagation()
  if (step.value === 'form') emit('close')
}
onMounted(() => document.addEventListener('keydown', onKeydown, true))
onUnmounted(() => document.removeEventListener('keydown', onKeydown, true))
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[1000]"
      @click.self="step === 'form' && emit('close')"
    >
      <div class="relative bg-card text-card-foreground rounded-xl p-7 max-sm:p-5 w-[90%] max-w-[440px] shadow-[0_8px_32px_rgba(0,0,0,0.16)] flex flex-col">

        <template v-if="step === 'form'">
          <div class="flex items-center justify-between mb-5">
            <span class="text-[15px] font-semibold text-foreground">Créer un compte utilisateur</span>
            <button class="w-7 h-7 bg-background rounded-md cursor-pointer flex items-center justify-center text-muted-foreground shrink-0 transition-colors hover:bg-border hover:text-foreground" @click="emit('close')">
              <X class="w-4 h-4" />
            </button>
          </div>

          <p class="text-xs text-muted-foreground -mt-2 mb-3">
            Donne à <strong>{{ employeeName }}</strong> un accès de connexion à l'application.
          </p>

          <p v-if="error" class="text-xs text-danger bg-danger-bg px-3 py-2 rounded-md mb-3">{{ error }}</p>

          <div class="flex flex-col gap-3.5">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Nom d'utilisateur *</label>
              <input v-model="form.username" :class="cls.fieldInput" placeholder="prenom.nom@hv.com" />
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Catégorie *</label>
              <select v-model="form.employeeCategoryId" :class="cls.fieldSelect">
                <option value="">-- Choisir --</option>
                <option v-for="c in categoryStore.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
              <p class="text-[11px] text-muted-foreground mt-1">Détermine les permissions accordées à ce compte à sa création, modifiables individuellement ensuite.</p>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Mot de passe temporaire</label>
              <div class="flex items-center gap-2">
                <input :value="form.password" readonly :class="[cls.fieldInput, 'font-mono']" />
                <button type="button" title="Régénérer" class="w-9 h-9 shrink-0 flex items-center justify-center border border-border rounded-md text-muted-foreground hover:bg-background hover:text-primary" @click="regenerate">
                  <RefreshCw class="w-4 h-4" />
                </button>
              </div>
            </div>
            <label class="flex items-center gap-2 text-[13px] text-foreground cursor-pointer">
              <input type="checkbox" v-model="form.mustChangePassword" class="accent-primary" />
              Changer le mot de passe à la première connexion
            </label>
          </div>

          <div class="flex gap-2 justify-end mt-5 pt-4 border-t border-border">
            <button :class="cls.btnOutline" @click="emit('close')">Annuler</button>
            <button :class="cls.btnPrimary" :disabled="submitting" @click="submit">{{ submitting ? 'Création…' : 'Créer le compte' }}</button>
          </div>
        </template>

        <template v-else>
          <div class="flex items-center gap-2 mb-4">
            <ShieldAlert class="w-5 h-5 text-warning shrink-0" />
            <span class="text-[15px] font-semibold text-foreground">Compte créé, notez le mot de passe</span>
          </div>

          <p class="text-xs text-muted-foreground mb-3">
            Ce mot de passe ne sera <strong>plus jamais affiché</strong>. Transmettez-le à {{ employeeName }} maintenant.
            <template v-if="form.mustChangePassword">Il devra le changer à sa première connexion.</template>
          </p>

          <div class="flex items-center gap-2 bg-background border border-border rounded-md px-3 py-2.5">
            <span class="font-mono text-sm flex-1 select-all">{{ form.password }}</span>
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
