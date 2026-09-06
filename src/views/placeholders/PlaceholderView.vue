<template>
  <div :class="L.shell">
    <AppTopNav :user="auth.user" />
    <div :class="L.mainLayout">
      <AppSidebar />
      <main :class="L.content">
        <ComingSoonView :title="(route.meta.title as string) ?? 'Module en développement'" />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { AppTopNav, AppSidebar, ComingSoonView } from '../../components'
import * as L from '../../lib/listClasses'
import { useAuthStore } from '../../stores/auth'

const auth  = useAuthStore()
const route = useRoute()
</script>
