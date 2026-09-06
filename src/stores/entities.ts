import { defineStore } from 'pinia'
import { api, getApiErrorMessage } from '../lib/api'
import { withToast } from '../lib/withToast'
import { useEmployeeStore } from './employees'
import type { Entity, EntityType, EntityStatus } from '../types'

// ── Backend <-> frontend mapping ────────────────────────────────
// The API returns OrganizationUnit rows in PascalCase (Prisma model field
// names). Only the fields below are real backend columns; headcount and
// responsibleName have no backend counterpart (see types/index.ts) and are
// enriched/defaulted here. Pools de validation vivent dans leur propre store
// (stores/approvalPools.ts), pas sur Entity.
interface BackendOrganizationUnit {
  Id: string
  Code: string
  Name: string
  Type: EntityType
  LegalIdentifier: string | null
  ParentId: string | null
  ManagerId: string | null
  Address: string | null
  Phone: string | null
  Email: string | null
  Status: EntityStatus
  CreatedBy: string
  CreatedAt: string
  ModifiedBy: string | null
  ModifiedAt: string | null
  children?: BackendOrganizationUnit[]
}

function mapEntity(raw: BackendOrganizationUnit): Entity {
  const employees = useEmployeeStore().getByEntityId(raw.Id)
  const manager = raw.ManagerId ? useEmployeeStore().getById(raw.ManagerId) : undefined

  return {
    id:         raw.Id,
    code:       raw.Code,
    name:       raw.Name,
    type:       raw.Type,
    parentId:   raw.ParentId,
    managerId:  raw.ManagerId,
    address:    raw.Address ?? undefined,
    phone:      raw.Phone ?? undefined,
    email:      raw.Email ?? undefined,
    status:     raw.Status,
    createdBy:  raw.CreatedBy,
    createdAt:  raw.CreatedAt,
    modifiedBy: raw.ModifiedBy,
    modifiedAt: raw.ModifiedAt,
    legalIdentifier: raw.LegalIdentifier ?? undefined,
    responsibleName: manager?.name,
    headcount:       employees.length,
    children: raw.children ? raw.children.map(mapEntity) : undefined,
  }
}

// Only these fields are accepted by the backend create/update DTOs — every
// other Entity property (headcount, responsibleName, validatorPools,
// children...) is UI-only and must never be sent, otherwise the API's
// forbidNonWhitelisted validation rejects the whole request.
function toBackendPayload(payload: Partial<Entity>) {
  const body: Record<string, unknown> = {}
  if (payload.code !== undefined) body.Code = payload.code
  if (payload.name !== undefined) body.Name = payload.name
  if (payload.type !== undefined) body.Type = payload.type
  if (payload.legalIdentifier !== undefined) body.LegalIdentifier = payload.legalIdentifier
  if (payload.parentId !== undefined) body.ParentId = payload.parentId
  if (payload.managerId !== undefined) body.ManagerId = payload.managerId
  if (payload.address !== undefined) body.Address = payload.address
  if (payload.phone !== undefined) body.Phone = payload.phone
  if (payload.email !== undefined) body.Email = payload.email
  if (payload.status !== undefined) body.Status = payload.status
  return body
}

export const useEntityStore = defineStore('entities', {
  state: () => ({
    entities: [] as Entity[],
    loading:  false,
    error:    null as string | null,
  }),

  getters: {
    rootEntities:     (state): Entity[] => state.entities.filter(e => e.parentId === null),

    // Racine unique de l'organigramme : toujours la Direction Générale
    // (Code 'DG', voir prisma/seed.ts) — jamais une entité orpheline, même
    // si elle a aussi parentId === null. Fallback sur rootEntities[0] si le
    // seed 'DG' est absent (ne devrait pas arriver en usage normal).
    directionGenerale(): Entity | undefined {
      return (this.entities as Entity[]).find(e => e.code === 'DG') ?? (this.rootEntities as Entity[])[0]
    },

    getChildren:      (state) => (parentId: string): Entity[] =>
                        state.entities.filter(e => e.parentId === parentId),
    getEntityById:    (state) => (id: string): Entity | undefined =>
                        state.entities.find(e => e.id === id),
    pendingEntities:  (state): Entity[] => state.entities.filter(e => e.status === 'PendingApproval'),
    approvedEntities: (state): Entity[] => state.entities.filter(e => e.status === 'Active'),
    totalHeadcount:   (state): number   => state.entities.reduce((s, e) => s + e.headcount, 0),

    // Client-side tree built from the already-loaded flat list — reactive,
    // no extra request. Use the fetchTree() action instead when you need
    // the freshest hierarchy without relying on `entities` being populated.
    buildTree(): Entity[] {
      const buildNode = (entity: Entity): Entity => {
        const children = (this.entities as Entity[])
          .filter(e => e.parentId === entity.id)
          .map(child => buildNode(child))
        return { ...entity, children: children.length > 0 ? children : undefined }
      }
      const root = this.directionGenerale as Entity | undefined
      return root ? [buildNode(root)] : []
    },

    // Sous-ensemble (Direction Générale + tous ses descendants) à donner tel
    // quel à Vue3OrgChart, qui pioche sa propre racine via un .find() sur le
    // premier parentId falsy des données reçues — sans ce filtre, une entité
    // orpheline présente dans `entities` pourrait être choisie à la place de
    // la Direction Générale.
    orgChartEntities(): Entity[] {
      const root = this.directionGenerale as Entity | undefined
      if (!root) return []
      const result: Entity[] = [root]
      const collect = (parentId: string) => {
        for (const e of this.entities as Entity[]) {
          if (e.parentId === parentId) { result.push(e); collect(e.id) }
        }
      }
      collect(root.id)
      return result
    },
  },

  actions: {
    async fetchAll() {
      this.loading = true
      this.error = null
      try {
        // mapEntity lit useEmployeeStore() de façon synchrone (headcount,
        // responsableName) — s'assurer qu'elle est chargée avant, sinon ces
        // deux champs restent à 0/vide pour toute la durée de vie de cette
        // liste (pas de lien réactif entre les deux stores après coup).
        const empStore = useEmployeeStore()
        if (empStore.employees.length === 0) await empStore.fetchAll()
        const { data } = await api.get<BackendOrganizationUnit[]>('/organization-units')
        this.entities = data.map(mapEntity)
      } catch (err) {
        this.error = getApiErrorMessage(err, "Impossible de charger les unités organisationnelles")
        throw err
      } finally {
        this.loading = false
      }
    },

    async fetchTree(): Promise<Entity[]> {
      this.loading = true
      this.error = null
      try {
        const empStore = useEmployeeStore()
        if (empStore.employees.length === 0) await empStore.fetchAll()
        const { data } = await api.get<BackendOrganizationUnit[]>('/organization-units/tree')
        return data.map(mapEntity)
      } catch (err) {
        this.error = getApiErrorMessage(err, "Impossible de charger l'arborescence")
        throw err
      } finally {
        this.loading = false
      }
    },

    async createEntity(payload: Omit<Entity, 'id' | 'status' | 'createdBy' | 'createdAt' | 'headcount' | 'validatorPools'> & { status?: EntityStatus }) {
      this.error = null
      return withToast("Création de l'unité en cours…", async () => {
        try {
          const body = toBackendPayload({ ...payload, status: payload.status ?? 'Draft' })
          const { data } = await api.post<BackendOrganizationUnit>('/organization-units', body)
          const entity = mapEntity(data)
          this.entities.push(entity)
          return entity
        } catch (err) {
          this.error = getApiErrorMessage(err, "Impossible de créer l'unité organisationnelle")
          throw err
        }
      }, () => this.error ?? "Impossible de créer l'unité organisationnelle")
    },

    async updateEntity(id: string, payload: Partial<Entity>) {
      this.error = null
      return withToast('Enregistrement en cours…', async () => {
        try {
          const body = toBackendPayload(payload)
          const { data } = await api.patch<BackendOrganizationUnit>(`/organization-units/${id}`, body)
          const entity = mapEntity(data)
          const idx = this.entities.findIndex(e => e.id === id)
          if (idx !== -1) this.entities[idx] = entity
          return entity
        } catch (err) {
          this.error = getApiErrorMessage(err, "Impossible de mettre à jour l'unité organisationnelle")
          throw err
        }
      }, () => this.error ?? "Impossible de mettre à jour l'unité organisationnelle")
    },

    async submitEntity(id: string) {
      this.error = null
      return withToast('Soumission en cours…', async () => {
        try {
          const { data } = await api.post<BackendOrganizationUnit>(`/organization-units/${id}/submit`)
          const idx = this.entities.findIndex(e => e.id === id)
          if (idx !== -1) this.entities[idx] = mapEntity(data)
        } catch (err) {
          this.error = getApiErrorMessage(err, 'Impossible de soumettre cette unité pour approbation')
          throw err
        }
      }, () => this.error ?? 'Impossible de soumettre cette unité pour approbation')
    },

    async approveEntity(id: string) {
      this.error = null
      return withToast('Approbation en cours…', async () => {
        try {
          const { data } = await api.post<BackendOrganizationUnit>(`/organization-units/${id}/approve`)
          const idx = this.entities.findIndex(e => e.id === id)
          if (idx !== -1) this.entities[idx] = mapEntity(data)
        } catch (err) {
          this.error = getApiErrorMessage(err, "Impossible d'approuver cette unité")
          throw err
        }
      }, () => this.error ?? "Impossible d'approuver cette unité")
    },

    async rejectEntity(id: string) {
      this.error = null
      return withToast('Rejet en cours…', async () => {
        try {
          const { data } = await api.post<BackendOrganizationUnit>(`/organization-units/${id}/reject`)
          const idx = this.entities.findIndex(e => e.id === id)
          if (idx !== -1) this.entities[idx] = mapEntity(data)
        } catch (err) {
          this.error = getApiErrorMessage(err, 'Impossible de rejeter cette unité')
          throw err
        }
      }, () => this.error ?? 'Impossible de rejeter cette unité')
    },

    async deactivateEntity(id: string) {
      await this.updateEntity(id, { status: 'Inactive' })
    },

    async reactivateEntity(id: string) {
      await this.updateEntity(id, { status: 'Active' })
    },

    // DELETE /organization-units/:id/permanent (Lot I) — suppression
    // définitive, distincte de deactivateEntity ci-dessus (Status=Inactive,
    // réversible depuis l'app). Retirée du tableau local : contrairement à
    // la désactivation, une entité supprimée ne doit plus jamais réapparaître
    // dans l'app — seul un dev peut la restaurer en base.
    async deleteEntityPermanently(id: string) {
      this.error = null
      return withToast('Suppression en cours…', async () => {
        try {
          await api.delete(`/organization-units/${id}/permanent`)
          this.entities = this.entities.filter(e => e.id !== id)
        } catch (err) {
          this.error = getApiErrorMessage(err, "Impossible de supprimer cette unité")
          throw err
        }
      }, () => this.error ?? "Impossible de supprimer cette unité")
    },
  },
})
