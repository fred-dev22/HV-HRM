import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../lib/api'

// Chiffres du tableau de bord RH, calcules en base sur l'ensemble des donnees
// (GET /dashboard/summary) : exacts quel que soit le volume, sans charger les
// listes. Un bloc vaut null si l'utilisateur n'a pas la permission de le voir.
export interface DashboardSummary {
  employees: { total: number; active: number; newThisMonth: number } | null
  leaves: { pending: number; approvedThisMonth: number; absentToday: number; approvedTotal: number } | null
}

export const useDashboardStore = defineStore('dashboard', () => {
  const summary = ref<DashboardSummary | null>(null)
  const loading = ref(false)

  async function fetchSummary() {
    // Le squelette ne s'affiche qu'au premier chargement : un rafraichissement
    // temps reel remplace les chiffres sans clignotement.
    if (!summary.value) loading.value = true
    try {
      const { data } = await api.get<DashboardSummary>('/dashboard/summary')
      summary.value = data
    } finally {
      loading.value = false
    }
  }

  return { summary, loading, fetchSummary }
})
