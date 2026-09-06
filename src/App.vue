<template>
  <DashboardLayout v-if="$route.meta.layout === 'dashboard'">
    <RouterView />
  </DashboardLayout>
  <RouterView v-else />
  <Snackbar />
  <ConfirmDialog />
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import DashboardLayout from './layouts/DashboardLayout.vue'
import Snackbar from './components/ui/Snackbar.vue'
import ConfirmDialog from './components/ui/ConfirmDialog.vue'
</script>
