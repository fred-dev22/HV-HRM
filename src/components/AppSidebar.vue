<template>
  <aside
    class="relative shrink-0 bg-sidebar border-r border-sidebar-border py-2.5 hidden md:flex md:flex-col transition-[width] duration-200 ease-in-out"
    :class="collapsed ? 'w-[60px]' : 'w-[220px]'"
  >

  <!-- Réduire / agrandir — bouton flottant au milieu du bord droit -->
  <button
    type="button"
    class="absolute top-1/2 -right-3 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-card border border-border text-muted-foreground cursor-pointer flex items-center justify-center shadow-[0_1px_4px_rgba(0,0,0,0.12)] transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    :title="collapsed ? 'Agrandir' : 'Réduire'"
    @click="toggleCollapsed"
  >
    <ChevronLeft v-if="!collapsed" class="w-3.5 h-3.5" />
    <ChevronRight v-else class="w-3.5 h-3.5" />
  </button>

  <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-[5px]">

    <!-- Session en cours de restauration (rechargement de page) -->
    <SkeletonLoader v-if="auth.isRestoring" type="list" :lines="6" class="px-2" />

    <!-- ══════════ CÔTÉ RH ══════════ -->
    <template v-else-if="auth.isHRSpace">

      <!-- MODULE : Administration -->
      <template v-if="navStore.activeModule === 'administration'">
        <SidebarSection :label="t('sidebar.dashboard')">
          <SidebarItem :icon="LayoutDashboard" :label="t('sidebar.overview')"    :to="{ name: 'hr-dashboard' }" />
          <SidebarItem :icon="CalendarRange"   :label="t('sidebar.my_planning')" :to="{ name: 'hr-planning' }" />
        </SidebarSection>

        <SidebarSection v-if="auth.hasAnyPermission(['CONGE_VOIR_TOUT', 'CONGE_VOIR_EQUIPE'])" :label="t('sidebar.absence_requests')" data-tour="absences">
          <SidebarItem :icon="CalendarOff" :label="t('sidebar.requests')" :to="{ name: 'hr-absences' }"       :badge="pendingCount" />
          <SidebarItem :icon="PieChart"    :label="t('sidebar.balances')" :to="{ name: 'hr-leave-balances' }" />
        </SidebarSection>

        <SidebarSection v-if="canSeeManagementSection" :label="t('sidebar.management')" data-tour="management">
          <SidebarItem v-if="auth.hasAnyPermission(['EMPLOYE_VOIR_TOUT', 'EMPLOYE_VOIR_EQUIPE'])" :icon="Users"    :label="t('sidebar.employees')" :to="{ name: 'hr-employees' }" />
          <SidebarItem v-if="auth.hasPermission('ENTITE_VOIR')"                                    :icon="Building" :label="t('sidebar.entities')"  :to="{ name: 'hr-entities' }" />
          <SidebarItem v-if="MISSIONS_EXPENSES_ENABLED && auth.hasAnyPermission(['MISSION_VOIR_TOUT', 'MISSION_VOIR_EQUIPE'])"  :icon="Plane"    :label="t('sidebar.missions')"  :to="{ name: 'hr-missions' }" />
          <SidebarItem v-if="MISSIONS_EXPENSES_ENABLED && auth.hasAnyPermission(['FRAIS_VOIR_TOUT', 'FRAIS_VOIR_EQUIPE'])"      :icon="Receipt"  :label="t('sidebar.expenses')"  :to="{ name: 'hr-expenses' }" />
          <SidebarItem v-if="auth.hasPermission('ENTITE_VOIR')"                                    :icon="Network"  :label="t('sidebar.org_chart')" :to="{ name: 'hr-org-chart' }" />
        </SidebarSection>

        <SidebarSection v-if="canSeeConfigSection" :label="t('sidebar.configuration')" data-tour="config">
          <SidebarItem v-if="auth.hasPermission('CONFIG_CALENDRIER')"     :icon="CalendarDays" :label="t('sidebar.config_calendar')" :to="{ name: 'hr-config-calendar' }" />
          <SidebarItem v-if="auth.hasAnyPermission(['CONFIG_METIERS_POSTES', 'CONFIG_CATEGORIES_EMPLOYE'])" :icon="Tags" :label="t('sidebar.classification')" :to="{ name: 'hr-config-classification' }" />
          <SidebarItem v-if="MISSIONS_EXPENSES_ENABLED && auth.hasPermission('CONFIG_FRAIS_MISSION')"  :icon="Coins"        :label="t('sidebar.fees_perdiems')"   :to="{ name: 'hr-config-mission-fees' }" />
        </SidebarSection>
      </template>

      <!-- MODULE : Recrutement -->
      <template v-else-if="navStore.activeModule === 'recruitment'">
        <SidebarSection :label="t('nav.recruitment')">
          <SidebarItem :icon="LayoutDashboard" :label="t('sidebar.dashboard')"    :to="{ name: 'hr-recruitment' }" />
          <SidebarItem :icon="Briefcase"       :label="t('sidebar.job_offers')"   :to="{ name: 'hr-recruitment-positions' }" />
          <SidebarItem :icon="Users"           :label="t('sidebar.applications')" :to="{ name: 'hr-recruitment-applications' }" />
          <SidebarItem :icon="Calendar"        :label="t('sidebar.interviews')"   :to="{ name: 'hr-recruitment-interviews' }" />
          <SidebarItem :icon="GitMerge"        :label="t('sidebar.pipeline')"     :to="{ name: 'hr-recruitment-pipeline' }" />
        </SidebarSection>
        <SidebarSection :label="t('sidebar.candidates')">
          <SidebarItem :icon="BookUser" :label="t('sidebar.cvtheque')"         :to="{ name: 'hr-recruitment-cv-library' }" />
          <SidebarItem :icon="Inbox"    :label="t('sidebar.spontaneous_apps')" :to="{ name: 'hr-recruitment-spontaneous' }" />
        </SidebarSection>
        <SidebarSection :label="t('sidebar.hr_admin_section')">
          <SidebarItem :icon="FilePlus" :label="t('sidebar.needs')"                 :to="{ name: 'hr-recruitment-needs' }" />
          <SidebarItem :icon="FileText" :label="t('sidebar.contracts_to_generate')" :to="{ name: 'hr-recruitment-contracts' }" />
          <SidebarItem :icon="Clock"    :label="t('sidebar.trial_periods')"         :to="{ name: 'hr-recruitment-trial' }" />
        </SidebarSection>
      </template>

      <!-- MODULE : Formation -->
      <template v-else-if="navStore.activeModule === 'training'">
        <SidebarSection :label="t('nav.training')">
          <SidebarItem :icon="LayoutDashboard" :label="t('sidebar.dashboard')"   :to="{ name: 'hr-training' }" />
          <SidebarItem :icon="Library"         :label="t('sidebar.catalog')"     :to="{ name: 'hr-training-catalog' }" />
          <SidebarItem :icon="CalendarDays"    :label="t('sidebar.sessions')"    :to="{ name: 'hr-training-sessions' }" />
          <SidebarItem :icon="UserPlus"        :label="t('sidebar.enrollments')" :to="{ name: 'hr-training-enrollments' }" />
        </SidebarSection>
        <SidebarSection :label="t('sidebar.evaluation')">
          <SidebarItem :icon="Flame"     :label="t('sidebar.hot_evals')"          :to="{ name: 'hr-training-hot-evals' }" />
          <SidebarItem :icon="Snowflake" :label="t('sidebar.cold_evals')"         :to="{ name: 'hr-training-cold-evals' }" />
          <SidebarItem :icon="Star"      :label="t('sidebar.participants_notes')" :to="{ name: 'hr-training-grades' }" />
        </SidebarSection>
        <SidebarSection :label="t('sidebar.budget_section')">
          <SidebarItem :icon="Coins"    :label="t('sidebar.budget_tracking')" :to="{ name: 'hr-training-budget' }" />
          <SidebarItem :icon="Landmark" :label="t('sidebar.providers')"       :to="{ name: 'hr-training-providers' }" />
        </SidebarSection>
      </template>

      <!-- MODULE : Paie -->
      <template v-else-if="navStore.activeModule === 'payroll'">
        <SidebarSection :label="t('nav.payroll')">
          <SidebarItem :icon="LayoutDashboard" :label="t('sidebar.dashboard')"   :to="{ name: 'hr-payroll' }" />
          <SidebarItem :icon="Calendar"        :label="t('sidebar.pay_periods')" :to="{ name: 'hr-payroll-periods' }" />
          <SidebarItem :icon="ReceiptText"     :label="t('sidebar.payslips')"    :to="{ name: 'hr-payroll-payslips' }" />
          <SidebarItem :icon="List"            :label="t('sidebar.register')"    :to="{ name: 'hr-payroll-register' }" />
        </SidebarSection>
        <SidebarSection :label="t('sidebar.attendance')">
          <SidebarItem :icon="Clock3"     :label="t('sidebar.daily_tracking')" :to="{ name: 'hr-payroll-attendance' }" />
          <SidebarItem :icon="Upload"     :label="t('sidebar.import_csv')"     :to="{ name: 'hr-payroll-import' }" />
          <SidebarItem :icon="AlarmClock" :label="t('sidebar.overtime')"       :to="{ name: 'hr-payroll-overtime' }" />
        </SidebarSection>
        <SidebarSection :label="t('sidebar.regulatory_states')">
          <SidebarItem :icon="Landmark" label="CNaPS" :to="{ name: 'hr-payroll-cnaps' }" />
          <SidebarItem :icon="Landmark" label="OSTIE" :to="{ name: 'hr-payroll-ostie' }" />
          <SidebarItem :icon="Landmark" label="FMFP"  :to="{ name: 'hr-payroll-fmfp' }" />
          <SidebarItem :icon="Landmark" label="IRSA"  :to="{ name: 'hr-payroll-irsa' }" />
        </SidebarSection>
        <SidebarSection :label="t('sidebar.payroll_settings')">
          <SidebarItem :icon="Table"      :label="t('sidebar.salary_grids')" :to="{ name: 'hr-payroll-salary-grids' }" />
          <SidebarItem :icon="TrendingUp" :label="t('sidebar.raises')"       :to="{ name: 'hr-payroll-raises' }" />
          <SidebarItem :icon="Gift"       :label="t('sidebar.thirteenth')"   :to="{ name: 'hr-payroll-thirteenth' }" />
        </SidebarSection>
      </template>

      <!-- MODULE : Rapports -->
      <template v-else-if="navStore.activeModule === 'reports'">
        <SidebarSection v-if="auth.hasPermission('RAPPORT_VOIR') || auth.hasPermission('ENTITE_VOIR')" :label="t('sidebar.reports')">
          <SidebarItem v-if="auth.hasPermission('RAPPORT_VOIR')" :icon="BarChart3" :label="t('sidebar.statistics')" :to="{ name: 'hr-statistics' }" />
          <SidebarItem v-if="auth.hasPermission('ENTITE_VOIR')"  :icon="Network"   :label="t('sidebar.org_chart')"  :to="{ name: 'hr-org-chart' }" />
        </SidebarSection>
        <SidebarSection :label="t('sidebar.hr_reports')">
          <SidebarItem :icon="LayoutDashboard" :label="t('sidebar.hr_dashboard')" :to="{ name: 'hr-reports' }" />
          <SidebarItem :icon="Users"           :label="t('sidebar.staff_list')"   :to="{ name: 'hr-reports-headcount' }" />
          <SidebarItem :icon="ArrowLeftRight"  :label="t('sidebar.movements')"    :to="{ name: 'hr-reports-movements' }" />
          <SidebarItem :icon="BarChart3"       :label="t('sidebar.age_pyramid')"  :to="{ name: 'hr-reports-pyramid' }" />
        </SidebarSection>
        <SidebarSection :label="t('sidebar.analyses')">
          <SidebarItem :icon="Percent"      :label="t('sidebar.absenteeism')" :to="{ name: 'hr-reports-absenteeism' }" />
          <SidebarItem :icon="TrendingDown" :label="t('sidebar.turnover')"    :to="{ name: 'hr-reports-turnover' }" />
        </SidebarSection>
        <SidebarSection :label="t('sidebar.exports')">
          <SidebarItem :icon="FileSpreadsheet" :label="t('sidebar.export_excel')" :to="{ name: 'hr-reports-export-excel' }" />
          <SidebarItem :icon="FileText"        :label="t('sidebar.export_csv')"   :to="{ name: 'hr-reports-export-csv' }" />
          <SidebarItem :icon="Plug"            :label="t('sidebar.navision')"     :to="{ name: 'hr-reports-navision' }" />
        </SidebarSection>
      </template>

    </template>

    <!-- ══════════ CÔTÉ EMPLOYÉ / VALIDATEUR ══════════ -->
    <template v-else>
      <SidebarSection :label="t('sidebar.my_space')">
        <SidebarItem :icon="LayoutDashboard" :label="t('sidebar.dashboard')"   :to="{ name: 'employee-dashboard' }" />
        <SidebarItem :icon="CalendarRange"   :label="t('sidebar.my_planning')" :to="{ name: 'employee-planning' }" />
      </SidebarSection>

      <SidebarSection :label="t('sidebar.my_requests')">
        <SidebarItem :icon="CalendarOff" :label="t('sidebar.absence_requests')" :to="{ name: 'employee-absences' }" :badge="myPendingCount" />
        <SidebarItem v-if="MISSIONS_EXPENSES_ENABLED" :icon="Plane"   :label="t('sidebar.my_missions')"      :to="{ name: 'employee-missions' }" />
        <SidebarItem v-if="MISSIONS_EXPENSES_ENABLED" :icon="Receipt" :label="t('sidebar.expenses')"         :to="{ name: 'employee-expenses' }" />
      </SidebarSection>

      <!-- Visibilite d'une candidature interne (mobilite) proposee par un
           recruteur, voir JobOfferCard.vue — sans cette section, l'employe
           concerne n'en avait jamais connaissance. -->
      <SidebarSection v-if="RECRUITMENT_MODULE_ENABLED" :label="t('nav.recruitment')">
        <SidebarItem :icon="Briefcase" :label="t('sidebar.my_internal_applications')" :to="{ name: 'employee-internal-applications' }" />
      </SidebarSection>

      <template v-if="canSeeMyTeamSection">
        <SidebarSection :label="t('sidebar.my_team')">
          <SidebarItem
            v-if="auth.hasAnyPermission(['CONGE_VALIDER', 'MISSION_VALIDER', 'FRAIS_VALIDER'])"
            :icon="ClipboardCheck"
            :label="t('sidebar.to_validate')"
            :to="{ name: 'employee-to-validate' }"
            :badge="pendingCount"
            :badge-orange="true"
          />
          <SidebarItem v-if="auth.hasPermission('EMPLOYE_VOIR_EQUIPE')" :icon="Users" :label="t('sidebar.members')" :to="{ name: 'employee-team' }" />
        </SidebarSection>
      </template>
    </template>

  </div>

  </aside>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref, watch, type Component, type PropType } from 'vue'
import { RouterLink }         from 'vue-router'
import { useI18n }            from 'vue-i18n'
import {
  LayoutDashboard, CalendarRange, CalendarOff, PieChart, Users, Building, Plane,
  Receipt, Network, CalendarDays, Coins, Briefcase, Calendar, GitMerge, BookUser,
  Inbox, FilePlus, FileText, Clock, Library, UserPlus, Flame,
  Snowflake, Star, Landmark, ReceiptText, List, Clock3, Upload, AlarmClock, Table,
  TrendingUp, Gift, BarChart3, ArrowLeftRight, Percent, TrendingDown,
  FileSpreadsheet, Plug, ClipboardCheck, Tags, ChevronLeft, ChevronRight,
} from 'lucide-vue-next'
import { useAuthStore }       from '../stores/auth'
import { useNavigationStore } from '../stores/navigation'
import { useLeaveRequestStore } from '../stores/leaveRequests'
import { useMissionStore } from '../stores/missions'
import { useExpenseStore } from '../stores/expenses'
import SkeletonLoader from './ui/SkeletonLoader.vue'
import { MISSIONS_EXPENSES_ENABLED, RECRUITMENT_MODULE_ENABLED } from '../config/features'

const { t }        = useI18n()
const auth         = useAuthStore()
const navStore     = useNavigationStore()
const leaveStore   = useLeaveRequestStore()
const missionStore = useMissionStore()
const expenseStore = useExpenseStore()

// Le badge "A valider" doit refleter les 3 domaines, pas seulement les
// congés (bug corrige le 06/08) — chacun reste garde par sa propre
// permission *_VALIDER cote backend (voir leave/mission/expense controllers).
if (auth.hasPermission('CONGE_VALIDER') && leaveStore.pendingForMe.length === 0) leaveStore.fetchPendingForMe()
if (MISSIONS_EXPENSES_ENABLED && auth.hasPermission('MISSION_VALIDER') && missionStore.pendingForMe.length === 0) missionStore.fetchPendingForMe()
if (MISSIONS_EXPENSES_ENABLED && auth.hasPermission('FRAIS_VALIDER') && expenseStore.pendingForMe.length === 0) expenseStore.fetchPendingForMe()
if (leaveStore.mine.length === 0) leaveStore.fetchMine()

const MINE_PENDING = new Set(['Pending', 'InApprovalN1', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4'])
const pendingCount   = computed(() => leaveStore.pendingForMe.length + missionStore.pendingForMe.length + expenseStore.pendingForMe.length)
const myPendingCount = computed(() => leaveStore.mine.filter(l => MINE_PENDING.has(l.status)).length)

const canSeeManagementSection = computed(() => auth.hasAnyPermission([
  'EMPLOYE_VOIR_TOUT', 'EMPLOYE_VOIR_EQUIPE', 'ENTITE_VOIR',
  ...(MISSIONS_EXPENSES_ENABLED ? ['MISSION_VOIR_TOUT', 'MISSION_VOIR_EQUIPE', 'FRAIS_VOIR_TOUT', 'FRAIS_VOIR_EQUIPE'] : []),
]))
const canSeeConfigSection = computed(() => auth.hasAnyPermission([
  'CONFIG_CALENDRIER', 'CONFIG_JOURS_FERIES', 'CONFIG_TYPES_CONGE',
  'CONFIG_CATEGORIES_EMPLOYE', 'CONFIG_METIERS_POSTES',
  ...(MISSIONS_EXPENSES_ENABLED ? ['CONFIG_FRAIS_MISSION'] : []),
]))
const canSeeMyTeamSection = computed(() => auth.hasAnyPermission([
  'CONGE_VALIDER', 'MISSION_VALIDER', 'FRAIS_VALIDER', 'EMPLOYE_VOIR_EQUIPE',
]))

// ── Réduction de la sidebar — préférence persistée (survit à un rechargement) ──
const COLLAPSE_KEY = 'sidebar-collapsed'
const collapsed = ref(localStorage.getItem(COLLAPSE_KEY) === '1')
function toggleCollapsed() { collapsed.value = !collapsed.value }
watch(collapsed, (v) => localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0'))

// ── Classes du design system (tokens sidebar) ────────────────
const itemClass =
  'flex items-center gap-2 py-[7px] pr-4 pl-6 text-[13px] text-muted-foreground cursor-pointer transition-colors no-underline select-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
const itemActiveClass =
  'bg-sidebar-accent text-sidebar-accent-foreground font-medium border-r-2 border-sidebar-primary'
const badgeClass =
  'ml-auto bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-px rounded-full'

// ── Sub-components définis inline ────────────────────────────
// Réfèrent `collapsed` par fermeture (même portée que le setup() parent) —
// pas besoin de le repasser en prop sur chaque usage dans le template.
const SidebarSection = defineComponent({
  props: { label: String },
  setup(props, { slots }) {
    return () => {
      if (collapsed.value) return h('div', { class: 'mb-1' }, slots.default?.())
      return h('div', { class: 'mb-1' }, [
        h('div', { class: 'text-[10px] font-bold text-muted-foreground uppercase tracking-[0.07em] pt-2 pb-1 pr-4 pl-5' }, props.label),
        slots.default?.(),
      ])
    }
  },
})

const SidebarItem = defineComponent({
  props: {
    icon:        { type: [Object, Function] as PropType<Component>, required: true },
    label:       { type: String,  required: true },
    to:          { type: Object,  required: true },
    badge:       { type: Number,  default: 0 },
    badgeOrange: { type: Boolean, default: false },
  },
  setup(props) {
    return () => {
      const iconEl  = h(props.icon, { class: 'w-4 h-4 shrink-0', 'aria-hidden': 'true' })

      if (collapsed.value) {
        // Réduit à un simple point (pas de chiffre, pas de place pour ça) —
        // positionné en absolu, l'item redevient donc position: relative.
        const dotEl = props.badge > 0
          ? h('span', { class: 'absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-primary' })
          : null
        return h(RouterLink, {
          to: props.to, class: [itemClass, 'relative !justify-center !px-0'], activeClass: itemActiveClass, title: props.label,
        }, () => [iconEl, dotEl].filter(Boolean))
      }

      const badgeEl = props.badge > 0 ? h('span', { class: badgeClass }, String(props.badge)) : null

      const labelEl = h('span', { class: 'flex-1' }, props.label)
      const children = [iconEl, labelEl, badgeEl].filter(Boolean)

      return h(RouterLink, { to: props.to, class: itemClass, activeClass: itemActiveClass }, () => children)
    }
  },
})
</script>
