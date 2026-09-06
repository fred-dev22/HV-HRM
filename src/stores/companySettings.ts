import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, getApiErrorMessage } from '../lib/api'
import { withToast } from '../lib/withToast'

export interface CompanySettings {
  id: string
  companyName: string
  currency: string
  timezone: string
  dayCountingRule: 'WorkingDays' | 'CalendarDays'
  defaultMonthlyAccrualRate: number
  defaultCarryOverCap: number
  leaveAccrualRunDay: number | null
  lastLeaveAccrualRunAt: string | null
  isOnboarded: boolean
  // Derniere portee consultee dans Configuration > Calendrier — persistee
  // ici (et non en localStorage) pour que n'importe quel admin, sur
  // n'importe quel poste, retrouve l'etat laisse (voir CalendarView.vue).
  calendarConfigScope: 'Global' | 'Category' | null
  calendarConfigCategoryId: string | null
}

interface BackendCompanySettings {
  Id: string
  CompanyName: string
  Currency: string
  Timezone: string
  DayCountingRule: 'WorkingDays' | 'CalendarDays'
  DefaultMonthlyAccrualRate: string | number
  DefaultCarryOverCap: number
  LeaveAccrualRunDay: number | null
  LastLeaveAccrualRunAt: string | null
  IsOnboarded: boolean
  CalendarConfigScope: 'Global' | 'Category' | null
  CalendarConfigCategoryId: string | null
}

function mapSettings(raw: BackendCompanySettings): CompanySettings {
  return {
    id: raw.Id,
    companyName: raw.CompanyName,
    currency: raw.Currency,
    timezone: raw.Timezone,
    dayCountingRule: raw.DayCountingRule,
    defaultMonthlyAccrualRate: Number(raw.DefaultMonthlyAccrualRate),
    defaultCarryOverCap: raw.DefaultCarryOverCap,
    leaveAccrualRunDay: raw.LeaveAccrualRunDay,
    lastLeaveAccrualRunAt: raw.LastLeaveAccrualRunAt,
    isOnboarded: raw.IsOnboarded,
    calendarConfigScope: raw.CalendarConfigScope,
    calendarConfigCategoryId: raw.CalendarConfigCategoryId,
  }
}

export const useCompanySettingsStore = defineStore('companySettings', () => {
  const settings = ref<CompanySettings | null>(null)
  // null = pas encore vérifié, true/false = statut connu — le routeur attend
  // cet état avant de décider s'il affiche l'onboarding.
  const isOnboarded = ref<boolean | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchSettings() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendCompanySettings>('/company-settings')
      settings.value = mapSettings(data)
      isOnboarded.value = data.IsOnboarded
      return settings.value
    } catch (err) {
      // 404 = paramètres jamais initialisés = onboarding jamais complété.
      isOnboarded.value = false
      settings.value = null
      error.value = getApiErrorMessage(err, "Impossible de charger les paramètres de l'entreprise")
      throw err
    } finally {
      loading.value = false
    }
  }

  async function completeOnboarding(payload: { companyName: string; currency: string; timezone: string }) {
    error.value = null
    try {
      const { data } = await api.post<BackendCompanySettings>('/company-settings/complete-onboarding', {
        CompanyName: payload.companyName,
        Currency: payload.currency,
        Timezone: payload.timezone,
      })
      settings.value = mapSettings(data)
      isOnboarded.value = true
      return settings.value
    } catch (err) {
      error.value = getApiErrorMessage(err, "Impossible de finaliser la configuration initiale")
      throw err
    }
  }

  async function update(payload: Partial<{
    companyName: string; currency: string; timezone: string
    dayCountingRule: 'WorkingDays' | 'CalendarDays'
    defaultMonthlyAccrualRate: number; defaultCarryOverCap: number
    leaveAccrualRunDay: number | null
  }>) {
    error.value = null
    return withToast('Enregistrement en cours…', async () => {
      try {
        const body: Record<string, unknown> = {}
        if (payload.companyName !== undefined) body.CompanyName = payload.companyName
        if (payload.currency !== undefined) body.Currency = payload.currency
        if (payload.timezone !== undefined) body.Timezone = payload.timezone
        if (payload.dayCountingRule !== undefined) body.DayCountingRule = payload.dayCountingRule
        if (payload.defaultMonthlyAccrualRate !== undefined) body.DefaultMonthlyAccrualRate = payload.defaultMonthlyAccrualRate
        if (payload.defaultCarryOverCap !== undefined) body.DefaultCarryOverCap = payload.defaultCarryOverCap
        if (payload.leaveAccrualRunDay !== undefined) body.LeaveAccrualRunDay = payload.leaveAccrualRunDay
        const { data } = await api.patch<BackendCompanySettings>('/company-settings', body)
        settings.value = mapSettings(data)
        return settings.value
      } catch (err) {
        error.value = getApiErrorMessage(err, "Impossible de mettre à jour les paramètres de l'entreprise")
        throw err
      }
    }, () => error.value ?? "Impossible de mettre à jour les paramètres de l'entreprise")
  }

  // Persiste la portee du calendrier consultee (Global ou Categorie) —
  // action silencieuse (pas de withToast) : c'est une preference de
  // navigation, pas une modification de parametre que l'admin doit voir
  // confirmee par un toast a chaque bascule.
  async function updateCalendarScope(scope: 'Global' | 'Category', employeeCategoryId: string | null) {
    try {
      const { data } = await api.patch<BackendCompanySettings>('/company-settings', {
        CalendarConfigScope: scope,
        CalendarConfigCategoryId: scope === 'Category' ? employeeCategoryId : null,
      })
      settings.value = mapSettings(data)
      return settings.value
    } catch {
      // Non bloquant : la portee ne sera simplement pas restauree au
      // prochain chargement, pas d'impact sur l'edition en cours.
      return null
    }
  }

  return { settings, isOnboarded, loading, error, fetchSettings, completeOnboarding, update, updateCalendarScope }
})
