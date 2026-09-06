<template>
  <!--
    Wrapper rétro-compatible : empile la barre sombre (AppTopBar) et la barre
    de navigation (AppNavBar). Conservé pour les vues qui rendent encore leur
    propre shell. Les vues migrées passent par DashboardLayout, qui rend
    AppTopBar et AppNavBar séparément (AppNavBar dans #below-topbar pour que
    les cards la recouvrent).
  -->
  <AppTopBar :user="user" />
  <AppNavBar />
</template>

<script setup lang="ts">
import AppTopBar from './AppTopBar.vue'
import AppNavBar from './AppNavBar.vue'
import type { AuthUser } from '../types'

defineProps<{ user: AuthUser | null }>()
</script>
