export type UserRole =
  | 'employee'      // employé simple — espace perso uniquement
  | 'validator'     // manager/validateur N+x — espace perso + à valider
  | 'hr_admin'      // HR Administrator — accès admin complet
  | 'hr_director'   // HR Director — accès admin + approbations direction

export interface AuthUser {
  id:              string
  name:            string
  initials:        string
  role:            UserRole
  email:           string
  entityId?:       string
  entityName?:     string
  validatorLevel?: 1 | 2 | 3 | 4
  // Ciblage d'eligibilite (demande client, 01/09) — necessaires pour filtrer
  // les types de conge/jours feries sur le calendrier personnel de
  // l'utilisateur connecte (voir lib/eligibility.ts, DashboardEmployee.vue).
  gender?:         'M' | 'F'
  isExpatriate?:   boolean
}

// Statut de LeaveRequest — reprend tel quel l'enum backend (voir
// productive247-hrm-backend schema.prisma LeaveRequest.Status), meme
// convention que EntityStatus (pas de mapping vers des cles minuscules).
// InApprovalN1..N4 : etape courante dans le pool de validation (WorkflowType
// Standard). Registered/Done/Regularized : reserves a WorkflowType Medical
// (declaration directe, sans pool — voir LeaveTypeConfig.workflowType).
export type LeaveRequestStatus =
  | 'Draft' | 'Pending'
  | 'InApprovalN1' | 'InApprovalN2' | 'InApprovalN3' | 'InApprovalN4'
  | 'Approved' | 'Rejected' | 'Returned' | 'Cancelled'
  | 'Registered' | 'Done' | 'Regularized'

export interface ValidationStep {
  level:     'employee' | 'n1' | 'n2' | 'n3' | 'n4' | 'rh' | 'system'
  actorName:     string
  actorInitials: string
  action:    'submitted' | 'approved' | 'rejected' | 'returned' | 'pending'
  date:      string       // ISO datetime or ''
  comment?:  string
}

export interface LeaveRequest {
  id:                   string
  referenceCode:        string
  employeeId:           string
  employeeName:         string
  employeeInitials:     string
  // Créateur de la demande, quand il diffère du bénéficiaire (employeeId) —
  // n'importe qui peut soumettre pour n'importe qui (decision du 01/08), le
  // créateur doit rester identifiable sur la demande.
  createdById?:         string
  createdByName?:       string
  leaveTypeId:          string
  leaveTypeName:        string
  leaveTypeColor:       string
  workflowType:         'Standard' | 'Medical'
  startDate:            string
  startPeriod:          'full' | 'am' | 'pm'
  endDate:              string
  endPeriod:            'full' | 'am' | 'pm'
  daysCount:            number
  reason?:              string
  interimEmployeeId?:   string
  interimEmployeeName?: string
  status:               LeaveRequestStatus
  approvalPoolId?:      string
  currentApprovalStep?: number
  rejectionReason?:     string
  createdAt:            string
  modifiedAt?:          string | null
  validationHistory?:   ValidationStep[]
  // Solde insuffisant au moment de l'affichage — non bloquant (decision du
  // 04/08, même traitement que le préavis), juste un avertissement pour le
  // validateur.
  insufficientBalance?: boolean
}

export interface LeaveBalance {
  leaveTypeId:   string
  leaveTypeName: string
  leaveTypeCode: string
  color:         string
  daysPerYear:   number
  balance:       number
}

// Statut de MissionOrder — reprend tel quel l'enum backend (voir
// productive247-hrm-backend mission-order.service.ts), meme convention que
// LeaveRequestStatus (workflow N+1..N+4 partagé via ApprovalPool).
export type MissionStatus =
  | 'Draft' | 'Pending'
  | 'InApprovalN1' | 'InApprovalN2' | 'InApprovalN3' | 'InApprovalN4'
  | 'Approved' | 'Rejected' | 'Returned' | 'Cancelled'

export type TransportMode =
  | 'PersonalCar' | 'CompanyCar' | 'PublicTransport' | 'Plane' | 'Other'

// MissionCategory (National/International) determine, croisee avec la
// EmployeeCategory reelle de l'employe (voir stores/employeeCategories.ts),
// quelle ligne de la matrice ExpenseConfig s'applique — voir missionConfig.ts.
export type MissionCategory = 'National' | 'International'

// Une ligne d'indemnite calculee cote backend a partir de la matrice
// ExpenseConfig (EmployeeCategory x ExpenseType x MissionCategory) — voir
// mission-order.service.ts computeAllowanceEstimate(). Aucun montant n'est
// stocke sur MissionOrder, tout est recalcule a la volee.
export interface MissionAllowanceLine {
  expenseTypeId:     string
  expenseTypeName:   string
  unit:              'PerDay' | 'PerTrip' | 'PerItem'
  rate:              number
  days:              number
  amount:            number
  currency:          string
  documentRequired:  boolean
}

// Ligne de frais complementaire saisie a la creation pour justifier
// l'acompte demande (AdvanceRequested = per diem + somme de ces lignes) —
// meme catalogue ExpenseType que les notes de frais (plan de test #18).
export interface MissionExpenseLine {
  id:              string
  expenseTypeId:   string
  expenseTypeName: string
  description?:    string
  amount:          number
}

// Mission associee (plan de test #22, ex: le chauffeur d'un directeur) —
// resume minimal de l'autre ordre de mission liee (voir MissionOrder.
// linkedMissionOrder), pour un lien de navigation depuis la fiche.
export interface LinkedMissionSummary {
  id:            string
  referenceCode: string
  destination:   string
  status:        MissionStatus
  employeeName:  string
}

export interface MissionOrder {
  id:                   string
  referenceCode:        string
  employeeId:           string
  employeeName:         string
  employeeInitials:     string
  createdById?:         string
  createdByName?:       string
  employeeCategoryId?:  string
  destination:          string
  missionCategory:      MissionCategory
  purpose:              string
  departureDate:        string
  returnDate:           string
  daysCount:            number
  transportModeGo:      TransportMode
  transportModeReturn:  TransportMode
  advanceRequested:     number
  currency:             string
  status:               MissionStatus
  approvalPoolId?:      string
  currentApprovalStep?: number
  rejectionReason?:     string
  // Present sur les listes (mine/team/all/pendingForMe) — total estime via
  // attachEstimatedTotals(), pas de detail par ligne.
  estimatedTotal?:      number
  // Present uniquement sur le detail (GET /mission-orders/:id).
  allowance?:           { lines: MissionAllowanceLine[]; total: number }
  expenseLines:         MissionExpenseLine[]
  linkedMission?:       LinkedMissionSummary
  createdAt:            string
  modifiedAt?:          string | null
  validationHistory?:   ValidationStep[]
}

// Statut d'ExpenseReport — reprend tel quel l'enum backend (voir
// expense-report.service.ts), meme convention que LeaveRequestStatus/
// MissionStatus (workflow N+1..N+4 partage via ApprovalPool).
export type ExpenseStatus =
  | 'Draft' | 'Pending'
  | 'InApprovalN1' | 'InApprovalN2' | 'InApprovalN3' | 'InApprovalN4'
  | 'Approved' | 'Rejected' | 'Returned' | 'Cancelled' | 'Reimbursed'

// La categorie d'une ligne est un ExpenseType reel (voir
// stores/missionConfig.ts) — le meme catalogue que celui utilise pour le per
// diem des missions, pas une enumeration figee separee.
export interface ExpenseLine {
  id:              string
  date:            string
  expenseTypeId:   string
  expenseTypeName: string
  description?:    string
  amount:          number
  currency:        string
  hasDocument:     boolean
}

export interface ExpenseReport {
  id:                   string
  referenceCode:        string
  employeeId:           string
  employeeName:         string
  employeeInitials:     string
  // Categorie du beneficiaire — necessaire pour resoudre le plafond
  // (ExpenseCeiling) applicable a chaque ligne, cote createur ET validateur
  // (plafond non bloquant, voir decision du 12/08).
  employeeCategoryId?:  string
  createdById?:         string
  createdByName?:       string
  title:                string
  missionOrderId?:      string
  lines:                ExpenseLine[]
  totalAmount:          number
  currency:             string
  status:               ExpenseStatus
  approvalPoolId?:      string
  currentApprovalStep?: number
  rejectionReason?:     string
  submittedAt?:         string
  createdAt:            string
  modifiedAt?:          string | null
  validationHistory?:   ValidationStep[]
}

// ── Entities ─────────────────────────────────────────────────
// Values match the backend OrganizationUnit.Status / .Type columns exactly
// (Prisma emulates enums as plain strings — see productive247-hrm-backend).
export type EntityStatus = 'Draft' | 'PendingApproval' | 'Active' | 'Inactive'
export type EntityType   = 'Direction' | 'Department' | 'Service'


// ── Employees ─────────────────────────────────────────────────
export type EmployeeStatus  = 'active' | 'trial' | 'onleave' | 'inactive'
export type ContractType    = 'CDI' | 'CDD' | 'Stage' | 'Freelance' | 'Apprenti' | 'Alternant'
export type Gender          = 'M' | 'F'
export type MaritalStatus   = 'Single' | 'Married' | 'Divorced' | 'Widowed'
export type IdDocumentType  = 'NationalId' | 'Passport' | 'ResidencePermit'

export interface Employee {
  id:           string
  code:         string
  firstName:    string
  lastName:     string
  name:         string
  initials:     string
  avatarBg:     string
  avatarText:   string
  jobTitle:     string
  // FK vers la fiche Position réelle (module Position, branché au backend) —
  // jobTitle ci-dessus est dérivé de positionTitle pour l'affichage, pas
  // stocké tel quel côté backend (Employee n'a pas de colonne libre pour ça).
  positionId?:  string
  entityId:     string | null
  entityName?:  string
  email?:       string
  phone?:       string
  hireDate:     string
  contractType: ContractType
  status:       EmployeeStatus
  // Dérivé du responsable de l'entité de rattachement (OrganizationUnit.ManagerId)
  // — Employee n'a pas de colonne ManagerId propre côté backend, voir
  // stores/employees.ts:mapEmployee.
  managerId?:   string
  gender:          Gender
  birthDate:       string
  birthPlace?:     string
  maritalStatus:   MaritalStatus
  idType:          IdDocumentType
  idNumber?:       string
  // Catégorie (voir stores/employeeCategories.ts) — détermine le taux de
  // frais/perdiem (ExpenseConfig) et, à la création d'un compte utilisateur
  // pour cet employé, le paquet de permissions proposé par défaut.
  employeeCategoryId?: string
  // A un compte système (peut se connecter) — seul un employé avec un compte
  // peut être choisi comme validateur. Reflète Employee.UserId != null.
  hasAccount:   boolean
  // Employee.UserId — présent seulement si hasAccount, sert à interroger/
  // modifier les permissions individuelles du compte (voir EmployeeCard.vue).
  userId?:      string
  // Régime de congés (réunion Dominique du 12/06) : un employé "local" qui
  // est absent tout le vendredi précédant un week-end voit ce week-end aussi
  // décompté de son solde — pas un "expatrié". Voir utils/calendar.ts et
  // computeWorkingDays côté backend.
  isExpatriate: boolean
}

export interface Entity {
  id:          string
  code:        string
  name:        string
  type:        EntityType
  parentId:    string | null
  managerId:   string | null
  address?:    string
  phone?:      string
  email?:      string
  status:      EntityStatus
  createdBy:   string
  createdAt:   string
  modifiedBy?: string | null
  modifiedAt?: string | null
  legalIdentifier?: string
  // Not part of the backend OrganizationUnit response — enriched client-side
  // by the store (manager lookup / employee count). Pools de validation
  // (ApprovalPool) vivent dans leur propre store, voir stores/approvalPools.ts.
  responsibleName?: string
  headcount:        number
  children?:        Entity[]
}

// ── Calendar ──────────────────────────────────────────────────
export interface WorkingHours {
  start:      string // "08:00"
  end:        string // "17:30"
  breakStart: string // "12:00"
  breakEnd:   string // "14:00"
}

export interface WorkingDayConfig {
  enabled:      boolean
  start:        string  // "08:00"
  end:          string  // "17:30"
  breakEnabled: boolean
  breakStart:   string  // "12:00"
  breakEnd:     string  // "14:00"
}

export interface WorkingDays {
  monday:    WorkingDayConfig
  tuesday:   WorkingDayConfig
  wednesday: WorkingDayConfig
  thursday:  WorkingDayConfig
  friday:    WorkingDayConfig
  saturday:  WorkingDayConfig
  sunday:    WorkingDayConfig
}

// HolidayScope matches backend Holiday.HolidayType (National = toute
// l'entreprise, Local = restreint a une OrganizationUnit). Ne pas confondre
// avec la recurrence annuelle, portee par isRecurring.
export type HolidayScope = 'National' | 'Local'

export interface Holiday {
  id:                  string
  name:                string
  date:                string        // "YYYY-MM-DD" — pour un ferie recurrent, seuls mois/jour comptent
  isRecurring:         boolean       // true = annuel, false = ponctuel
  holidayType:         HolidayScope
  organizationUnitId?: string | null // requis si holidayType = 'Local'
  // Ciblage d'eligibilite (demande client, 01/09) — absent/null sur un
  // critere = s'applique a tout le monde sur ce critere. Meme mecanisme que
  // sur LeaveType (voir stores/leaveTypes.ts).
  appliesToGender?:     'M' | 'F' | null
  appliesToExpatriate?: boolean | null
}

export interface CompanyCalendar {
  id:            string
  workingDays:   WorkingDays
  holidays:      Holiday[]
  updatedAt:     string
  updatedBy:     string
}

export interface EmployeeSchedule {
  employeeId:           string
  inheritsFromCompany:  boolean
  customWorkingDays?:   WorkingDays
  customWorkingHours?:  WorkingHours
  scheduleNotes?:       string
}

export interface DayPlanning {
  date:           string       // YYYY-MM-DD
  isWorkingDay:   boolean
  isHoliday:      boolean
  holidayName?:   string
  isAbsence:      boolean
  absenceType?:   string
  absenceStatus?: LeaveRequestStatus
  // Couleur propre au type de congé (LeaveType.Color, définie à la création
  // du type) — chaque type s'affiche avec sa propre couleur sur le
  // planning, pas une couleur générique unique pour tous.
  absenceColor?:  string
  hours?:         WorkingHours
}
