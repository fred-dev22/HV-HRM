/**
 * Types du module Recrutement — écrans construits sur données fictives
 * (voir mockSeed.ts), en attendant le backend. Les statuts suivent le même
 * vocabulaire que les autres domaines (LeaveRequest, MissionOrder…) pour que
 * StatusPill les affiche sans configuration supplémentaire là où c'est
 * pertinent (Draft/PendingApproval/Approved/Rejected/Returned/Cancelled).
 */

export type WorkflowStatus =
  | 'Draft' | 'PendingApproval' | 'Approved' | 'Rejected' | 'Returned' | 'Cancelled'

export interface HiringRequest {
  id: string
  positionTitle: string
  entityName: string
  headcount: number
  profile: string
  requestedByName: string
  requestedAt: string
  status: WorkflowStatus
  rejectionReason?: string
}

export type JobOfferStatus = WorkflowStatus | 'Published' | 'Closed'

export interface JobOffer {
  id: string
  hiringRequestId?: string
  title: string
  entityName: string
  contractType: string
  location: string
  description: string
  status: JobOfferStatus
  publishedAt?: string
  views: number
  rejectionReason?: string
  // Renseigne a la cloture de l'offre (voir JobOfferWorkflowActions.vue) :
  // cout total de la campagne (annonces, cabinet de recrutement, etc.), en
  // MGA. Sert au calcul du "cout par recrutement" sur PipelineView.vue.
  recruitmentCost?: number
}

// Un stage est une offre d'emploi comme une autre (JobOffer.contractType =
// 'Stage') : pas de source "Internship" separee, une candidature a une offre
// de stage est une candidature "Offer" normale (decision du 25/08).
// 'Internal' : mobilite interne, voir liste-besoins.md / doc2 ligne 742
// ("Ajouter a la candidature" depuis la fiche d'un salarie) — un employe deja
// dans le systeme postule a une offre, contrairement a 'Offer'/'Spontaneous'
// qui restent des candidats externes.
export type ApplicationSource = 'Offer' | 'Spontaneous' | 'Internal'
export type ApplicationStatus = 'New' | 'InReview' | 'InterviewScheduled' | 'Retained' | 'Rejected'

export interface ApplicationNote {
  authorName: string
  text: string
  date: string
}

export interface Application {
  id: string
  jobOfferId?: string
  jobOfferTitle?: string
  candidateName: string
  candidateEmail: string
  candidatePhone: string
  source: ApplicationSource
  // Absent pour une candidature interne (source 'Internal') : le dossier de
  // l'employe existe deja, pas besoin de redeposer un CV.
  cvFileName?: string
  // Renseigne uniquement pour une candidature interne (source 'Internal') —
  // id du vrai compte employe, choisi via l'annuaire (voir JobOfferCard.vue),
  // meme limite que InterviewParticipant.employeeId (pas d'email disponible
  // depuis l'annuaire leger).
  employeeId?: string
  status: ApplicationStatus
  appliedAt: string
  notes: ApplicationNote[]
}

export type InterviewStatus = 'Scheduled' | 'Done' | 'Cancelled'
export type InterviewMode = 'InPerson' | 'VideoCall'

// Grilles d'evaluation standardisees (cartographie client, section
// "Entretiens" : "Grilles d'evaluation standardisees") — un jeu fixe de
// criteres note chacun /5, plutot qu'une seule note globale. Reste
// optionnel : "Aucune (note libre)" reste possible sur le formulaire
// d'evaluation (voir InterviewWorkflowActions.vue).
export interface InterviewEvaluationTemplate {
  id: string
  name: string
  criteria: string[]
}

export interface InterviewCriterionScore {
  label: string
  score: number
}

export interface InterviewEvaluation {
  // Note globale : moyenne des criteres si une grille a ete utilisee, saisie
  // directement sinon.
  score: number
  comment: string
  interviewerName: string
  templateName?: string
  criteriaScores?: InterviewCriterionScore[]
}

export interface InterviewParticipant {
  // Id du vrai compte employe (choisi via l'annuaire /employees/directory
  // dans InterviewsView.vue) — evite les doublons et les fautes de frappe
  // qu'un champ texte libre permettait.
  employeeId?: string
  name: string
  // L'annuaire leger (/employees/directory) n'expose pas l'email — champ
  // volontairement minimal, accessible sans permission elevee (voir
  // employees.ts). Ce champ reste donc vide tant qu'on le remplit depuis ce
  // picker ; conserve pour que "Ajouter a mon calendrier" (calendarLinks.ts)
  // invite ce participant des que l'email sera disponible (endpoint enrichi,
  // ou vrai backend Recrutement).
  email?: string
}

export interface Interview {
  id: string
  applicationId: string
  candidateName: string
  // Toujours connu (recopie d'Application.candidateEmail a la creation) :
  // le candidat est systematiquement invite au calendrier de son entretien.
  candidateEmail: string
  jobOfferTitle: string
  scheduledAt: string
  mode: InterviewMode
  // L'un ou l'autre selon mode, jamais les deux (voir InterviewsView.vue) :
  // location pour un entretien en presentiel, meetingLink pour une visio.
  location?: string
  meetingLink?: string
  participants: InterviewParticipant[]
  status: InterviewStatus
  evaluation?: InterviewEvaluation
}

// Vue par defaut du client : "Potentiels ouverts" (doc2, section "Objet
// Potentiel") — sous-entend un statut. Ouvert = toujours disponible/a
// recontacter ; Ferme = plus d'actualite (recrute ailleurs, ne repond plus…).
export type TalentPoolStatus = 'Open' | 'Closed'

// Le client modelise "Evaluations Potentiel" comme une entite a part, pas un
// champ texte (doc2, section "Objet Potentiel") — historique horodate,
// meme forme que TrialEvaluation.
export interface TalentPoolEvaluation {
  score: number
  comment: string
  evaluatedByName: string
  date: string
}

export interface TalentPoolEntry {
  id: string
  candidateName: string
  candidateEmail: string
  candidatePhone: string
  tags: string[]
  notes: string
  sourceApplicationId?: string
  addedAt: string
  status: TalentPoolStatus
  evaluations: TalentPoolEvaluation[]
}

export interface ContractTemplate {
  id: string
  name: string
  contractType: string
  content: string
}

export type ContractStatus =
  | 'Draft' | 'PendingApproval' | 'Approved' | 'Rejected' | 'Returned'
  | 'SentToCandidate' | 'AcceptedByCandidate' | 'RefusedByCandidate' | 'Cancelled'

export interface Contract {
  id: string
  applicationId: string
  candidateName: string
  templateId: string
  templateName: string
  jobTitle: string
  entityName: string
  startDate: string
  // Absent pour un CDI (duree indeterminee, pas de terme) ; requis pour tout
  // autre type (CDD, Stage, Freelance, Apprenti, Alternant, Essai), voir
  // validate() dans ContractsView.vue.
  endDate?: string
  salary: number
  status: ContractStatus
  rejectionReason?: string
  // Simulation uniquement : ce module n'a pas de backend, ce champ ne cree
  // aucun vrai compte dans le module Employes (voir BACKLOG.md, "Conversion
  // candidat -> employe"). Sert juste a visualiser/valider le point d'entree
  // avec le client avant de le brancher pour de vrai.
  employeeProfileCreated?: boolean
}

export type TrialStatus = 'OnTrial' | 'Extended' | 'Converted' | 'Cancelled'

export interface TrialEvaluation {
  score: number
  comment: string
  evaluatedByName: string
  date: string
}

export interface TrialEmployee {
  id: string
  contractId: string
  employeeName: string
  jobTitle: string
  entityName: string
  startDate: string
  trialEndDate: string
  status: TrialStatus
  evaluation?: TrialEvaluation
}
