import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore }       from '../stores/auth'
import { useCompanySettingsStore } from '../stores/companySettings'
import { useNavigationStore } from '../stores/navigation'
import LoginView          from '../views/LoginView.vue'
import ForgotPasswordView from '../views/ForgotPasswordView.vue'
import ResetPasswordView  from '../views/ResetPasswordView.vue'
import PublicApprovalView from '../views/PublicApprovalView.vue'
import DashboardHR       from '../views/DashboardHR.vue'
import DashboardEmployee from '../views/DashboardEmployee.vue'
import CalendarView      from '../views/calendar/CalendarView.vue'
import { MISSIONS_EXPENSES_ENABLED, PLACEHOLDER_MODULES_ENABLED, RECRUITMENT_MODULE_ENABLED } from '../config/features'

const PH = () => import('../views/placeholders/PlaceholderView.vue')

// Routes des modules Mission / Note de frais — bloquées tant que
// MISSIONS_EXPENSES_ENABLED est à false (voir src/config/features.ts), même
// pour un accès direct par URL, en plus du masquage dans AppSidebar.vue.
const MISSIONS_EXPENSES_ROUTES = new Set([
  'hr-missions', 'hr-expenses', 'hr-config-mission-fees',
  'employee-missions', 'employee-expenses',
])

// Préfixes des modules encore à l'état de placeholder (Formation, Paie,
// Rapports — voir PLACEHOLDER_MODULES_ENABLED). Recrutement a son propre
// flag (RECRUITMENT_MODULE_ENABLED, voir plus bas) car il a de vrais écrans
// sur la branche dev-recrutement-module. Bloque aussi toutes les sous-routes
// (ex. /hr/training/catalog) même par accès direct à l'URL, en plus du
// masquage dans AppNavBar.vue.
const PLACEHOLDER_MODULE_PATH_PREFIXES = ['/hr/training', '/hr/payroll', '/hr/reports']
const RECRUITMENT_MODULE_PATH_PREFIX = '/hr/recruitment'

// Onglet actif (AppNavBar.vue) et sidebar (AppSidebar.vue) suivent tous les
// deux navigationStore.activeModule, qui n'etait mis a jour qu'au clic sur un
// onglet (handleHRNav) — un rechargement de page ou un lien direct vers
// /hr/recruitment/... laissait donc l'onglet et la sidebar bloques sur le
// dernier module clique (souvent "administration" par defaut). Deduit ici de
// l'URL a chaque navigation pour rester juste quelle que soit la façon dont
// on arrive sur la page.
function moduleForPath(path: string): string {
  if (path.startsWith(RECRUITMENT_MODULE_PATH_PREFIX)) return 'recruitment'
  if (path.startsWith('/hr/training')) return 'training'
  if (path.startsWith('/hr/payroll')) return 'payroll'
  if (path.startsWith('/hr/reports')) return 'reports'
  return 'administration'
}

// Route (par nom) -> permission(s) requise(s) en plus de l'espace hr/employee
// (voir auth.isHRSpace/isEmployeeSpace). Un tableau = n'importe laquelle des
// permissions suffit. Seules les routes couvertes par une vraie permission du
// catalogue (voir backend prisma/seed.ts) apparaissent ici — les modules
// encore en placeholder (recrutement, formation, paie...) n'ont pas de code
// dédié et restent ouverts à tout l'espace RH, comme aujourd'hui.
const ROUTE_PERMISSIONS: Record<string, string | string[]> = {
  'hr-employees':        ['EMPLOYE_VOIR_TOUT', 'EMPLOYE_VOIR_EQUIPE'],
  'hr-employee-create':  'EMPLOYE_CREER',
  'hr-employee-edit':    'EMPLOYE_MODIFIER',
  'hr-entities':         'ENTITE_VOIR',
  'hr-entity-create':    'ENTITE_CREER',
  'hr-entity-edit':      'ENTITE_MODIFIER',
  'hr-entity-detail':    'ENTITE_VOIR',
  'hr-org-chart':        'ENTITE_VOIR',
  'hr-config-calendar':      'CONFIG_CALENDRIER',
  'hr-config-mission-fees':  'CONFIG_FRAIS_MISSION',
  'hr-config-classification': ['CONFIG_METIERS_POSTES', 'CONFIG_CATEGORIES_EMPLOYE'],
  'hr-statistics':       'RAPPORT_VOIR',
  'hr-absences':         ['CONGE_VOIR_TOUT', 'CONGE_VOIR_EQUIPE'],
  'hr-leave-balances':   ['CONGE_VOIR_TOUT', 'CONGE_VOIR_EQUIPE'],
  'hr-missions':         ['MISSION_VOIR_TOUT', 'MISSION_VOIR_EQUIPE'],
  'hr-expenses':         ['FRAIS_VOIR_TOUT', 'FRAIS_VOIR_EQUIPE'],
  'employee-to-validate': ['CONGE_VALIDER', 'MISSION_VALIDER', 'FRAIS_VALIDER'],
  'employee-team':        'EMPLOYE_VOIR_EQUIPE',
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'login', component: LoginView },
    { path: '/forgot-password', name: 'forgot-password', component: ForgotPasswordView },
    { path: '/reset-password', name: 'reset-password', component: ResetPasswordView },
    // Validation par email (clic direct depuis la boite mail, sans connexion)
    // — voir PublicApprovalView.vue / backend PublicApprovalModule. Route en
    // anglais comme demande (toutes les routes frontend doivent l'etre a
    // terme, voir Lot K).
    { path: '/approval/:token', name: 'public-approval', component: PublicApprovalView },

    // Portail carriere public (module Recrutement) — accessible sans compte,
    // depuis un lien partage d'une offre publiee (voir JobOfferCard.vue).
    // Masque tant que RECRUITMENT_MODULE_ENABLED est a false (garde plus
    // bas, avant meme la verification requiresAuth puisque ces routes n'en
    // ont pas).
    { path: '/careers',             name: 'public-careers',             component: () => import('../views/recruitment/PublicCareersView.vue') },
    { path: '/careers/spontaneous', name: 'public-careers-spontaneous', component: () => import('../views/recruitment/PublicSpontaneousApplicationView.vue') },
    { path: '/careers/:id',         name: 'public-careers-offer',       component: () => import('../views/recruitment/PublicJobApplicationView.vue') },

    // ── Dashboards ──────────────────────────────────────────────
    { path: '/hr',       name: 'hr-dashboard',       component: DashboardHR,       meta: { requiresAuth: true, layout: 'dashboard' } },
    { path: '/employee', name: 'employee-dashboard', component: DashboardEmployee, meta: { requiresAuth: true, layout: 'dashboard' } },

    // ── Onboarding ───────────────────────────────────────────────
    // Pas de requiresAuth — vérification manuelle dans le composant pour éviter les boucles
    {
      path: '/onboarding', name: 'onboarding',
      component: () => import('../views/OnboardingWizard.vue'),
    },

    // ── Changement de mot de passe obligatoire ─────────────────────
    // Même forme que /onboarding — pas de requiresAuth (la garde ci-dessous
    // gère la redirection), pas de layout dashboard (plein écran, propre header).
    {
      path: '/change-password', name: 'change-password',
      component: () => import('../views/ChangePasswordView.vue'),
    },

    // ── HR Absences ─────────────────────────────────────────────
    {
      path: '/hr/absences', name: 'hr-absences',
      component: () => import('../views/absences/AbsenceListView.vue'),
      meta: { requiresAuth: true, layout: 'dashboard' },
    },
    {
      path: '/hr/absences/balances', name: 'hr-leave-balances',
      component: () => import('../views/absences/LeaveBalancesView.vue'),
      meta: { requiresAuth: true, layout: 'dashboard' },
    },

    // ── HR Administration ────────────────────────────────────────
    {
      path: '/hr/employees', name: 'hr-employees',
      component: () => import('../views/employees/EmployeeListView.vue'),
      meta: { requiresAuth: true, layout: 'dashboard' },
    },
    {
      path: '/hr/employees/new', name: 'hr-employee-create',
      component: () => import('../views/employees/EmployeeFormView.vue'),
      meta: { requiresAuth: true, layout: 'dashboard' },
    },
    {
      path: '/hr/employees/:id/edit', name: 'hr-employee-edit',
      component: () => import('../views/employees/EmployeeFormView.vue'),
      meta: { requiresAuth: true, layout: 'dashboard' },
    },
    { path: '/hr/missions',           name: 'hr-missions',   component: () => import('../views/missions/MissionListView.vue'),  meta: { requiresAuth: true, layout: 'dashboard' } },
    { path: '/hr/expenses',           name: 'hr-expenses',   component: () => import('../views/expenses/ExpenseListView.vue'),   meta: { requiresAuth: true, layout: 'dashboard' } },
    { path: '/hr/contracts',          name: 'hr-contracts',  component: PH, meta: { requiresAuth: true, title: 'Gestion des Contrats' } },
    { path: '/hr/reports/statistics', name: 'hr-statistics', component: () => import('../views/reports/StatisticsView.vue'),     meta: { requiresAuth: true, layout: 'dashboard' } },
    {
      path: '/hr/org-chart', name: 'hr-org-chart',
      component: () => import('../views/rh/OrgChartView.vue'),
      meta: { requiresAuth: true, layout: 'dashboard' },
    },
    { path: '/hr/planning', name: 'hr-planning',
      component: () => import('../views/employee/EmployeePlanningView.vue'),
      meta: { requiresAuth: true, layout: 'dashboard' },
    },

    // ── Configuration ─────────────────────────────────────────────
    { path: '/hr/config', redirect: '/hr/config/calendar' },
    {
      path: '/hr/config/calendar', name: 'hr-config-calendar',
      component: CalendarView,
      meta: { requiresAuth: true, layout: 'dashboard' },
    },
    { path: '/hr/config/leave-types', name: 'hr-config-leave-types', redirect: '/hr/config/calendar' },
    {
      path: '/hr/config/classification', name: 'hr-config-classification',
      component: () => import('../views/configuration/ClassificationConfigView.vue'),
      meta: { requiresAuth: true, layout: 'dashboard' },
    },
    {
      path: '/hr/config/mission-fees', name: 'hr-config-mission-fees',
      component: () => import('../views/configuration/MissionConfigView.vue'),
      meta: { requiresAuth: true, layout: 'dashboard' },
    },
    // Redirects de compatibilité — les 3 écrans séparés ont fusionné dans
    // Classification (voir decision du 29/07).
    { path: '/hr/config/jobs', redirect: '/hr/config/classification' },
    { path: '/hr/config/positions', redirect: '/hr/config/classification' },
    { path: '/hr/config/employee-categories', redirect: '/hr/config/classification' },

    // Redirects de compatibilité (anciennes URLs)
    { path: '/hr/calendar', redirect: '/hr/config/calendar' },
    { path: '/rh', redirect: '/hr' },
    { path: '/rh/:pathMatch(.*)*', redirect: (to) => ({ path: '/hr/' + (to.params.pathMatch as string[]).join('/') }) },
    { path: '/employe', redirect: '/employee' },
    { path: '/employe/:pathMatch(.*)*', redirect: (to) => ({ path: '/employee/' + (to.params.pathMatch as string[]).join('/') }) },

    // ── Entités ──────────────────────────────────────────────────
    {
      path: '/hr/entities', name: 'hr-entities',
      component: () => import('../views/entities/EntityListView.vue'),
      meta: { requiresAuth: true, layout: 'dashboard' },
    },
    {
      path: '/hr/entities/new', name: 'hr-entity-create',
      component: () => import('../views/entities/EntityFormView.vue'),
      meta: { requiresAuth: true, layout: 'dashboard' },
    },
    {
      path: '/hr/entities/:id/edit', name: 'hr-entity-edit',
      component: () => import('../views/entities/EntityFormView.vue'),
      meta: { requiresAuth: true, layout: 'dashboard' },
    },
    {
      path: '/hr/entities/:id', name: 'hr-entity-detail',
      component: () => import('../views/entities/EntityDetailView.vue'),
      meta: { requiresAuth: true, layout: 'dashboard' },
    },

    // ── Module Recrutement ───────────────────────────────────────
    // Ecrans reels (design uniquement, donnees fictives — voir
    // src/stores/recruitment/), masques tant que PLACEHOLDER_MODULES_ENABLED
    // est a false (voir plus bas et src/config/features.ts).
    { path: '/hr/recruitment',              name: 'hr-recruitment',              component: () => import('../views/recruitment/RecruitmentDashboardView.vue'),   meta: { requiresAuth: true, layout: 'dashboard' } },
    { path: '/hr/recruitment/positions',    name: 'hr-recruitment-positions',    component: () => import('../views/recruitment/JobOffersView.vue'),              meta: { requiresAuth: true, layout: 'dashboard' } },
    { path: '/hr/recruitment/applications', name: 'hr-recruitment-applications', component: () => import('../views/recruitment/ApplicationsView.vue'),           meta: { requiresAuth: true, layout: 'dashboard' } },
    { path: '/hr/recruitment/interviews',   name: 'hr-recruitment-interviews',   component: () => import('../views/recruitment/InterviewsView.vue'),             meta: { requiresAuth: true, layout: 'dashboard' } },
    { path: '/hr/recruitment/pipeline',     name: 'hr-recruitment-pipeline',     component: () => import('../views/recruitment/PipelineView.vue'),               meta: { requiresAuth: true, layout: 'dashboard' } },
    { path: '/hr/recruitment/cv-library',   name: 'hr-recruitment-cv-library',   component: () => import('../views/recruitment/TalentPoolView.vue'),             meta: { requiresAuth: true, layout: 'dashboard' } },
    { path: '/hr/recruitment/spontaneous',  name: 'hr-recruitment-spontaneous',  component: () => import('../views/recruitment/SpontaneousApplicationsView.vue'), meta: { requiresAuth: true, layout: 'dashboard' } },
    { path: '/hr/recruitment/needs',        name: 'hr-recruitment-needs',        component: () => import('../views/recruitment/HiringRequestsView.vue'),         meta: { requiresAuth: true, layout: 'dashboard' } },
    { path: '/hr/recruitment/contracts',    name: 'hr-recruitment-contracts',    component: () => import('../views/recruitment/ContractsView.vue'),              meta: { requiresAuth: true, layout: 'dashboard' } },
    { path: '/hr/recruitment/trial',        name: 'hr-recruitment-trial',        component: () => import('../views/recruitment/TrialPeriodsView.vue'),           meta: { requiresAuth: true, layout: 'dashboard' } },

    // ── Module Formation ─────────────────────────────────────────
    { path: '/hr/training',             name: 'hr-training',             component: PH, meta: { requiresAuth: true, title: 'Tableau de bord Formation' } },
    { path: '/hr/training/catalog',     name: 'hr-training-catalog',     component: PH, meta: { requiresAuth: true, title: 'Catalogue formations' } },
    { path: '/hr/training/sessions',    name: 'hr-training-sessions',    component: PH, meta: { requiresAuth: true, title: 'Sessions planifiées' } },
    { path: '/hr/training/enrollments', name: 'hr-training-enrollments', component: PH, meta: { requiresAuth: true, title: 'Inscriptions' } },
    { path: '/hr/training/hot-evals',   name: 'hr-training-hot-evals',   component: PH, meta: { requiresAuth: true, title: 'Évaluations à chaud' } },
    { path: '/hr/training/cold-evals',  name: 'hr-training-cold-evals',  component: PH, meta: { requiresAuth: true, title: 'Évaluations à froid' } },
    { path: '/hr/training/grades',      name: 'hr-training-grades',      component: PH, meta: { requiresAuth: true, title: 'Notes participants' } },
    { path: '/hr/training/budget',      name: 'hr-training-budget',      component: PH, meta: { requiresAuth: true, title: 'Suivi budgétaire' } },
    { path: '/hr/training/providers',   name: 'hr-training-providers',   component: PH, meta: { requiresAuth: true, title: 'Prestataires' } },

    // ── Module Paie ──────────────────────────────────────────────
    { path: '/hr/payroll',              name: 'hr-payroll',              component: PH, meta: { requiresAuth: true, title: 'Tableau de bord Paie' } },
    { path: '/hr/payroll/periods',      name: 'hr-payroll-periods',      component: PH, meta: { requiresAuth: true, title: 'Périodes de paie' } },
    { path: '/hr/payroll/payslips',     name: 'hr-payroll-payslips',     component: PH, meta: { requiresAuth: true, title: 'Bulletins de paie' } },
    { path: '/hr/payroll/register',     name: 'hr-payroll-register',     component: PH, meta: { requiresAuth: true, title: 'Registre du personnel' } },
    { path: '/hr/payroll/attendance',   name: 'hr-payroll-attendance',   component: PH, meta: { requiresAuth: true, title: 'Suivi des présences' } },
    { path: '/hr/payroll/import',       name: 'hr-payroll-import',       component: PH, meta: { requiresAuth: true, title: 'Import CSV présences' } },
    { path: '/hr/payroll/overtime',     name: 'hr-payroll-overtime',     component: PH, meta: { requiresAuth: true, title: 'Heures supplémentaires' } },
    { path: '/hr/payroll/cnaps',        name: 'hr-payroll-cnaps',        component: PH, meta: { requiresAuth: true, title: 'État CNaPS' } },
    { path: '/hr/payroll/ostie',        name: 'hr-payroll-ostie',        component: PH, meta: { requiresAuth: true, title: 'État OSTIE' } },
    { path: '/hr/payroll/fmfp',         name: 'hr-payroll-fmfp',         component: PH, meta: { requiresAuth: true, title: 'État FMFP' } },
    { path: '/hr/payroll/irsa',         name: 'hr-payroll-irsa',         component: PH, meta: { requiresAuth: true, title: 'État IRSA' } },
    { path: '/hr/payroll/salary-grids', name: 'hr-payroll-salary-grids', component: PH, meta: { requiresAuth: true, title: 'Grilles salariales' } },
    { path: '/hr/payroll/raises',       name: 'hr-payroll-raises',       component: PH, meta: { requiresAuth: true, title: 'Augmentations' } },
    { path: '/hr/payroll/thirteenth',   name: 'hr-payroll-thirteenth',   component: PH, meta: { requiresAuth: true, title: '13e mois' } },

    // ── Module Rapports ──────────────────────────────────────────
    { path: '/hr/reports',              name: 'hr-reports',              component: PH, meta: { requiresAuth: true, title: 'Tableau de bord Rapports' } },
    { path: '/hr/reports/headcount',    name: 'hr-reports-headcount',    component: PH, meta: { requiresAuth: true, title: 'Liste du personnel' } },
    { path: '/hr/reports/movements',    name: 'hr-reports-movements',    component: PH, meta: { requiresAuth: true, title: 'Mouvements du personnel' } },
    { path: '/hr/reports/pyramid',      name: 'hr-reports-pyramid',      component: PH, meta: { requiresAuth: true, title: 'Pyramide des âges' } },
    { path: '/hr/reports/absenteeism',  name: 'hr-reports-absenteeism',  component: PH, meta: { requiresAuth: true, title: "Taux d'absentéisme" } },
    { path: '/hr/reports/turnover',     name: 'hr-reports-turnover',     component: PH, meta: { requiresAuth: true, title: 'Turnover & ancienneté' } },
    { path: '/hr/reports/export-excel', name: 'hr-reports-export-excel', component: PH, meta: { requiresAuth: true, title: 'Export Excel' } },
    { path: '/hr/reports/export-csv',   name: 'hr-reports-export-csv',   component: PH, meta: { requiresAuth: true, title: 'Export CSV' } },
    { path: '/hr/reports/navision',     name: 'hr-reports-navision',     component: PH, meta: { requiresAuth: true, title: 'Intégration Navision' } },

    // ── Espace Employé ───────────────────────────────────────────
    {
      path: '/employee/absences', name: 'employee-absences',
      component: () => import('../views/absences/AbsenceRequestView.vue'),
      meta: { requiresAuth: true, layout: 'dashboard' },
    },
    { path: '/employee/profile', name: 'employee-profile', component: () => import('../views/employee/UserProfileView.vue'), meta: { requiresAuth: true, layout: 'dashboard' } },
    { path: '/hr/profile',       name: 'hr-profile',       component: () => import('../views/employee/UserProfileView.vue'), meta: { requiresAuth: true, layout: 'dashboard' } },
    {
      path: '/employee/planning', name: 'employee-planning',
      component: () => import('../views/employee/EmployeePlanningView.vue'),
      meta: { requiresAuth: true, layout: 'dashboard' },
    },
    { path: '/employee/missions', name: 'employee-missions', component: () => import('../views/missions/MissionListView.vue'),  meta: { requiresAuth: true, layout: 'dashboard' } },
    { path: '/employee/expenses', name: 'employee-expenses', component: () => import('../views/expenses/ExpenseListView.vue'),   meta: { requiresAuth: true, layout: 'dashboard' } },
    {
      path: '/employee/to-validate', name: 'employee-to-validate',
      component: () => import('../views/employee/ToValidateView.vue'),
      meta: { requiresAuth: true, layout: 'dashboard' },
    },
    {
      path: '/employee/team', name: 'employee-team',
      component: () => import('../views/employee/TeamView.vue'),
      meta: { requiresAuth: true, layout: 'dashboard' },
    },
    // Cote employe du module Recrutement (mock) : visibilite d'une
    // candidature interne le concernant, voir MyInternalApplicationsView.vue
    // — sans ca, un employe propose comme candidat interne (JobOfferCard.vue)
    // n'en avait jamais connaissance dans l'appli.
    {
      path: '/employee/internal-applications', name: 'employee-internal-applications',
      component: () => import('../views/recruitment/MyInternalApplicationsView.vue'),
      meta: { requiresAuth: true, layout: 'dashboard' },
    },

    // Catch-all → login
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// ── Guard de navigation ──────────────────────────────────────
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const companySettings = useCompanySettingsStore()

  // Portail carriere public : ni requiresAuth ni espace hr/employee, donc
  // aucune des verifications ci-dessous (y compris RECRUITMENT_MODULE_ENABLED
  // plus bas) ne s'appliquerait a un visiteur non connecte — verifie ici,
  // avant tout le reste.
  const PUBLIC_CAREERS_ROUTE_NAMES = new Set(['public-careers', 'public-careers-offer', 'public-careers-spontaneous'])
  if (to.name && PUBLIC_CAREERS_ROUTE_NAMES.has(to.name as string) && !RECRUITMENT_MODULE_ENABLED) {
    return { path: '/' }
  }

  // Non connecté → login — vide aussi les autres stores au passage : sans
  // ça, une session invalidée autrement qu'via logout() (ex: restoreSession
  // qui échoue) pouvait laisser les données de l'utilisateur précédent en
  // mémoire jusqu'à la prochaine connexion.
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    auth.resetOtherStores()
    return { path: '/' }
  }

  // Déjà connecté → pas besoin du login
  if (to.name === 'login' && auth.isLoggedIn) {
    return auth.isHRSpace ? { path: '/hr' } : { path: '/employee' }
  }

  if (auth.isLoggedIn) {
    // Mot de passe temporaire (compte tout juste créé) → priorité sur tout
    // le reste, y compris l'onboarding — c'est une porte de sécurité, pas
    // une étape de configuration.
    if (auth.mustChangePassword && to.path !== '/change-password') {
      return { path: '/change-password' }
    }
    if (!auth.mustChangePassword && to.path === '/change-password') {
      return auth.isHRSpace ? { path: '/hr' } : { path: '/employee' }
    }

    if (to.path.startsWith('/hr') && auth.isEmployeeSpace) {
      return { path: '/employee' }
    }
    if (to.path.startsWith('/employee') && auth.isHRSpace) {
      return { path: '/hr' }
    }

    // Voir commentaire sur moduleForPath : synchronise l'onglet actif et la
    // sidebar sur l'URL réellement visitée, peu importe comment on y arrive.
    if (to.path.startsWith('/hr')) {
      useNavigationStore().setModule(moduleForPath(to.path))
    }

    // RH connecté + entreprise jamais onboardée (CompanySettings.IsOnboarded,
    // persisté côté serveur — pas un flag client volatile) → forcer le wizard.
    // isOnboarded === null signifie "pas encore vérifié" : un seul fetch par
    // session, mis en cache dans le store ensuite.
    if (auth.isHRSpace && to.path !== '/onboarding' && to.path !== '/change-password') {
      if (companySettings.isOnboarded === null) {
        await companySettings.fetchSettings().catch(() => {})
      }
      if (!companySettings.isOnboarded) {
        return { path: '/onboarding' }
      }
    }

    if (!MISSIONS_EXPENSES_ENABLED && to.name && MISSIONS_EXPENSES_ROUTES.has(to.name as string)) {
      return { path: auth.isHRSpace ? '/hr' : '/employee' }
    }

    if (!PLACEHOLDER_MODULES_ENABLED && PLACEHOLDER_MODULE_PATH_PREFIXES.some((p) => to.path.startsWith(p))) {
      return { path: auth.isHRSpace ? '/hr' : '/employee' }
    }

    if (!RECRUITMENT_MODULE_ENABLED && (to.path.startsWith(RECRUITMENT_MODULE_PATH_PREFIX) || to.name === 'employee-internal-applications')) {
      return { path: auth.isHRSpace ? '/hr' : '/employee' }
    }

    // Route couverte par une permission précise (voir ROUTE_PERMISSIONS) —
    // relue depuis auth.permissions à chaque navigation, jamais mise en cache.
    const required = to.name ? ROUTE_PERMISSIONS[to.name as string] : undefined
    if (required) {
      const allowed = Array.isArray(required)
        ? auth.hasAnyPermission(required)
        : auth.hasPermission(required)
      if (!allowed) {
        return { path: auth.isHRSpace ? '/hr' : '/employee' }
      }
    }
  }
})

export default router
