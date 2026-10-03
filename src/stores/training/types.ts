/**
 * Types du module Formation (JSON identique à celui du backend
 * /training, voir src/stores/training/index.ts). Statuts calqués sur les entités
 * déjà réelles ailleurs dans l'appli quand le sens correspond (Scheduled/
 * Done/Cancelled pour une session, Approved/Rejected pour une validation…),
 * voir StatusPill.vue.
 */

// ── Catalogue de formations ─────────────────────────────────────
export type CourseStatus = 'InPreparation' | 'InProgress' | 'Archived'

export interface Course {
  id: string
  referenceCode: string
  title: string
  category: string
  description: string
  durationHours: number
  maxParticipants: number
  providerId?: string
  providerName?: string
  status: CourseStatus
  budgetAllocated: number
  budgetUsed: number
  sessionsCount: number
  createdAt: string
}

// ── Sessions planifiées ──────────────────────────────────────────
export type SessionStatus = 'Scheduled' | 'Done' | 'Cancelled'
export type SessionMode = 'InPerson' | 'VideoCall'

export interface TrainingSession {
  id: string
  referenceCode: string
  courseId: string
  courseTitle: string
  scheduledAt: string
  endAt: string
  mode: SessionMode
  location?: string
  meetingLink?: string
  trainerName: string
  status: SessionStatus
  capacity: number
  enrolledCount: number
}

// ── Inscriptions (couvre aussi la demande de formation à valider) ──
export type EnrollmentStatus = 'Requested' | 'Approved' | 'Rejected' | 'Attended' | 'Cancelled'

export interface EvaluationEntry {
  score: number
  comment: string
  date: string
}

export interface Enrollment {
  id: string
  sessionId: string
  courseTitle: string
  sessionScheduledAt: string
  employeeId: string
  employeeName: string
  entityName: string
  requestedByName: string
  requestedAt: string
  status: EnrollmentStatus
  attendanceSheetSigned?: boolean
  hotEvaluation?: EvaluationEntry
  coldEvaluationDueAt?: string
  coldEvaluation?: EvaluationEntry
}

// ── Fournisseurs de formation ────────────────────────────────────
export type ProviderStatus = 'active' | 'inactive'

export interface Provider {
  id: string
  name: string
  contactName: string
  email: string
  phone: string
  specialties: string
  lastEvaluationScore?: number
  lastEvaluationDate?: string
  nextEvaluationDueAt: string
  status: ProviderStatus
}

// ── Budget formation ──────────────────────────────────────────────
export type BudgetRequestStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected'

export interface BudgetLine {
  id: string
  year: number
  entityName: string
  courseTitle?: string
  allocated: number
  used: number
  requestStatus?: BudgetRequestStatus
  comment?: string
}
