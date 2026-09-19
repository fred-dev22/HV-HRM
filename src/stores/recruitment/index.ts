/**
 * Stores Pinia du module Recrutement — branchés sur le vrai backend
 * (productive247-hrm-backend, src/modules/recruitment). Les noms de stores et
 * d'actions reprennent ceux de l'ancienne version fictive pour limiter les
 * changements dans les écrans ; l'implémentation, elle, fait de vrais appels
 * API et re-mappe les réponses (PascalCase backend -> camelCase front), comme
 * les autres stores réels de l'app (voir stores/leaveTypes.ts).
 *
 * Aucun circuit de validation (décision client du 05/09) : pas d'action
 * approve/reject/submit-pour-approbation sur les offres, les besoins ou les
 * propositions d'embauche.
 */
import { defineStore } from 'pinia'
import { api, getApiErrorMessage } from '../../lib/api'
import type {
  HiringRequest, JobOffer, Application, ApplicationNote, ApplicationStatus,
  Interview, InterviewEvaluation, InterviewEvaluationTemplate, InterviewParticipant,
  TalentPoolEntry, TalentPoolEvaluation, Contract, ContractNegotiationRound, ContractTemplate,
  TrialEmployee, PublicJobOffer, RecruitmentDocument, RsvpResponse,
  DistributionChannel, JobOfferDistribution, ShareContent,
} from './types'

export * from './types'

const num = (v: unknown): number => (v == null ? 0 : Number(v))
const day = (v: unknown): string => (v ? String(v).slice(0, 10) : '')
const iso = (v: unknown): string => (v ? String(v) : '')

// ── Mappers backend -> front ───────────────────────────────────
type Row = Record<string, any>

function mapHiringRequest(r: Row): HiringRequest {
  return {
    id: r.Id,
    referenceCode: r.ReferenceCode,
    positionTitle: r.PositionTitle,
    entityName: r.EntityName,
    headcount: num(r.Headcount),
    profile: r.Profile,
    requestedByName: r.createdByEmployee?.FullName ?? '',
    requestedAt: day(r.CreatedAt),
    status: r.Status,
    positionId: r.PositionId ?? undefined,
    positionCapacity: r.PositionCapacity ?? undefined,
    positionAvailable: r.PositionAvailable ?? undefined,
    capacityWarning: !!r.CapacityWarning,
  }
}

function mapJobOffer(r: Row): JobOffer {
  return {
    id: r.Id,
    referenceCode: r.ReferenceCode,
    hiringRequestId: r.HiringRequestId ?? undefined,
    title: r.Title,
    entityName: r.EntityName,
    contractType: r.ContractType,
    location: r.Location,
    description: r.Description,
    status: r.Status,
    publishedAt: r.PublishedAt ? day(r.PublishedAt) : undefined,
    views: num(r.Views),
    applicationsCount: num(r._count?.applications),
    publicToken: r.PublicToken,
    evaluationTemplateId: r.InterviewEvaluationTemplateId ?? undefined,
    evaluationTemplateName: r.evaluationTemplate?.Name ?? undefined,
    recruitmentCost: r.RecruitmentCost != null ? num(r.RecruitmentCost) : undefined,
    excludeFromFeed: !!r.ExcludeFromFeed,
    salaryText: r.SalaryText ?? undefined,
  }
}

function mapDocument(r: Row): RecruitmentDocument {
  return {
    id: r.id ?? r.Id,
    fileName: r.fileName ?? r.FileName,
    fileUrl: r.fileUrl ?? r.FileUrl,
    fileSize: num(r.fileSize ?? r.FileSize),
    mimeType: r.mimeType ?? r.MimeType,
    createdAt: iso(r.createdAt ?? r.CreatedAt),
    isPrimaryCv: !!(r.isPrimaryCv ?? r.IsPrimaryCv),
  }
}

// Les endpoints de diffusion renvoient deja du camelCase (voir
// DistributionChannelService.shape / JobOfferDistributionService.shape cote
// backend), contrairement au reste du module qui expose les lignes Prisma
// brutes en PascalCase. On lit donc le camelCase en priorite, avec repli
// PascalCase par prudence.
function mapDistributionChannel(r: Row): DistributionChannel {
  return {
    id: r.id ?? r.Id,
    name: r.name ?? r.Name,
    kind: r.kind ?? r.Kind,
    targetUrl: (r.targetUrl ?? r.TargetUrl) ?? undefined,
    targetEmail: (r.targetEmail ?? r.TargetEmail) ?? undefined,
    hasSecret: !!(r.hasSecret ?? r.HasSecret),
    isActive: !!(r.isActive ?? r.IsActive),
  }
}

function mapJobOfferDistribution(r: Row): JobOfferDistribution {
  return {
    id: r.id ?? r.Id,
    jobOfferId: r.jobOfferId ?? r.JobOfferId,
    channelId: r.channelId ?? r.ChannelId,
    channelName: r.channelName ?? r.ChannelName,
    channelKind: r.channelKind ?? r.ChannelKind,
    status: r.status ?? r.Status,
    trigger: r.trigger ?? r.Trigger,
    externalUrl: (r.externalUrl ?? r.ExternalUrl) ?? undefined,
    attempts: num(r.attempts ?? r.Attempts),
    httpStatus: (r.httpStatus ?? r.HttpStatus) != null ? num(r.httpStatus ?? r.HttpStatus) : undefined,
    responseSnippet: (r.responseSnippet ?? r.ResponseSnippet) ?? undefined,
    lastAttemptAt: (r.lastAttemptAt ?? r.LastAttemptAt) ? iso(r.lastAttemptAt ?? r.LastAttemptAt) : undefined,
    postedAt: (r.postedAt ?? r.PostedAt) ? iso(r.postedAt ?? r.PostedAt) : undefined,
  }
}

function mapNote(r: Row): ApplicationNote {
  return { authorName: r.AuthorName, text: r.Text, date: day(r.CreatedAt) }
}

function mapApplication(r: Row): Application {
  return {
    id: r.Id,
    referenceCode: r.ReferenceCode,
    jobOfferId: r.JobOfferId ?? undefined,
    jobOfferTitle: r.JobOfferTitle ?? r.jobOffer?.Title ?? undefined,
    candidateName: r.CandidateName,
    candidateEmail: r.CandidateEmail,
    candidatePhone: r.CandidatePhone,
    source: r.Source,
    cvFileName: r.CvFileName ?? undefined,
    employeeId: r.EmployeeId ?? undefined,
    status: r.Status,
    appliedAt: day(r.AppliedAt),
    notes: (r.notes ?? []).map(mapNote),
    hasContract: !!r.contract,
  }
}

function mapParticipant(r: Row): InterviewParticipant {
  return {
    participantId: r.Id ?? undefined,
    employeeId: r.EmployeeId ?? undefined,
    name: r.Name,
    email: r.Email ?? undefined,
    rsvp: (r.Rsvp ?? undefined) as RsvpResponse | undefined,
    rsvpAt: r.RsvpAt ? iso(r.RsvpAt) : undefined,
    rsvpSource: r.RsvpSource ?? undefined,
  }
}

function mapInterviewEvaluation(r: Row | null | undefined): InterviewEvaluation | undefined {
  if (!r) return undefined
  return {
    score: num(r.Score),
    comment: r.Comment,
    interviewerName: r.InterviewerName,
    templateName: r.TemplateName ?? undefined,
    criteriaScores: (r.criteriaScores ?? []).map((c: Row) => ({ label: c.Label, score: num(c.Score) })),
  }
}

function mapInterview(r: Row): Interview {
  return {
    id: r.Id,
    referenceCode: r.ReferenceCode,
    applicationId: r.ApplicationId,
    candidateName: r.application?.CandidateName ?? '',
    candidateEmail: r.application?.CandidateEmail ?? '',
    jobOfferTitle: r.application?.JobOfferTitle ?? 'Poste',
    scheduledAt: iso(r.ScheduledAt),
    mode: r.Mode,
    location: r.Location ?? undefined,
    meetingLink: r.MeetingLink ?? undefined,
    participants: (r.participants ?? []).map(mapParticipant),
    status: r.Status,
    evaluation: mapInterviewEvaluation(r.evaluation),
    candidateRsvp: (r.CandidateRsvp ?? undefined) as RsvpResponse | undefined,
    candidateRsvpAt: r.CandidateRsvpAt ? iso(r.CandidateRsvpAt) : undefined,
    candidateRsvpSource: r.CandidateRsvpSource ?? undefined,
  }
}

function mapEvalTemplate(r: Row): InterviewEvaluationTemplate {
  return {
    id: r.Id,
    name: r.Name,
    criteria: (r.criteria ?? []).map((c: Row) => c.Label),
    jobOffersCount: num(r._count?.jobOffers),
  }
}

function mapTalentPoolEvaluation(r: Row): TalentPoolEvaluation {
  return { score: num(r.Score), comment: r.Comment, evaluatedByName: r.EvaluatedByName, date: day(r.CreatedAt) }
}

function mapTalentPoolEntry(r: Row): TalentPoolEntry {
  return {
    id: r.Id,
    referenceCode: r.ReferenceCode,
    candidateName: r.CandidateName,
    candidateEmail: r.CandidateEmail,
    candidatePhone: r.CandidatePhone,
    tags: r.Tags ? String(r.Tags).split(',').map((t: string) => t.trim()).filter(Boolean) : [],
    notes: r.Notes ?? '',
    sourceApplicationId: r.SourceApplicationId ?? undefined,
    addedAt: day(r.AddedAt),
    status: r.Status,
    evaluations: (r.evaluations ?? []).map(mapTalentPoolEvaluation),
  }
}

function mapContractTemplate(r: Row): ContractTemplate {
  return { id: r.Id, name: r.Name, contractType: r.ContractType, content: r.Content }
}

function mapNegotiationRound(r: Row): ContractNegotiationRound {
  return {
    roundNo: num(r.RoundNo),
    fromParty: r.FromParty,
    amount: r.Amount != null ? num(r.Amount) : undefined,
    comment: r.Comment,
    date: day(r.CreatedAt),
  }
}

function mapContract(r: Row): Contract {
  return {
    id: r.Id,
    referenceCode: r.ReferenceCode,
    applicationId: r.ApplicationId,
    candidateName: r.CandidateName,
    candidateEmail: r.application?.CandidateEmail ?? undefined,
    candidatePhone: r.application?.CandidatePhone ?? undefined,
    createdEmployeeId: r.CreatedEmployeeId ?? undefined,
    templateId: r.TemplateId ?? undefined,
    templateName: r.TemplateName ?? undefined,
    jobTitle: r.JobTitle,
    entityName: r.EntityName,
    startDate: day(r.StartDate),
    endDate: r.EndDate ? day(r.EndDate) : undefined,
    salary: num(r.Salary),
    status: r.Status,
    rejectionReason: r.RejectionReason ?? undefined,
    negotiationRounds: (r.negotiationRounds ?? []).map(mapNegotiationRound),
    employeeProfileCreated: !!r.EmployeeProfileCreated,
  }
}

function mapTrialEmployee(r: Row): TrialEmployee {
  const hasEval = r.EvalScore != null || r.EvalComment != null
  return {
    id: r.Id,
    referenceCode: r.ReferenceCode,
    contractId: r.ContractId,
    employeeName: r.EmployeeName,
    jobTitle: r.JobTitle,
    entityName: r.EntityName,
    startDate: day(r.StartDate),
    trialEndDate: day(r.TrialEndDate),
    status: r.Status,
    createdEmployeeId: r.CreatedEmployeeId ?? undefined,
    evaluation: hasEval
      ? {
          score: num(r.EvalScore),
          comment: r.EvalComment ?? '',
          evaluatedByName: r.EvalByName ?? '',
          date: day(r.EvalAt),
        }
      : undefined,
  }
}

function upsert<T extends { id: string }>(list: T[], row: T) {
  const i = list.findIndex((x) => x.id === row.id)
  if (i >= 0) list[i] = row
  else list.unshift(row)
}

// ═══════════════════════════════════════════════════════════════
// Expressions de besoin
// ═══════════════════════════════════════════════════════════════
export const useHiringRequestStore = defineStore('recruitment-hiring-requests', {
  state: () => ({ items: [] as HiringRequest[], loading: false, error: null as string | null }),
  actions: {
    async fetchAll() {
      this.loading = true
      try {
        const { data } = await api.get<Row[]>('/recruitment/hiring-requests')
        this.items = data.map(mapHiringRequest)
        this.error = null
      } catch (e) {
        this.error = getApiErrorMessage(e, 'Chargement des expressions de besoin impossible')
      } finally {
        this.loading = false
      }
    },
    async create(payload: { positionTitle: string; entityName: string; headcount: number; profile: string; positionId?: string }) {
      const { data } = await api.post<Row>('/recruitment/hiring-requests', {
        PositionTitle: payload.positionTitle,
        EntityName: payload.entityName,
        Headcount: payload.headcount,
        Profile: payload.profile,
        PositionId: payload.positionId,
      })
      upsert(this.items, mapHiringRequest(data))
      return mapHiringRequest(data)
    },
    async update(id: string, payload: Partial<{ positionTitle: string; entityName: string; headcount: number; profile: string; positionId: string | null }>) {
      const { data } = await api.patch<Row>(`/recruitment/hiring-requests/${id}`, {
        PositionTitle: payload.positionTitle,
        EntityName: payload.entityName,
        Headcount: payload.headcount,
        Profile: payload.profile,
        PositionId: payload.positionId,
      })
      upsert(this.items, mapHiringRequest(data))
    },
    async submit(id: string) {
      const { data } = await api.post<Row>(`/recruitment/hiring-requests/${id}/submit`)
      upsert(this.items, mapHiringRequest(data))
    },
    async close(id: string) {
      const { data } = await api.post<Row>(`/recruitment/hiring-requests/${id}/close`)
      upsert(this.items, mapHiringRequest(data))
    },
    async cancel(id: string) {
      const { data } = await api.post<Row>(`/recruitment/hiring-requests/${id}/cancel`)
      upsert(this.items, mapHiringRequest(data))
    },
    async remove(id: string) {
      await api.delete(`/recruitment/hiring-requests/${id}`)
      this.items = this.items.filter((x) => x.id !== id)
    },
  },
})

// ═══════════════════════════════════════════════════════════════
// Offres d'emploi
// ═══════════════════════════════════════════════════════════════
export const useJobOfferStore = defineStore('recruitment-job-offers', {
  state: () => ({ items: [] as JobOffer[], loading: false, error: null as string | null }),
  getters: {
    published: (state) => state.items.filter((o) => o.status === 'Published'),
  },
  actions: {
    async fetchAll() {
      this.loading = true
      try {
        const { data } = await api.get<Row[]>('/recruitment/job-offers')
        this.items = data.map(mapJobOffer)
        this.error = null
      } catch (e) {
        this.error = getApiErrorMessage(e, 'Chargement des offres impossible')
      } finally {
        this.loading = false
      }
    },
    async create(payload: {
      hiringRequestId?: string; title: string; entityName: string; contractType: string;
      location: string; description: string; evaluationTemplateId?: string;
      excludeFromFeed?: boolean; salaryText?: string
    }) {
      const { data } = await api.post<Row>('/recruitment/job-offers', {
        HiringRequestId: payload.hiringRequestId,
        Title: payload.title,
        EntityName: payload.entityName,
        ContractType: payload.contractType,
        Location: payload.location,
        Description: payload.description,
        InterviewEvaluationTemplateId: payload.evaluationTemplateId,
        ExcludeFromFeed: payload.excludeFromFeed,
        SalaryText: payload.salaryText || undefined,
      })
      upsert(this.items, mapJobOffer(data))
      return mapJobOffer(data)
    },
    async update(id: string, payload: Partial<{
      hiringRequestId: string | null; title: string; entityName: string; contractType: string;
      location: string; description: string; evaluationTemplateId: string | null;
      excludeFromFeed: boolean; salaryText: string
    }>) {
      const { data } = await api.patch<Row>(`/recruitment/job-offers/${id}`, {
        HiringRequestId: payload.hiringRequestId,
        Title: payload.title,
        EntityName: payload.entityName,
        ContractType: payload.contractType,
        Location: payload.location,
        Description: payload.description,
        InterviewEvaluationTemplateId: payload.evaluationTemplateId,
        ExcludeFromFeed: payload.excludeFromFeed,
        SalaryText: payload.salaryText,
      })
      upsert(this.items, mapJobOffer(data))
    },
    // Contenu pret-a-coller pour diffusion manuelle (backlog "Diffusion").
    async fetchShareContent(id: string): Promise<ShareContent> {
      const { data } = await api.get<Row>(`/recruitment/job-offers/${id}/share-content`)
      return {
        plainText: data.plainText ?? '',
        markdown: data.markdown ?? '',
        linkedinPost: data.linkedinPost ?? '',
        twitterShort: data.twitterShort ?? '',
        publicUrl: data.publicUrl ?? '',
      }
    },
    async publish(id: string) {
      const { data } = await api.post<Row>(`/recruitment/job-offers/${id}/publish`)
      upsert(this.items, mapJobOffer(data))
    },
    async close(id: string, recruitmentCost?: number) {
      const { data } = await api.post<Row>(`/recruitment/job-offers/${id}/close`, { RecruitmentCost: recruitmentCost })
      upsert(this.items, mapJobOffer(data))
    },
    async remove(id: string) {
      await api.delete(`/recruitment/job-offers/${id}`)
      this.items = this.items.filter((x) => x.id !== id)
    },
    applicationsCount(id: string): number {
      return this.items.find((o) => o.id === id)?.applicationsCount ?? 0
    },
    // Pieces jointes d'une offre (PDF d'annonce, grille imprimee...).
    async fetchDocuments(id: string): Promise<RecruitmentDocument[]> {
      const { data } = await api.get<Row[]>(`/recruitment/job-offers/${id}/documents`)
      return data.map(mapDocument)
    },
    async uploadDocument(id: string, file: File) {
      const form = new FormData()
      form.append('file', file)
      await api.post(`/recruitment/job-offers/${id}/documents`, form)
    },
    async deleteDocument(id: string, attachmentId: string) {
      await api.delete(`/recruitment/job-offers/${id}/documents/${attachmentId}`)
    },
  },
})

// ═══════════════════════════════════════════════════════════════
// Candidatures
// ═══════════════════════════════════════════════════════════════
export const useApplicationStore = defineStore('recruitment-applications', {
  state: () => ({
    items: [] as Application[],
    myInternal: [] as Application[],
    // Offres publiées visibles depuis l'espace employé (US12) — version
    // allégée servie sans permission recrutement.
    openInternalOffers: [] as { id: string; referenceCode: string; title: string; entityName: string; contractType: string; location: string; description: string }[],
    // Pieces jointes reelles par candidature (backlog "Depot de CV reel").
    documentsByApplication: {} as Record<string, RecruitmentDocument[]>,
    loading: false,
    error: null as string | null,
  }),
  getters: {
    fromOffers: (state) => state.items.filter((a) => a.source === 'Offer' || a.source === 'Internal'),
    spontaneous: (state) => state.items.filter((a) => a.source === 'Spontaneous'),
    internal: (state) => state.items.filter((a) => a.source === 'Internal'),
  },
  actions: {
    async fetchAll() {
      this.loading = true
      try {
        const { data } = await api.get<Row[]>('/recruitment/applications')
        this.items = data.map(mapApplication)
        this.error = null
      } catch (e) {
        this.error = getApiErrorMessage(e, 'Chargement des candidatures impossible')
      } finally {
        this.loading = false
      }
    },
    // Enregistrement d'une candidature cote RH. Si un fichier CV est fourni,
    // envoi en multipart (upload SharePoint cote backend) ; sinon JSON.
    async create(payload: {
      jobOfferId?: string; candidateName: string; candidateEmail: string;
      candidatePhone: string; source: 'Offer' | 'Spontaneous' | 'Internal'
    }, cv?: File) {
      let data: Row
      if (cv) {
        const form = new FormData()
        if (payload.jobOfferId) form.append('JobOfferId', payload.jobOfferId)
        form.append('CandidateName', payload.candidateName)
        form.append('CandidateEmail', payload.candidateEmail)
        form.append('CandidatePhone', payload.candidatePhone)
        form.append('Source', payload.source)
        form.append('cv', cv)
        ;({ data } = await api.post<Row>('/recruitment/applications', form))
      } else {
        ;({ data } = await api.post<Row>('/recruitment/applications', {
          JobOfferId: payload.jobOfferId,
          CandidateName: payload.candidateName,
          CandidateEmail: payload.candidateEmail,
          CandidatePhone: payload.candidatePhone,
          Source: payload.source,
        }))
      }
      upsert(this.items, mapApplication(data))
      return mapApplication(data)
    },
    // ── Pieces jointes reelles (CV + documents annexes) ──
    async fetchDocuments(id: string) {
      const { data } = await api.get<Row[]>(`/recruitment/applications/${id}/documents`)
      this.documentsByApplication[id] = data.map(mapDocument)
      return this.documentsByApplication[id]
    },
    async uploadDocument(id: string, file: File, setPrimaryCv = false) {
      const form = new FormData()
      form.append('file', file)
      if (setPrimaryCv) form.append('setPrimaryCv', 'true')
      await api.post(`/recruitment/applications/${id}/documents`, form)
      await this.fetchDocuments(id)
      const fresh = this.items.find((a) => a.id === id)
      if (fresh) { const { data } = await api.get<Row>(`/recruitment/applications/${id}`); upsert(this.items, mapApplication(data)) }
    },
    async deleteDocument(id: string, attachmentId: string) {
      await api.delete(`/recruitment/applications/${id}/documents/${attachmentId}`)
      await this.fetchDocuments(id)
      const { data } = await api.get<Row>(`/recruitment/applications/${id}`)
      upsert(this.items, mapApplication(data))
    },
    async setStatus(id: string, status: ApplicationStatus) {
      const { data } = await api.patch<Row>(`/recruitment/applications/${id}/status`, { Status: status })
      upsert(this.items, mapApplication(data))
    },
    async addNote(id: string, text: string) {
      const { data } = await api.post<Row>(`/recruitment/applications/${id}/notes`, { Text: text })
      upsert(this.items, mapApplication(data))
    },
    async addToTalentPool(id: string, tags: string[] = [], notes = '') {
      await api.post(`/recruitment/applications/${id}/talent-pool`, { Tags: tags, Notes: notes })
    },
    async remove(id: string) {
      await api.delete(`/recruitment/applications/${id}`)
      this.items = this.items.filter((x) => x.id !== id)
    },
    // ── Cote espace employe (US12) ──
    async fetchMyInternal() {
      const { data } = await api.get<Row[]>('/recruitment/my-applications')
      this.myInternal = data.map(mapApplication)
    },
    async fetchOpenInternalOffers() {
      const { data } = await api.get<Row[]>('/recruitment/my-applications/offers')
      this.openInternalOffers = data.map((o: Row) => ({
        id: o.Id,
        referenceCode: o.ReferenceCode,
        title: o.Title,
        entityName: o.EntityName,
        contractType: o.ContractType,
        location: o.Location,
        description: o.Description,
      }))
    },
    async selfApplyInternal(jobOfferId: string) {
      const { data } = await api.post<Row>('/recruitment/my-applications', { JobOfferId: jobOfferId })
      this.myInternal.unshift(mapApplication(data))
      return mapApplication(data)
    },
    async withdrawInternal(id: string) {
      await api.delete(`/recruitment/my-applications/${id}`)
      const row = this.myInternal.find((a) => a.id === id)
      if (row) row.status = 'Rejected'
    },
  },
})

// ═══════════════════════════════════════════════════════════════
// Entretiens
// ═══════════════════════════════════════════════════════════════
export const useInterviewStore = defineStore('recruitment-interviews', {
  state: () => ({
    items: [] as Interview[],
    evaluationTemplates: [] as InterviewEvaluationTemplate[],
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchAll() {
      this.loading = true
      try {
        const { data } = await api.get<Row[]>('/recruitment/interviews')
        this.items = data.map(mapInterview)
        this.error = null
      } catch (e) {
        this.error = getApiErrorMessage(e, 'Chargement des entretiens impossible')
      } finally {
        this.loading = false
      }
    },
    async fetchTemplates() {
      const { data } = await api.get<Row[]>('/recruitment/evaluation-templates')
      this.evaluationTemplates = data.map(mapEvalTemplate)
    },
    async schedule(payload: {
      applicationId: string; scheduledAt: string; mode: 'InPerson' | 'VideoCall';
      location?: string; meetingLink?: string; durationMinutes?: number;
      participants: InterviewParticipant[]
    }) {
      const { data } = await api.post<Row>('/recruitment/interviews', {
        ApplicationId: payload.applicationId,
        ScheduledAt: payload.scheduledAt,
        Mode: payload.mode,
        Location: payload.location,
        MeetingLink: payload.meetingLink,
        DurationMinutes: payload.durationMinutes,
        Participants: payload.participants.map((p) => ({ EmployeeId: p.employeeId, Name: p.name, Email: p.email })),
      })
      upsert(this.items, mapInterview(data))
      return mapInterview(data)
    },
    async update(id: string, payload: Partial<{
      scheduledAt: string; mode: 'InPerson' | 'VideoCall'; location: string; meetingLink: string;
      durationMinutes: number; participants: InterviewParticipant[]
    }>) {
      const { data } = await api.patch<Row>(`/recruitment/interviews/${id}`, {
        ScheduledAt: payload.scheduledAt,
        Mode: payload.mode,
        Location: payload.location,
        MeetingLink: payload.meetingLink,
        DurationMinutes: payload.durationMinutes,
        Participants: payload.participants?.map((p) => ({ EmployeeId: p.employeeId, Name: p.name, Email: p.email })),
      })
      upsert(this.items, mapInterview(data))
    },
    async markDone(id: string) {
      const { data } = await api.post<Row>(`/recruitment/interviews/${id}/done`)
      upsert(this.items, mapInterview(data))
    },
    async cancel(id: string) {
      const { data } = await api.post<Row>(`/recruitment/interviews/${id}/cancel`)
      upsert(this.items, mapInterview(data))
    },
    async evaluate(id: string, evaluation: {
      score?: number; comment: string; interviewerName?: string;
      templateId?: string; criteriaScores?: { label: string; score: number }[]
    }) {
      const { data } = await api.post<Row>(`/recruitment/interviews/${id}/evaluate`, {
        Score: evaluation.score,
        Comment: evaluation.comment,
        InterviewerName: evaluation.interviewerName,
        TemplateId: evaluation.templateId,
        CriteriaScores: evaluation.criteriaScores?.map((c) => ({ Label: c.label, Score: c.score })),
      })
      upsert(this.items, mapInterview(data))
    },
    // Correction manuelle d'une reponse RSVP (backlog "Suivi des reponses").
    // target : 'candidate' ou l'id d'une ligne participant.
    async setRsvp(id: string, target: 'candidate' | string, response: RsvpResponse) {
      const { data } = await api.post<Row>(`/recruitment/interviews/${id}/rsvp`, {
        Target: target,
        Response: response,
      })
      upsert(this.items, mapInterview(data))
    },
  },
})

// ═══════════════════════════════════════════════════════════════
// Grilles d'evaluation d'entretien (US15)
// ═══════════════════════════════════════════════════════════════
export const useEvalTemplateStore = defineStore('recruitment-eval-templates', {
  state: () => ({ items: [] as InterviewEvaluationTemplate[], loading: false, error: null as string | null }),
  actions: {
    async fetchAll() {
      this.loading = true
      try {
        const { data } = await api.get<Row[]>('/recruitment/evaluation-templates')
        this.items = data.map(mapEvalTemplate)
        this.error = null
      } catch (e) {
        this.error = getApiErrorMessage(e, 'Chargement des grilles impossible')
      } finally {
        this.loading = false
      }
    },
    async create(payload: { name: string; criteria: string[] }) {
      const { data } = await api.post<Row>('/recruitment/evaluation-templates', {
        Name: payload.name,
        Criteria: payload.criteria,
      })
      upsert(this.items, mapEvalTemplate(data))
      return mapEvalTemplate(data)
    },
    async update(id: string, payload: Partial<{ name: string; criteria: string[] }>) {
      const { data } = await api.patch<Row>(`/recruitment/evaluation-templates/${id}`, {
        Name: payload.name,
        Criteria: payload.criteria,
      })
      upsert(this.items, mapEvalTemplate(data))
    },
    async remove(id: string) {
      await api.delete(`/recruitment/evaluation-templates/${id}`)
      this.items = this.items.filter((x) => x.id !== id)
    },
  },
})

// ═══════════════════════════════════════════════════════════════
// Vivier de talents
// ═══════════════════════════════════════════════════════════════
export const useTalentPoolStore = defineStore('recruitment-talent-pool', {
  state: () => ({ items: [] as TalentPoolEntry[], loading: false, error: null as string | null }),
  actions: {
    async fetchAll() {
      this.loading = true
      try {
        const { data } = await api.get<Row[]>('/recruitment/talent-pool')
        this.items = data.map(mapTalentPoolEntry)
        this.error = null
      } catch (e) {
        this.error = getApiErrorMessage(e, 'Chargement du vivier impossible')
      } finally {
        this.loading = false
      }
    },
    async add(payload: {
      candidateName: string; candidateEmail: string; candidatePhone: string;
      tags: string[]; notes: string; sourceApplicationId?: string
    }) {
      const { data } = await api.post<Row>('/recruitment/talent-pool', {
        CandidateName: payload.candidateName,
        CandidateEmail: payload.candidateEmail,
        CandidatePhone: payload.candidatePhone,
        Tags: payload.tags,
        Notes: payload.notes,
        SourceApplicationId: payload.sourceApplicationId,
      })
      upsert(this.items, mapTalentPoolEntry(data))
    },
    async update(id: string, patch: Partial<{
      candidateName: string; candidateEmail: string; candidatePhone: string; tags: string[]; notes: string
    }>) {
      const { data } = await api.patch<Row>(`/recruitment/talent-pool/${id}`, {
        CandidateName: patch.candidateName,
        CandidateEmail: patch.candidateEmail,
        CandidatePhone: patch.candidatePhone,
        Tags: patch.tags,
        Notes: patch.notes,
      })
      upsert(this.items, mapTalentPoolEntry(data))
    },
    async remove(id: string) {
      await api.delete(`/recruitment/talent-pool/${id}`)
      this.items = this.items.filter((x) => x.id !== id)
    },
    async close(id: string) {
      const { data } = await api.post<Row>(`/recruitment/talent-pool/${id}/close`)
      upsert(this.items, mapTalentPoolEntry(data))
    },
    async reopen(id: string) {
      const { data } = await api.post<Row>(`/recruitment/talent-pool/${id}/reopen`)
      upsert(this.items, mapTalentPoolEntry(data))
    },
    async addEvaluation(id: string, evaluation: { score: number; comment: string }) {
      const { data } = await api.post<Row>(`/recruitment/talent-pool/${id}/evaluations`, {
        Score: evaluation.score,
        Comment: evaluation.comment,
      })
      upsert(this.items, mapTalentPoolEntry(data))
    },
    searchByTag(query: string) {
      const q = query.trim().toLowerCase()
      if (!q) return this.items
      return this.items.filter(
        (e) => e.tags.some((t) => t.toLowerCase().includes(q)) || e.candidateName.toLowerCase().includes(q),
      )
    },
  },
})

// ═══════════════════════════════════════════════════════════════
// Propositions d'embauche + modeles de contrat
// ═══════════════════════════════════════════════════════════════
export const useContractStore = defineStore('recruitment-contracts', {
  state: () => ({
    items: [] as Contract[],
    templates: [] as ContractTemplate[],
    eligibleApplications: [] as { id: string; referenceCode: string; candidateName: string; jobOfferTitle?: string }[],
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchAll() {
      this.loading = true
      try {
        const { data } = await api.get<Row[]>('/recruitment/contracts')
        this.items = data.map(mapContract)
        this.error = null
      } catch (e) {
        this.error = getApiErrorMessage(e, 'Chargement des propositions impossible')
      } finally {
        this.loading = false
      }
    },
    async fetchTemplates() {
      const { data } = await api.get<Row[]>('/recruitment/contract-templates')
      this.templates = data.map(mapContractTemplate)
    },
    async fetchEligibleApplications() {
      const { data } = await api.get<Row[]>('/recruitment/contracts/eligible-applications')
      this.eligibleApplications = data.map((r: Row) => ({
        id: r.Id,
        referenceCode: r.ReferenceCode,
        candidateName: r.CandidateName,
        jobOfferTitle: r.JobOfferTitle ?? undefined,
      }))
      return this.eligibleApplications
    },
    async createTemplate(name: string, contractType: string, content: string) {
      const { data } = await api.post<Row>('/recruitment/contract-templates', {
        Name: name, ContractType: contractType, Content: content,
      })
      this.templates.push(mapContractTemplate(data))
    },
    async updateTemplate(id: string, patch: Partial<{ name: string; contractType: string; content: string }>) {
      const { data } = await api.patch<Row>(`/recruitment/contract-templates/${id}`, {
        Name: patch.name, ContractType: patch.contractType, Content: patch.content,
      })
      const i = this.templates.findIndex((t) => t.id === id)
      if (i >= 0) this.templates[i] = mapContractTemplate(data)
    },
    async removeTemplate(id: string) {
      await api.delete(`/recruitment/contract-templates/${id}`)
      this.templates = this.templates.filter((t) => t.id !== id)
    },
    async generate(payload: {
      applicationId: string; templateId?: string; jobTitle: string; entityName: string;
      startDate: string; endDate?: string; salary: number
    }) {
      const { data } = await api.post<Row>('/recruitment/contracts', {
        ApplicationId: payload.applicationId,
        TemplateId: payload.templateId,
        JobTitle: payload.jobTitle,
        EntityName: payload.entityName,
        StartDate: payload.startDate,
        EndDate: payload.endDate,
        Salary: payload.salary,
      })
      upsert(this.items, mapContract(data))
      return mapContract(data)
    },
    async update(id: string, patch: Partial<{
      templateId: string | null; jobTitle: string; entityName: string; startDate: string; endDate: string | null; salary: number
    }>) {
      const { data } = await api.patch<Row>(`/recruitment/contracts/${id}`, {
        TemplateId: patch.templateId,
        JobTitle: patch.jobTitle,
        EntityName: patch.entityName,
        StartDate: patch.startDate,
        EndDate: patch.endDate,
        Salary: patch.salary,
      })
      upsert(this.items, mapContract(data))
    },
    async send(id: string) {
      const { data } = await api.post<Row>(`/recruitment/contracts/${id}/send`)
      upsert(this.items, mapContract(data))
    },
    async negotiate(id: string, round: { fromParty: 'HR' | 'Candidate'; amount?: number; comment: string }) {
      const { data } = await api.post<Row>(`/recruitment/contracts/${id}/negotiate`, {
        FromParty: round.fromParty, Amount: round.amount, Comment: round.comment,
      })
      upsert(this.items, mapContract(data))
    },
    async accept(id: string, opts: { withTrial?: boolean } = {}) {
      const { data } = await api.post<Row>(`/recruitment/contracts/${id}/accept`, { WithTrial: !!opts.withTrial })
      upsert(this.items, mapContract(data))
    },
    async refuse(id: string, reason: string) {
      const { data } = await api.post<Row>(`/recruitment/contracts/${id}/refuse`, { RejectionReason: reason })
      upsert(this.items, mapContract(data))
    },
    async cancel(id: string) {
      const { data } = await api.post<Row>(`/recruitment/contracts/${id}/cancel`)
      upsert(this.items, mapContract(data))
    },
    // Conversion en vrai compte Employe (backlog "Inclusion d'un Potentiel").
    // Le corps porte les champs Employe non deduits du recrutement (etat
    // civil, piece d'identite, entite reelle...). Voir ConvertToEmployeeModal.
    async convertToEmployee(id: string, payload: Record<string, unknown>) {
      const { data } = await api.post<Row>(`/recruitment/contracts/${id}/convert-to-employee`, payload)
      upsert(this.items, mapContract(data))
      return mapContract(data)
    },
  },
})

// ═══════════════════════════════════════════════════════════════
// Periodes d'essai
// ═══════════════════════════════════════════════════════════════
export const useTrialStore = defineStore('recruitment-trial', {
  state: () => ({ items: [] as TrialEmployee[], loading: false, error: null as string | null }),
  actions: {
    async fetchAll() {
      this.loading = true
      try {
        const { data } = await api.get<Row[]>('/recruitment/trial-employees')
        this.items = data.map(mapTrialEmployee)
        this.error = null
      } catch (e) {
        this.error = getApiErrorMessage(e, 'Chargement des periodes d\'essai impossible')
      } finally {
        this.loading = false
      }
    },
    async evaluate(id: string, evaluation: { score: number; comment: string }) {
      const { data } = await api.post<Row>(`/recruitment/trial-employees/${id}/evaluate`, {
        Score: evaluation.score, Comment: evaluation.comment,
      })
      upsert(this.items, mapTrialEmployee(data))
    },
    async extend(id: string, newEndDate: string) {
      const { data } = await api.post<Row>(`/recruitment/trial-employees/${id}/extend`, { NewEndDate: newEndDate })
      upsert(this.items, mapTrialEmployee(data))
    },
    // Confirmation de la periode d'essai. Corps vide si un compte Employe est
    // deja rattache (simple passage OnTrial -> Active) ; sinon la modale de
    // conversion fournit les champs Employe (backlog "Conversion candidat").
    async convert(id: string, payload: Record<string, unknown> = {}) {
      const { data } = await api.post<Row>(`/recruitment/trial-employees/${id}/convert`, payload)
      upsert(this.items, mapTrialEmployee(data))
    },
    async cancel(id: string) {
      const { data } = await api.post<Row>(`/recruitment/trial-employees/${id}/cancel`)
      upsert(this.items, mapTrialEmployee(data))
    },
  },
})

// ═══════════════════════════════════════════════════════════════
// Portail carriere public (sans connexion)
// ═══════════════════════════════════════════════════════════════
function mapPublicOffer(o: Row): PublicJobOffer {
  return {
    token: o.token,
    title: o.title,
    entityName: o.entityName,
    contractType: o.contractType,
    location: o.location,
    description: o.description,
    salaryText: o.salaryText ?? undefined,
    publishedAt: o.publishedAt ? day(o.publishedAt) : undefined,
    views: num(o.views),
  }
}

interface PublicApplyPayload {
  candidateName: string
  candidateEmail: string
  candidatePhone: string
  cvFile: File
  // Pot-de-miel (invisible) + jeton anti-robot Turnstile — remplis par la vue.
  honeypot?: { website?: string; fax?: string }
  captchaToken?: string
}

export const usePublicCareersStore = defineStore('recruitment-public-careers', {
  state: () => ({
    offers: [] as PublicJobOffer[],
    // Jeton de formulaire anti-spam (usage unique, re-recupere apres chaque envoi).
    formToken: null as string | null,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchPublished() {
      this.loading = true
      try {
        const { data } = await api.get<Row[]>('/public/careers')
        this.offers = data.map(mapPublicOffer)
        this.error = null
      } catch (e) {
        this.error = getApiErrorMessage(e, 'Chargement des offres impossible')
      } finally {
        this.loading = false
      }
    },
    async fetchByToken(token: string): Promise<PublicJobOffer> {
      const { data } = await api.get<Row>(`/public/careers/${token}`)
      // La page d'une offre embarque un jeton de formulaire (evite un aller-retour).
      if (data.formToken) this.formToken = data.formToken as string
      return mapPublicOffer(data)
    },
    // Recupere un jeton de formulaire si on n'en a pas (page spontanee).
    async ensureFormToken() {
      if (this.formToken) return
      try {
        const { data } = await api.get<Row>('/public/careers/form-token')
        this.formToken = (data.formToken ?? null) as string | null
      } catch {
        this.formToken = null
      }
    },
    _buildForm(p: PublicApplyPayload): FormData {
      const form = new FormData()
      form.append('CandidateName', p.candidateName)
      form.append('CandidateEmail', p.candidateEmail)
      form.append('CandidatePhone', p.candidatePhone)
      form.append('cv', p.cvFile)
      form.append('Website', p.honeypot?.website ?? '')
      form.append('Fax', p.honeypot?.fax ?? '')
      if (this.formToken) form.append('FormToken', this.formToken)
      if (p.captchaToken) form.append('CaptchaToken', p.captchaToken)
      return form
    },
    async apply(token: string, p: PublicApplyPayload) {
      try {
        const { data } = await api.post(`/public/careers/${token}/apply`, this._buildForm(p))
        return data as { ok: boolean; referenceCode: string }
      } finally {
        this.formToken = null // usage unique
      }
    },
    async applySpontaneous(p: PublicApplyPayload) {
      try {
        const { data } = await api.post('/public/careers/spontaneous', this._buildForm(p))
        return data as { ok: boolean; referenceCode: string }
      } finally {
        this.formToken = null
      }
    },
  },
})

// ═══════════════════════════════════════════════════════════════
// Diffusion multi-plateformes des offres (backlog)
// ═══════════════════════════════════════════════════════════════
export const useDistributionStore = defineStore('recruitment-distribution', {
  state: () => ({
    channels: [] as DistributionChannel[],
    byOffer: {} as Record<string, JobOfferDistribution[]>,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchChannels() {
      this.loading = true
      try {
        const { data } = await api.get<Row[]>('/recruitment/distribution-channels')
        this.channels = data.map(mapDistributionChannel)
        this.error = null
      } catch (e) {
        this.error = getApiErrorMessage(e, 'Chargement des canaux impossible')
      } finally {
        this.loading = false
      }
    },
    async createChannel(payload: { name: string; kind: string; targetUrl?: string; targetEmail?: string; secret?: string; isActive?: boolean }) {
      const { data } = await api.post<Row>('/recruitment/distribution-channels', {
        Name: payload.name, Kind: payload.kind, TargetUrl: payload.targetUrl || undefined,
        TargetEmail: payload.targetEmail || undefined, Secret: payload.secret || undefined,
        IsActive: payload.isActive,
      })
      upsertBy(this.channels, mapDistributionChannel(data))
    },
    async updateChannel(id: string, patch: Record<string, unknown>) {
      const body: Row = {}
      if (patch.name !== undefined) body.Name = patch.name
      if (patch.kind !== undefined) body.Kind = patch.kind
      if (patch.targetUrl !== undefined) body.TargetUrl = patch.targetUrl
      if (patch.targetEmail !== undefined) body.TargetEmail = patch.targetEmail
      if (patch.secret !== undefined) body.Secret = patch.secret
      if (patch.isActive !== undefined) body.IsActive = patch.isActive
      const { data } = await api.patch<Row>(`/recruitment/distribution-channels/${id}`, body)
      upsertBy(this.channels, mapDistributionChannel(data))
    },
    async removeChannel(id: string) {
      await api.delete(`/recruitment/distribution-channels/${id}`)
      this.channels = this.channels.filter((c) => c.id !== id)
    },
    async testChannel(id: string) {
      const { data } = await api.post(`/recruitment/distribution-channels/${id}/test`)
      return data as { ok: boolean; httpStatus?: number; snippet?: string }
    },
    async fetchForOffer(offerId: string) {
      const { data } = await api.get<Row[]>(`/recruitment/job-offers/${offerId}/distributions`)
      this.byOffer[offerId] = data.map(mapJobOfferDistribution)
      return this.byOffer[offerId]
    },
    async retryDistribution(offerId: string, distId: string) {
      await api.post(`/recruitment/job-offers/${offerId}/distributions/${distId}/retry`)
      await this.fetchForOffer(offerId)
    },
    async markPosted(offerId: string, distId: string, externalUrl: string) {
      await api.patch(`/recruitment/job-offers/${offerId}/distributions/${distId}`, {
        ExternalUrl: externalUrl, Status: 'Posted',
      })
      await this.fetchForOffer(offerId)
    },
  },
})

function upsertBy<T extends { id: string }>(list: T[], row: T) {
  const i = list.findIndex((x) => x.id === row.id)
  if (i >= 0) list[i] = row
  else list.push(row)
}
