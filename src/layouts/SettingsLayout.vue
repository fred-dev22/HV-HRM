<script setup lang="ts">
/**
 * Espace « Paramètres de l'application » : réglages qui concernent toute
 * l'application (et non un module), ouvert par l'engrenage de la barre noire et
 * réservé au compte administrateur de lancement. Même barre noire et même bande
 * d'alerte que le reste de l'app, mais pas de barre de modules : une navigation
 * latérale propre aux paramètres. Les réglages à venir s'ajoutent simplement à
 * la liste ITEMS ci-dessous.
 */
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ArrowLeft, FolderOpen, Mail, Settings } from 'lucide-vue-next'
import AppTopBar from '../components/AppTopBar.vue'
import AppConfigBanner from '../components/AppConfigBanner.vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const route = useRoute()

const ITEMS = [
  { name: 'settings-mail', to: '/settings/mail', label: 'Messagerie', hint: "Envoi des emails de l'application", icon: Mail },
  { name: 'settings-storage', to: '/settings/storage', label: 'Stockage', hint: 'Où sont gardés les justificatifs et pièces jointes', icon: FolderOpen },
]

const backTo = computed(() => (auth.isHRSpace ? '/hr' : '/employee'))
const isActive = (name: string) => route.name === name
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden">
    <AppTopBar :user="auth.user" />
    <AppConfigBanner />
    <div class="flex flex-1 min-h-0 max-md:flex-col">
      <aside class="w-[264px] shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col gap-1 px-[5px] py-5 overflow-y-auto max-md:w-full max-md:border-r-0 max-md:border-b">
        <RouterLink
          :to="backTo"
          class="flex items-center gap-2 pl-5 pr-4 py-2 text-[13px] text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <ArrowLeft class="w-4 h-4" /> Retour à l'application
        </RouterLink>

        <div class="flex items-center gap-2 pl-5 pr-4 pt-5 pb-2">
          <Settings class="w-4 h-4 text-primary" />
          <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Paramètres</span>
        </div>

        <nav class="flex flex-col gap-1">
          <RouterLink
            v-for="item in ITEMS"
            :key="item.name"
            :to="item.to"
            :aria-current="isActive(item.name) ? 'page' : undefined"
            :class="[
              // Meme mise en evidence que la barre laterale des modules (AppSidebar).
              'flex items-start gap-2.5 pl-5 pr-4 py-2.5 transition-colors',
              isActive(item.name)
                ? 'bg-sidebar-accent text-sidebar-accent-foreground border-r-2 border-sidebar-primary'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            ]"
          >
            <component :is="item.icon" class="w-[18px] h-[18px] mt-0.5 shrink-0" />
            <span class="min-w-0">
              <span class="block text-[13px] font-semibold leading-tight">{{ item.label }}</span>
              <span class="block text-[11px] text-muted-foreground mt-0.5 leading-snug">{{ item.hint }}</span>
            </span>
          </RouterLink>
        </nav>
      </aside>

      <main class="flex-1 min-w-0 overflow-y-auto bg-background">
        <slot />
      </main>
    </div>
  </div>
</template>
