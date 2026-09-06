<template>
  <div class="min-h-screen flex flex-col">

    <!-- ── En-tête minimal ── -->
    <header class="h-[60px] shrink-0 bg-card border-b border-border shadow-[0_1px_4px_rgba(0,0,0,0.06)] px-10 flex items-center justify-between max-[480px]:px-4">
      <div class="flex items-center">
        <img src="/hv-logo.png" alt="HV" class="h-[34px] block" />
      </div>
      <span class="bg-warning/10 text-warning border border-warning/20 px-3 py-1 rounded-full text-[11px] font-semibold">Sécurité du compte</span>
    </header>

    <div class="flex-1 flex flex-col items-center justify-center px-6 py-10">
      <div class="w-full max-w-[420px] bg-card border border-border rounded-lg p-6">
        <h1 class="text-xl font-bold text-foreground">Changement de mot de passe requis</h1>
        <p class="text-[13px] text-muted-foreground mt-1.5 mb-5">
          Votre compte vient d'être créé avec un mot de passe temporaire. Choisissez un nouveau mot de passe pour continuer.
        </p>

        <p v-if="error" class="text-xs text-danger bg-danger-bg px-3 py-2 rounded-md mb-3">{{ error }}</p>

        <div :class="cls.field">
          <label :class="cls.fieldLabel">Mot de passe actuel (temporaire) *</label>
          <input v-model="form.currentPassword" type="password" :class="cls.fieldInput" autocomplete="current-password" />
        </div>
        <div :class="[cls.field, 'mt-3']">
          <label :class="cls.fieldLabel">Nouveau mot de passe *</label>
          <input v-model="form.newPassword" type="password" :class="cls.fieldInput" autocomplete="new-password" placeholder="8 caractères minimum" />
        </div>
        <div :class="[cls.field, 'mt-3']">
          <label :class="cls.fieldLabel">Confirmer le nouveau mot de passe *</label>
          <input v-model="form.confirmPassword" type="password" :class="cls.fieldInput" autocomplete="new-password" />
        </div>

        <button :class="[cls.btnPrimary, 'w-full justify-center mt-5']" :disabled="submitting" @click="submit">
          {{ submitting ? 'Enregistrement…' : 'Changer le mot de passe' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as cls from '../lib/formClasses'
import { useAuthStore } from '../stores/auth'
import { getApiErrorMessage } from '../lib/api'

const auth   = useAuthStore()
const router = useRouter()

const form = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const error = ref('')
const submitting = ref(false)

async function submit() {
  if (!form.currentPassword) { error.value = 'Le mot de passe actuel est requis'; return }
  if (form.newPassword.length < 8) { error.value = 'Le nouveau mot de passe doit contenir au moins 8 caractères'; return }
  if (form.newPassword !== form.confirmPassword) { error.value = 'Les mots de passe ne correspondent pas'; return }
  error.value = ''
  submitting.value = true
  try {
    await auth.changePassword(form.currentPassword, form.newPassword)
    router.push({ name: auth.isHRSpace ? 'hr-dashboard' : 'employee-dashboard' })
  } catch (err) {
    error.value = getApiErrorMessage(err, 'Le changement de mot de passe a échoué. Veuillez réessayer.')
  } finally {
    submitting.value = false
  }
}
</script>
