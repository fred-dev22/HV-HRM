import { connectSocket, disconnectSocket } from './socket'
import { useAuthStore } from '../stores/auth'
import { useNotificationStore, type BackendNotification } from '../stores/notifications'
import { useLeaveRequestStore } from '../stores/leaveRequests'
import { useMissionStore } from '../stores/missions'
import { useExpenseStore } from '../stores/expenses'
import { useEmployeeStore } from '../stores/employees'
import { useLeaveTypesStore } from '../stores/leaveTypes'
import {
  useHiringRequestStore, useJobOfferStore, useApplicationStore, useInterviewStore,
  useEvalTemplateStore, useTalentPoolStore, useContractStore, useTrialStore,
  useDistributionStore,
} from '../stores/recruitment'

type DataDomain = 'leave' | 'mission' | 'expense' | 'employee' | 'leaveType' | 'recruitment'

// Permissions *_VOIR_EQUIPE / *_VOIR_TOUT / *_VALIDER — memes codes que les
// @RequirePermission cote backend (leave/mission/expense controllers). On se
// base sur elles plutot que sur "la liste est deja non-vide" : cette
// dernniere heuristique confond a tort "jamais chargee" et "chargee et
// confirmee a zero", donc un badge a 0 ne remontait jamais a 1 en direct.
const PERMISSIONS: Record<DataDomain, { team: string; all: string; validate: string } | null> = {
  leave: { team: 'CONGE_VOIR_EQUIPE', all: 'CONGE_VOIR_TOUT', validate: 'CONGE_VALIDER' },
  mission: { team: 'MISSION_VOIR_EQUIPE', all: 'MISSION_VOIR_TOUT', validate: 'MISSION_VALIDER' },
  expense: { team: 'FRAIS_VOIR_EQUIPE', all: 'FRAIS_VOIR_TOUT', validate: 'FRAIS_VALIDER' },
  employee: null,
  leaveType: null,
  recruitment: null,
}

// mine n'a aucune permission dediee cote backend (juste "les miennes") —
// toujours sans risque a re-fetch. team/all/pendingForMe sont gardes par
// leur permission *_VOIR_EQUIPE/*_VOIR_TOUT/*_VALIDER respective, pas par la
// longueur de la liste locale (voir plus haut).
function refreshWorkflowStore(
  domain: 'leave' | 'mission' | 'expense',
  store: { fetchMine: () => unknown; fetchTeam: () => unknown; fetchAll: () => unknown; fetchPendingForMe: () => unknown },
) {
  const auth = useAuthStore()
  const perms = PERMISSIONS[domain]!
  store.fetchMine()
  if (auth.hasPermission(perms.validate)) store.fetchPendingForMe()
  if (auth.hasPermission(perms.team)) store.fetchTeam()
  if (auth.hasPermission(perms.all)) store.fetchAll()
}

function refreshDomain(domain: DataDomain) {
  if (domain === 'leave')    refreshWorkflowStore('leave', useLeaveRequestStore())
  if (domain === 'mission')  refreshWorkflowStore('mission', useMissionStore())
  if (domain === 'expense')  refreshWorkflowStore('expense', useExpenseStore())
  if (domain === 'employee') {
    const auth = useAuthStore()
    // Meme raisonnement que refreshWorkflowStore pour team/all — sans ce
    // branchement, TeamView.vue (EMPLOYE_VOIR_EQUIPE) ne recevait jamais de
    // mise a jour en direct, seul EMPLOYE_VOIR_TOUT etait couvert (Lot H #10).
    if (auth.hasPermission('EMPLOYE_VOIR_EQUIPE')) useEmployeeStore().fetchTeam()
    if (auth.hasPermission('EMPLOYE_VOIR_TOUT')) useEmployeeStore().fetchAll()
  }
  // GET /leave-types n'est gardee par aucune permission (voir controller) —
  // pas de branchement par droit necessaire, contrairement aux domaines
  // ci-dessus. Sans ce refresh, un employe avec le formulaire "Nouvelle
  // demande d'absence" deja ouvert ne voyait jamais un type de conge cree/
  // modifie/desactive entre temps (retour client du 09/09) — leaveTypesStore
  // ne se recharge sinon qu'une seule fois par session (voir AbsenceCreate.vue).
  if (domain === 'leaveType') useLeaveTypesStore().fetchAll()
  // Module Recrutement : broadcaste ce seul domaine pour tout evenement
  // (offre publiee, candidature reçue, vue/candidatures incrementees,
  // entretien planifie/evalue, contrat negocie...) — voir
  // RecruitmentNotifyService.broadcast() cote backend. Une seule permission
  // ouvre tout le module (RECRUTEMENT_ACCES, decision du 05/09), pas de
  // distinction team/all comme leave/mission/expense. Chaque store n'est
  // recharge que s'il a deja ete visite cette session (items deja charges) :
  // sans ce filtre, un simple "vues +1" sur une offre publique rechargerait
  // aussi bien les entretiens que le vivier de talents meme jamais ouverts.
  if (domain === 'recruitment') refreshRecruitmentDomain()
}

function refreshRecruitmentDomain() {
  const auth = useAuthStore()
  if (!auth.hasPermission('RECRUTEMENT_ACCES')) return
  const jobOffers = useJobOfferStore()
  const applications = useApplicationStore()
  const interviews = useInterviewStore()
  const hiringRequests = useHiringRequestStore()
  const contracts = useContractStore()
  const trials = useTrialStore()
  const talentPool = useTalentPoolStore()
  const evalTemplates = useEvalTemplateStore()
  const distribution = useDistributionStore()
  if (jobOffers.items.length > 0) jobOffers.fetchAll()
  if (applications.items.length > 0) applications.fetchAll()
  if (interviews.items.length > 0) interviews.fetchAll()
  if (hiringRequests.items.length > 0) hiringRequests.fetchAll()
  if (contracts.items.length > 0) contracts.fetchAll()
  if (trials.items.length > 0) trials.fetchAll()
  if (talentPool.items.length > 0) talentPool.fetchAll()
  if (evalTemplates.items.length > 0) evalTemplates.fetchAll()
  if (distribution.channels.length > 0) distribution.fetchChannels()
}

let subscribed = false

// Ouvre la connexion WebSocket et branche les deux canaux : notifications
// personnelles (cloche) + rafraichissement des listes/KPI deja chargees.
// Appele une seule fois par session, depuis auth.ts (login/restoreSession
// reussis) — voir disconnectRealtime() pour le pendant logout.
export function connectRealtime() {
  const socket = connectSocket()
  if (subscribed) return
  subscribed = true

  socket.on('notification:new', (raw: BackendNotification) => {
    useNotificationStore().receiveRealtime(raw)
  })

  socket.on('data:changed', (payload: { domain: DataDomain }) => {
    refreshDomain(payload.domain)
  })
}

export function disconnectRealtime() {
  subscribed = false
  disconnectSocket()
}
