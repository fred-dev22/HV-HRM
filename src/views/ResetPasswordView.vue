<template>
  <div class="min-h-screen flex items-center justify-center bg-primary/10 max-[480px]:items-start max-[480px]:p-4">
    <div class="bg-card rounded-xl p-10 w-full max-w-[420px] shadow-[0_2px_16px_rgba(0,0,0,0.08)] max-[480px]:p-6 max-[480px]:w-[90%] max-[480px]:my-4">

      <div class="flex justify-center mb-4">
        <img src="/hv-logo.png" alt="Productive 247" class="h-14 w-auto" />
      </div>

      <template v-if="!token">
        <p class="text-[13px] text-danger bg-danger-bg px-3 py-2 rounded-md text-center">
          Lien invalide — aucun jeton de réinitialisation trouvé. Redemandez un lien depuis la page de connexion.
        </p>
      </template>

      <template v-else-if="!done">
        <h1 class="text-[22px] font-bold text-foreground text-center mb-2">Nouveau mot de passe</h1>
        <p class="text-[13px] text-muted-foreground text-center mb-6">Choisissez un nouveau mot de passe pour votre compte.</p>

        <div class="mb-4">
          <label class="block text-[13px] font-medium text-foreground mb-1.5">Nouveau mot de passe</label>
          <input
            v-model="form.newPassword"
            type="password"
            placeholder="8 caractères minimum"
            autocomplete="new-password"
            class="w-full h-12 px-3 border border-border rounded-lg text-sm bg-primary/10 text-foreground outline-none transition-colors focus:border-primary focus:bg-card"
          />
        </div>
        <div class="mb-4">
          <label class="block text-[13px] font-medium text-foreground mb-1.5">Confirmer le nouveau mot de passe</label>
          <input
            v-model="form.confirmPassword"
            type="password"
            autocomplete="new-password"
            class="w-full h-12 px-3 border border-border rounded-lg text-sm bg-primary/10 text-foreground outline-none transition-colors focus:border-primary focus:bg-card"
            @keydown.enter="submit"
          />
        </div>

        <p v-if="error" class="text-xs text-danger bg-danger-bg px-3 py-2 rounded-md mb-3.5">{{ error }}</p>

        <button
          class="w-full h-12 bg-primary text-primary-foreground rounded-lg text-sm font-semibold cursor-pointer transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-primary/90"
          :disabled="loading"
          @click="submit"
        >
          <ArrowRight class="w-[18px] h-[18px]" />
          {{ loading ? 'Enregistrement…' : 'Réinitialiser mon mot de passe' }}
        </button>
      </template>

      <template v-else>
        <div class="flex justify-center mb-4">
          <div class="w-14 h-14 rounded-full bg-success-bg flex items-center justify-center">
            <CheckCircle2 class="w-7 h-7 text-success" />
          </div>
        </div>
        <h1 class="text-[20px] font-bold text-foreground text-center mb-2">Mot de passe réinitialisé</h1>
        <p class="text-[13px] text-muted-foreground text-center mb-6">Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
        <router-link :to="{ name: 'login' }" class="block w-full h-12 bg-primary text-primary-foreground rounded-lg text-sm font-semibold flex items-center justify-center no-underline hover:bg-primary/90">
          Aller à la connexion
        </router-link>
      </template>

      <div v-if="!done" class="text-center mt-5">
        <router-link :to="{ name: 'login' }" class="text-[12px] text-primary hover:underline">← Retour à la connexion</router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowRight, CheckCircle2 } from 'lucide-vue-next'
import { api, getApiErrorMessage } from '../lib/api'

const route = useRoute()
const token = (route.query.token as string) || ''

const form = reactive({ newPassword: '', confirmPassword: '' })
const loading = ref(false)
const error   = ref('')
const done    = ref(false)

async function submit() {
  if (form.newPassword.length < 8) { error.value = 'Le mot de passe doit contenir au moins 8 caractères'; return }
  if (form.newPassword !== form.confirmPassword) { error.value = 'Les mots de passe ne correspondent pas'; return }
  error.value = ''
  loading.value = true
  try {
    await api.post('/auth/reset-password', { token, newPassword: form.newPassword })
    done.value = true
  } catch (err) {
    error.value = getApiErrorMessage(err, 'La réinitialisation a échoué. Le lien a peut-être expiré.')
  } finally {
    loading.value = false
  }
}
</script>
