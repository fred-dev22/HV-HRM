<template>
  <div class="px-7 py-6">

        <div class="flex items-start justify-between mb-5 gap-3 flex-wrap">
          <div>
            <div class="text-xl font-bold text-foreground">Mon Profil</div>
            <div class="text-[13px] text-muted-foreground mt-0.5">{{ employee?.jobTitle }} · {{ employee?.entityName }}</div>
          </div>
          <div class="flex gap-2">
            <button v-if="isHR" :class="L.btnOutline">
              <FileDown class="w-4 h-4" /> Exporter
            </button>
            <button :class="L.btnPrimary" @click="saveInfo">
              <Save class="w-4 h-4" /> Enregistrer
            </button>
          </div>
        </div>

        <div class="grid grid-cols-[240px_1fr] gap-4 items-start max-lg:grid-cols-1">

          <!-- ── Colonne gauche ── -->
          <div class="flex flex-col gap-3.5">

            <!-- Avatar card -->
            <div :class="[card, 'flex flex-col items-center gap-2.5 text-center !py-6']">
              <div class="relative">
                <div class="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <span class="text-[28px] font-bold text-primary">{{ employee?.initials }}</span>
                </div>
                <button class="absolute bottom-0 right-0 w-[26px] h-[26px] rounded-full bg-primary text-white border-0 cursor-pointer flex items-center justify-center">
                  <Camera class="w-3 h-3" />
                </button>
              </div>
              <div class="text-[15px] font-semibold text-foreground">{{ employee?.name }}</div>
              <div class="text-xs text-muted-foreground">{{ employee?.code }}</div>
              <StatusPill :status="employee?.status ?? 'active'" />
            </div>

            <!-- Soldes mini -->
            <div :class="card">
              <div :class="cardTitle"><PieChart class="w-3.5 h-3.5 text-primary" /> Soldes congés</div>
              <div class="flex flex-col gap-2.5 mt-2.5">
                <div class="flex flex-col gap-1" v-for="b in myBalances" :key="b.label">
                  <div class="flex justify-between">
                    <span class="text-[11px] text-muted-foreground">{{ b.label }}</span>
                    <span class="text-xs font-semibold text-foreground">{{ b.remaining }}j</span>
                  </div>
                  <div class="h-1 bg-border rounded-sm overflow-hidden">
                    <div class="h-full rounded-sm transition-[width] duration-300" :style="{ width: b.pct + '%', background: b.color }"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Actions rapides -->
            <div :class="card">
              <div :class="cardTitle"><Zap class="w-3.5 h-3.5 text-primary" /> Actions rapides</div>
              <div class="flex flex-col gap-1.5 mt-2.5">
                <router-link :to="{ name: isHR ? 'hr-absences' : 'employee-absences' }" :class="quickBtn">
                  <CalendarPlus class="w-4 h-4" /> Demande de congé
                </router-link>
                <router-link v-if="MISSIONS_EXPENSES_ENABLED" :to="{ name: isHR ? 'hr-missions' : 'employee-missions' }" :class="quickBtn">
                  <Plane class="w-4 h-4" /> Ordre de mission
                </router-link>
                <router-link :to="{ name: 'employee-planning' }" :class="quickBtn">
                  <Calendar class="w-4 h-4" /> Mon planning
                </router-link>
              </div>
            </div>

          </div>

          <!-- ── Colonne droite ── -->
          <div class="flex flex-col gap-3.5">

            <!-- Infos personnelles (éditable) -->
            <div :class="card">
              <div class="mb-3.5">
                <div :class="cardTitle"><User class="w-3.5 h-3.5 text-primary" /> Informations personnelles</div>
              </div>
              <div :class="formGrid">
                <div :class="cls.field">
                  <label :class="fieldLabel">Prénom</label>
                  <input v-model="form.firstName" :class="cls.fieldInput" type="text" />
                </div>
                <div :class="cls.field">
                  <label :class="fieldLabel">Nom</label>
                  <input v-model="form.lastName" :class="cls.fieldInput" type="text" />
                </div>
                <div :class="cls.field">
                  <label :class="fieldLabel">Email</label>
                  <input v-model="form.email" :class="cls.fieldInput" type="email" />
                </div>
                <div :class="cls.field">
                  <label :class="fieldLabel">Téléphone</label>
                  <input v-model="form.phone" :class="cls.fieldInput" type="tel" />
                </div>
              </div>
            </div>

            <!-- Infos professionnelles (lecture seule pour employé) -->
            <div :class="card">
              <div class="mb-3.5">
                <div :class="cardTitle"><Briefcase class="w-3.5 h-3.5 text-primary" /> Informations professionnelles</div>
              </div>
              <div class="grid grid-cols-2 gap-3 mt-1 max-sm:grid-cols-1">
                <div class="flex flex-col gap-0.5">
                  <span :class="infoLabel">Matricule</span>
                  <span class="text-[13px] text-foreground">{{ employee?.code }}</span>
                </div>
                <div class="flex flex-col gap-0.5">
                  <span :class="infoLabel">Poste</span>
                  <span class="text-[13px] text-foreground">{{ employee?.jobTitle }}</span>
                </div>
                <div class="flex flex-col gap-0.5">
                  <span :class="infoLabel">Entité</span>
                  <span class="text-[13px] text-foreground">{{ employee?.entityName }}</span>
                </div>
                <div class="flex flex-col gap-0.5">
                  <span :class="infoLabel">Type de contrat</span>
                  <span class="text-[13px] text-foreground">{{ employee?.contractType }}</span>
                </div>
                <div class="flex flex-col gap-0.5">
                  <span :class="infoLabel">Date d'embauche</span>
                  <span class="text-[13px] text-foreground">{{ formatDate(employee?.hireDate) }}</span>
                </div>
                <div class="flex flex-col gap-0.5">
                  <span :class="infoLabel">Catégorie</span>
                  <span class="text-[13px] text-foreground">{{ categoryName }}</span>
                </div>
              </div>
            </div>

            <!-- Préférences -->
            <div :class="card">
              <div class="mb-3.5">
                <div :class="cardTitle"><Settings class="w-3.5 h-3.5 text-primary" /> Préférences</div>
              </div>
              <div :class="formGrid">
                <div :class="cls.field">
                  <label :class="fieldLabel">Langue</label>
                  <select v-model="form.lang" :class="cls.fieldSelect">
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div :class="cls.field">
                  <label :class="fieldLabel">Notifications email</label>
                  <select v-model="form.emailNotifs" :class="cls.fieldSelect">
                    <option value="all">Toutes</option>
                    <option value="important">Importantes uniquement</option>
                    <option value="none">Désactivées</option>
                  </select>
                </div>
              </div>
            </div>

          </div>
        </div>

  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { FileDown, Save, Camera, PieChart, Zap, CalendarPlus, Plane, Calendar, User, Briefcase, Settings } from 'lucide-vue-next'
import { StatusPill } from '../../components'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { useAuthStore }    from '../../stores/auth'
import { useEmployeeStore } from '../../stores/employees'
import { useEmployeeCategoryStore } from '../../stores/employeeCategories'
import { useLeaveTransactionStore } from '../../stores/leaveTransactions'
import { useRoute } from 'vue-router'
import { MISSIONS_EXPENSES_ENABLED } from '../../config/features'

const auth         = useAuthStore()
const employeeStore = useEmployeeStore()
const categoryStore = useEmployeeCategoryStore()
const balanceStore  = useLeaveTransactionStore()
const route         = useRoute()

// Toujours rafraîchi (pas de garde "si vide") : le solde peut changer suite
// à une approbation décidée par un tiers, voir DashboardEmployee.vue.
balanceStore.fetchMyBalances()
if (categoryStore.categories.length === 0) categoryStore.fetchAll()

// ── Classes du design system ─────────────────────────────────
const card = 'bg-card border border-border rounded-[10px] p-4'
const cardTitle = 'text-[13px] font-semibold text-foreground flex items-center gap-1.5'
const quickBtn = 'flex items-center gap-2 px-3 py-2 rounded-md text-[13px] text-foreground no-underline bg-background border border-border transition-colors hover:bg-primary/10 hover:text-primary'
const formGrid = 'grid grid-cols-2 gap-3 max-sm:grid-cols-1'
const fieldLabel = 'text-xs font-medium text-muted-foreground'
const infoLabel = 'text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.04em]'

const isHR = computed(() => route.path.startsWith('/hr'))

const employee = computed(() => {
  return auth.user?.id ? employeeStore.getById(auth.user.id) : undefined
})

if (auth.user?.id && !employee.value) employeeStore.fetchOne(auth.user.id)

const form = reactive({
  firstName:    employee.value?.firstName ?? '',
  lastName:     employee.value?.lastName  ?? '',
  email:        employee.value?.email     ?? '',
  phone:        employee.value?.phone     ?? '',
  lang:         'fr',
  emailNotifs:  'all',
})

// Le fetch ci-dessus est async — resynchronise le formulaire une fois la
// fiche employé chargée (form est un reactive() figé à l'initialisation).
watch(employee, (e) => {
  if (!e) return
  form.firstName = e.firstName
  form.lastName  = e.lastName
  form.email     = e.email ?? ''
  form.phone     = e.phone ?? ''
})

const categoryName = computed(() => {
  const id = employee.value?.employeeCategoryId
  if (!id) return '—'
  return categoryStore.categories.find(c => c.id === id)?.name ?? '—'
})

const myBalances = computed(() => {
  return balanceStore.myBalances
    .filter(b => b.daysPerYear > 0)
    .slice(0, 4)
    .map(b => {
      const pct   = b.daysPerYear > 0 ? (b.balance / b.daysPerYear) * 100 : 0
      const color = pct > 50 ? 'var(--color-success)' : pct > 20 ? 'var(--color-warning)' : 'var(--color-danger)'
      return { label: b.leaveTypeName, remaining: b.balance, pct, color }
    })
})

function saveInfo() {
  // In a real app, dispatch to store; here just UI feedback
}
</script>
