<template>
  <div class="min-h-screen flex items-center justify-center bg-primary/10 max-[480px]:items-start max-[480px]:p-4">
    <div class="bg-card rounded-xl p-10 w-full max-w-[420px] shadow-[0_2px_16px_rgba(0,0,0,0.08)] max-[480px]:p-6 max-[480px]:w-[90%] max-[480px]:my-4">

      <div class="flex justify-center mb-4">
        <img src="/hv-logo.png" alt="Productive 247" class="h-14 w-auto" />
      </div>

      <h1 class="text-[22px] font-bold text-foreground text-center mb-2">{{ t('login.title') }}</h1>
      <p class="text-[13px] text-muted-foreground text-center mb-6">{{ t('login.subtitle') }}</p>

      <div class="mb-4">
        <label for="email" :class="labelClass">{{ t('login.username') }}</label>
        <input
          id="email"
          v-model="email"
          type="email"
          placeholder="prenom.nom@hv.com"
          autocomplete="email"
          :class="inputClass"
        />
      </div>

      <div class="mb-4">
        <label for="password" :class="labelClass">{{ t('login.password') }}</label>
        <div class="relative">
          <input
            id="password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="••••••••"
            autocomplete="current-password"
            :class="[inputClass, 'pr-11']"
          />
          <button
            type="button"
            class="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-0 cursor-pointer text-muted-foreground flex items-center hover:text-foreground"
            @click="showPassword = !showPassword"
            tabindex="-1"
          >
            <EyeOff v-if="showPassword" class="w-[18px] h-[18px]" />
            <Eye v-else class="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      <div class="flex justify-end -mt-1 mb-3.5">
        <router-link
          to="/forgot-password"
          class="text-[12px] text-primary cursor-pointer hover:underline no-underline"
        >
          {{ t('login.forgot_password') }}
        </router-link>
      </div>

      <p v-if="error" class="text-xs text-danger bg-danger-bg px-3 py-2 rounded-md mb-3.5">{{ error }}</p>

      <button
        class="login-btn w-full h-12 bg-primary text-primary-foreground rounded-lg text-sm font-semibold cursor-pointer transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-primary/90"
        :disabled="loading"
        @click="handleLogin"
      >
        <ArrowRight class="w-[18px] h-[18px]" />
        {{ loading ? t('login.loading') : t('login.submit') }}
      </button>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Eye, EyeOff, ArrowRight } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth   = useAuthStore()
const { t }  = useI18n()

const email        = ref('')
const password     = ref('')
const showPassword = ref(false)
const loading      = ref(false)
const error        = ref('')

// ── Classes du design system ─────────────────────────────────
const labelClass = 'block text-[13px] font-medium text-foreground mb-1.5'
const inputClass = 'w-full h-12 px-3 border border-border rounded-lg text-sm bg-primary/10 text-foreground outline-none transition-colors focus:border-primary focus:bg-card'

async function handleLogin() {
  if (!email.value || !password.value) {
    error.value = t('login.error_fields')
    return
  }
  error.value = ''
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    router.push(auth.isHRSpace ? { name: 'hr-dashboard' } : { name: 'employee-dashboard' })
  } catch {
    error.value = t('login.error_invalid')
  } finally {
    loading.value = false
  }
}
</script>
