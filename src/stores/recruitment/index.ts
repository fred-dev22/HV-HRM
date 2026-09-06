/**
 * Stores Pinia du module Recrutement — données fictives (mockSeed.ts), pas
 * d'appel API. Interface volontairement proche des vrais stores (submit/
 * approve/reject/returnItem/cancel…) pour que le branchement au backend,
 * plus tard, ne soit qu'un remplacement d'implémentation, pas une réécriture
 * des écrans qui les consomment.
 */
import { defineStore } from 'pinia'
import {
  hiringRequests, jobOffers, applications, interviews, interviewEvaluationTemplates, talentPool,
  contractTemplates, contracts, trialEmployees, nextId,
} from './mockSeed'
import type {
  HiringRequest, JobOffer, Application, ApplicationStatus, Interview, InterviewEvaluation,
  TalentPoolEntry, TalentPoolEvaluation, Contract, TrialEmployee,
} from './types'

export * from './types'

// ── Expressions de besoin ──────────────────────────────────────
export const useHiringRequestStore = defineStore('recruitment-hiring-requests', {
  state: () => ({ items: hiringRequests }),
  actions: {
    create(payload: Omit<HiringRequest, 'id' | 'status' | 'requestedAt'>) {
      this.items.unshift({ ...payload, id: nextId('hreq'), status: 'Draft', requestedAt: new Date().toISOString().slice(0, 10) })
    },
    submit(id: string) { const r = this.items.find(x => x.id === id); if (r) r.status = 'PendingApproval' },
    approve(id: string) { const r = this.items.find(x => x.id === id); if (r) r.status = 'Approved' },
    reject(id: string, reason: string) { const r = this.items.find(x => x.id === id); if (r) { r.status = 'Rejected'; r.rejectionReason = reason } },
    returnItem(id: string, reason: string) { const r = this.items.find(x => x.id === id); if (r) { r.status = 'Returned'; r.rejectionReason = reason } },
    cancel(id: string) { const r = this.items.find(x => x.id === id); if (r) r.status = 'Cancelled' },
  },
})

// ── Offres d'emploi ─────────────────────────────────────────────
export const useJobOfferStore = defineStore('recruitment-job-offers', {
  state: () => ({ items: jobOffers }),
  getters: {
    published: (state) => state.items.filter(o => o.status === 'Published'),
  },
  actions: {
    create(payload: Omit<JobOffer, 'id' | 'status' | 'views'>) {
      this.items.unshift({ ...payload, id: nextId('offer'), status: 'Draft', views: 0 })
    },
    submit(id: string) { const o = this.items.find(x => x.id === id); if (o) o.status = 'PendingApproval' },
    approve(id: string) { const o = this.items.find(x => x.id === id); if (o) o.status = 'Approved' },
    reject(id: string, reason: string) { const o = this.items.find(x => x.id === id); if (o) { o.status = 'Rejected'; o.rejectionReason = reason } },
    publish(id: string) { const o = this.items.find(x => x.id === id); if (o) { o.status = 'Published'; o.publishedAt = new Date().toISOString().slice(0, 10) } },
    close(id: string, recruitmentCost?: number) {
      const o = this.items.find(x => x.id === id)
      if (o) { o.status = 'Closed'; if (recruitmentCost !== undefined) o.recruitmentCost = recruitmentCost }
    },
    applicationsCount(id: string): number { return applications.filter(a => a.jobOfferId === id).length },
  },
})

// ── Candidatures (offre / spontanées) ────────────────────────────
// Une offre de stage est une JobOffer comme une autre (contractType =
// 'Stage') : ses candidatures sont des candidatures "Offer" normales,
// visibles dans l'ecran Candidatures, pas dans un ecran a part.
export const useApplicationStore = defineStore('recruitment-applications', {
  state: () => ({ items: applications }),
  getters: {
    // Externe (Offer) ou interne (Internal) : les deux sont liees a une
    // offre precise, contrairement a Spontaneous — voir ApplicationsView.vue.
    fromOffers: (state) => state.items.filter(a => a.source === 'Offer' || a.source === 'Internal'),
    spontaneous: (state) => state.items.filter(a => a.source === 'Spontaneous'),
    internal: (state) => state.items.filter(a => a.source === 'Internal'),
  },
  actions: {
    // Depot public (portail carriere, sans connexion, voir
    // PublicJobApplicationView.vue) — toujours source 'Offer' puisqu'on ne
    // peut postuler que depuis une offre publiee.
    apply(payload: { jobOfferId: string; jobOfferTitle: string; candidateName: string; candidateEmail: string; candidatePhone: string; cvFileName: string }) {
      this.items.unshift({
        ...payload, id: nextId('app'), source: 'Offer', status: 'New',
        appliedAt: new Date().toISOString().slice(0, 10), notes: [],
      })
    },
    // Candidature spontanee (pas liee a une offre) — deux points d'entree
    // partagent cette action : le portail public (PublicSpontaneousApplicationView.vue,
    // le candidat se depose lui-meme) et l'ecran interne
    // (SpontaneousApplicationsView.vue, un RH enregistre un CV reçu par un
    // autre canal — mail, depot en personne...). Voir la note du client :
    // "Reception ET enregistrement des candidatures spontanees".
    applySpontaneous(payload: { candidateName: string; candidateEmail: string; candidatePhone: string; cvFileName: string }) {
      this.items.unshift({
        ...payload, id: nextId('app'), source: 'Spontaneous', status: 'New',
        appliedAt: new Date().toISOString().slice(0, 10), notes: [],
      })
    },
    // Candidature interne (mobilite) — un employe deja dans le systeme
    // postule a une offre publiee, voir JobOfferCard.vue. Pas de CV ni
    // d'email/telephone : l'annuaire leger utilise pour choisir l'employe
    // (meme limite que InterviewParticipant, voir employees.ts) ne les
    // expose pas.
    applyInternal(payload: { jobOfferId: string; jobOfferTitle: string; employeeId: string; candidateName: string }) {
      this.items.unshift({
        jobOfferId: payload.jobOfferId, jobOfferTitle: payload.jobOfferTitle, employeeId: payload.employeeId,
        candidateName: payload.candidateName, candidateEmail: '', candidatePhone: '',
        id: nextId('app'), source: 'Internal', status: 'New',
        appliedAt: new Date().toISOString().slice(0, 10), notes: [],
      })
    },
    setStatus(id: string, status: ApplicationStatus) { const a = this.items.find(x => x.id === id); if (a) a.status = status },
    addNote(id: string, authorName: string, text: string) {
      const a = this.items.find(x => x.id === id)
      if (a) a.notes.unshift({ authorName, text, date: new Date().toISOString().slice(0, 10) })
    },
    addToTalentPool(id: string, tags: string[] = [], notes = '') {
      const a = this.items.find(x => x.id === id)
      if (!a) return
      talentPool.unshift({
        id: nextId('tp'), candidateName: a.candidateName, candidateEmail: a.candidateEmail,
        candidatePhone: a.candidatePhone, tags, notes, sourceApplicationId: a.id,
        addedAt: new Date().toISOString().slice(0, 10), status: 'Open', evaluations: [],
      })
    },
  },
})

// ── Entretiens ────────────────────────────────────────────────
export const useInterviewStore = defineStore('recruitment-interviews', {
  state: () => ({ items: interviews, evaluationTemplates: interviewEvaluationTemplates }),
  actions: {
    schedule(payload: Omit<Interview, 'id' | 'status'>) {
      this.items.push({ ...payload, id: nextId('itw'), status: 'Scheduled' })
      const app = applications.find(a => a.id === payload.applicationId)
      if (app && app.status === 'New') app.status = 'InterviewScheduled'
    },
    markDone(id: string) { const i = this.items.find(x => x.id === id); if (i) i.status = 'Done' },
    cancel(id: string) { const i = this.items.find(x => x.id === id); if (i) i.status = 'Cancelled' },
    evaluate(id: string, evaluation: InterviewEvaluation) {
      const i = this.items.find(x => x.id === id)
      if (i) { i.evaluation = evaluation; i.status = 'Done' }
    },
  },
})

// ── Vivier de talents ────────────────────────────────────────────
export const useTalentPoolStore = defineStore('recruitment-talent-pool', {
  state: () => ({ items: talentPool }),
  actions: {
    add(payload: Omit<TalentPoolEntry, 'id' | 'addedAt' | 'status' | 'evaluations'>) {
      this.items.unshift({ ...payload, id: nextId('tp'), addedAt: new Date().toISOString().slice(0, 10), status: 'Open', evaluations: [] })
    },
    remove(id: string) { const idx = this.items.findIndex(x => x.id === id); if (idx >= 0) this.items.splice(idx, 1) },
    searchByTag(query: string) {
      const q = query.trim().toLowerCase()
      if (!q) return this.items
      return this.items.filter(e => e.tags.some(t => t.toLowerCase().includes(q)) || e.candidateName.toLowerCase().includes(q))
    },
    close(id: string) { const e = this.items.find(x => x.id === id); if (e) e.status = 'Closed' },
    reopen(id: string) { const e = this.items.find(x => x.id === id); if (e) e.status = 'Open' },
    addEvaluation(id: string, evaluation: Omit<TalentPoolEvaluation, 'date'>) {
      const e = this.items.find(x => x.id === id)
      if (e) e.evaluations.unshift({ ...evaluation, date: new Date().toISOString().slice(0, 10) })
    },
  },
})

// ── Modèles + contrats ───────────────────────────────────────────
export const useContractStore = defineStore('recruitment-contracts', {
  state: () => ({ items: contracts, templates: contractTemplates }),
  actions: {
    createTemplate(name: string, contractType: string, content: string) {
      this.templates.push({ id: nextId('tpl'), name, contractType, content })
    },
    updateTemplate(id: string, patch: Partial<{ name: string; contractType: string; content: string }>) {
      const t = this.templates.find(x => x.id === id); if (t) Object.assign(t, patch)
    },
    generate(payload: Omit<Contract, 'id' | 'status'>) {
      this.items.unshift({ ...payload, id: nextId('ctr'), status: 'Draft' })
    },
    submit(id: string) { const c = this.items.find(x => x.id === id); if (c) c.status = 'PendingApproval' },
    approve(id: string) { const c = this.items.find(x => x.id === id); if (c) c.status = 'Approved' },
    reject(id: string, reason: string) { const c = this.items.find(x => x.id === id); if (c) { c.status = 'Rejected'; c.rejectionReason = reason } },
    returnItem(id: string, reason: string) { const c = this.items.find(x => x.id === id); if (c) { c.status = 'Returned'; c.rejectionReason = reason } },
    sendToCandidate(id: string) { const c = this.items.find(x => x.id === id); if (c) c.status = 'SentToCandidate' },
    candidateAccept(id: string) {
      const c = this.items.find(x => x.id === id)
      if (!c) return
      c.status = 'AcceptedByCandidate'
      trialEmployees.unshift({
        id: nextId('trial'), contractId: c.id, employeeName: c.candidateName, jobTitle: c.jobTitle,
        entityName: c.entityName, startDate: c.startDate,
        trialEndDate: new Date(new Date(c.startDate).setMonth(new Date(c.startDate).getMonth() + 2)).toISOString().slice(0, 10),
        status: 'OnTrial',
      })
    },
    candidateRefuse(id: string) { const c = this.items.find(x => x.id === id); if (c) c.status = 'RefusedByCandidate' },
    cancel(id: string) { const c = this.items.find(x => x.id === id); if (c) c.status = 'Cancelled' },
    // Simulation uniquement (voir Contract.employeeProfileCreated) : ne cree
    // rien dans le vrai module Employes, faute de backend sur ce module.
    markEmployeeProfileCreated(id: string) {
      const c = this.items.find(x => x.id === id)
      if (c) c.employeeProfileCreated = true
    },
  },
})

// ── Périodes d'essai ─────────────────────────────────────────────
export const useTrialStore = defineStore('recruitment-trial', {
  state: () => ({ items: trialEmployees }),
  actions: {
    evaluate(id: string, evaluation: { score: number; comment: string; evaluatedByName: string }) {
      const t = this.items.find(x => x.id === id)
      if (t) t.evaluation = { ...evaluation, date: new Date().toISOString().slice(0, 10) }
    },
    extend(id: string, newEndDate: string) { const t = this.items.find(x => x.id === id); if (t) { t.status = 'Extended'; t.trialEndDate = newEndDate } },
    convert(id: string) { const t = this.items.find(x => x.id === id); if (t) t.status = 'Converted' },
    cancel(id: string) { const t = this.items.find(x => x.id === id); if (t) t.status = 'Cancelled' },
  },
})
