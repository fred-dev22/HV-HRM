<template>
  <div class="min-h-screen flex items-center justify-center bg-primary/10 max-[480px]:items-start max-[480px]:p-4">
    <div class="bg-card rounded-xl p-10 w-full max-w-[420px] shadow-[0_2px_16px_rgba(0,0,0,0.08)] max-[480px]:p-6 max-[480px]:w-[90%] max-[480px]:my-4">

      <div class="flex justify-center mb-4">
        <img src="/hv-logo.png" alt="Productive 247" class="h-14 w-auto" />
      </div>

      <template v-if="!sent">
        <h1 class="text-[22px] font-bold text-foreground text-center mb-2">Mot de passe oublié</h1>
        <p class="text-[13px] text-muted-foreground text-center mb-6">
          Indiquez votre email professionnel — si un compte existe, un lien de réinitialisation vous sera envoyé.
        </p>

        <div class="mb-4">
          <label for="email" class="block text-[13px] font-medium text-foreground mb-1.5">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="prenom.nom@hv.com"
            autocomplete="email"
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
          {{ loading ? 'Envoi…' : 'Envoyer le lien de réinitialisation' }}
        </button>
      </template>

      <template v-else>
        <div class="flex justify-center mb-4">
          <div class="w-14 h-14 rounded-full bg-success-bg flex items-center justify-center">
            <MailCheck class="w-7 h-7 text-success" />
          </div>
        </div>
        <h1 class="text-[20px] font-bold text-foreground text-center mb-2">Email envoyé</h1>
        <p class="text-[13px] text-muted-foreground text-center mb-6">
          Si un compte existe pour <strong class="text-foreground">{{ email }}</strong>, un email contenant un lien de réinitialisation vient de lui être envoyé. Le lien expire dans 1 heure.
        </p>
      </template>

      <div class="text-center mt-5">
        <router-link :to="{ name: 'login' }" class="text-[12px] text-primary hover:underline">← Retour à la connexion</router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowRight, MailCheck } from 'lucide-vue-next'
import { api, getApiErrorMessage } from '../lib/api'

const email   = ref('')
const loading = ref(false)
const error   = ref('')
const sent    = ref(false)

async function submit() {
  if (!email.value) { error.value = "L'email est obligatoire"; return }
  error.value = ''
  loading.value = true
  try {
    await api.post('/auth/forgot-password', { email: email.value })
    sent.value = true
  } catch (err) {
    error.value = getApiErrorMessage(err, "L'envoi a échoué. Veuillez réessayer.")
  } finally {
    loading.value = false
  }
}
</script>
