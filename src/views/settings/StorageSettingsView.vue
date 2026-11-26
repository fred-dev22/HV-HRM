<script setup lang="ts">
/**
 * Paramètres > Stockage : où l'application garde les fichiers (justificatifs,
 * pièces jointes). Deux modes : un dossier du serveur (le choix par défaut) ou
 * SharePoint via Microsoft Graph. Réservé au compte administrateur de lancement
 * (le serveur le vérifie aussi). Les identifiants SharePoint sont chiffrés côté
 * serveur et jamais réaffichés : un champ enregistré se remplace via « Modifier »,
 * sinon il est conservé. Changer de mode n'efface rien : les fichiers déjà
 * déposés restent lisibles là où ils sont.
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Cloud, FolderOpen, HardDrive, Save, CircleCheck, TriangleAlert, ShieldCheck, Check, RotateCcw, PlugZap } from 'lucide-vue-next'
import { SkeletonLoader } from '../../components'
import SecretField from '../../components/ui/form-field/SecretField.vue'
import ServerFolderPicker from '../../components/settings/ServerFolderPicker.vue'
import * as cls from '../../lib/formClasses'
import { confirmDialog } from '../../lib/confirm'
import { useAuthStore } from '../../stores/auth'
import { useStorageSettingsStore, type StorageProvider } from '../../stores/storageSettings'

const store = useStorageSettingsStore()
const auth = useAuthStore()
const router = useRouter()

const loading = ref(true)
const saving = ref(false)
const saveError = ref('')
const saved = ref(false)

const form = reactive({
  provider: 'Local' as StorageProvider,
  localPath: '',
  graphTenantId: '',
  graphClientId: '',
  graphClientSecret: '',
  graphSiteHost: '',
  graphSitePath: '',
  graphUploadPath: 'Shared Documents',
})
const errors = reactive<Record<string, string>>({})
// Change apres chaque enregistrement : remet les champs secrets en mode "enregistre".
const saveCount = ref(0)

const settings = computed(() => store.settings)

// Le dossier se choisit dans un explorateur du serveur : aucun chemin n'est propose d'avance.
const pickerOpen = ref(false)
function onPickFolder(p: string) {
  form.localPath = p
  errors.localPath = ''
  pickerOpen.value = false
}

const PROVIDERS: { value: StorageProvider; title: string; text: string; icon: typeof Cloud; badge?: string }[] = [
  { value: 'Local', title: 'Dossier du serveur', text: 'Les fichiers sont enregistrés dans un dossier de la machine qui héberge l\'application.', icon: HardDrive, badge: 'Par défaut' },
  { value: 'Graph', title: 'SharePoint (Microsoft Graph)', text: 'Bibliothèque de documents SharePoint de votre organisation Microsoft 365.', icon: Cloud },
]

onMounted(async () => {
  // Le serveur refuse de toute façon un autre compte ; on évite juste d'afficher une page vide.
  await store.fetchStatus()
  if (store.canConfigure === false) {
    router.replace(auth.isHRSpace ? '/hr' : '/employee')
    return
  }
  try {
    await store.fetchSettings()
    const s = store.settings
    if (s) {
      if (s.provider) form.provider = s.provider
      form.localPath = s.localPath
      form.graphSiteHost = s.graph.siteHost
      form.graphSitePath = s.graph.sitePath
      form.graphUploadPath = s.graph.uploadPath || 'Shared Documents'
    }
  } catch {
    // le message d'erreur du store est affiché dans la page
  } finally {
    loading.value = false
  }
})

function validate(): boolean {
  for (const k of Object.keys(errors)) delete errors[k]
  if (form.provider === 'Local') {
    const p = form.localPath.trim()
    if (!p) errors.localPath = 'Choisissez un dossier'
  } else {
    if (!form.graphTenantId.trim() && !settings.value?.graph.hasTenantId) errors.graphTenantId = 'Obligatoire'
    if (!form.graphClientId.trim() && !settings.value?.graph.hasClientId) errors.graphClientId = 'Obligatoire'
    if (!form.graphClientSecret.trim() && !settings.value?.graph.hasSecret) errors.graphClientSecret = 'Obligatoire'
    if (!form.graphSiteHost.trim()) errors.graphSiteHost = 'Obligatoire'
    if (!form.graphSitePath.trim()) errors.graphSitePath = 'Obligatoire'
  }
  return Object.keys(errors).length === 0
}

async function save() {
  saved.value = false
  saveError.value = ''
  testResult.value = null
  if (!validate()) return
  saving.value = true
  try {
    await store.save(
      form.provider === 'Local'
        ? { provider: 'Local', localPath: form.localPath.trim() }
        : {
            provider: 'Graph',
            graphTenantId: form.graphTenantId.trim() || undefined,
            graphClientId: form.graphClientId.trim() || undefined,
            graphClientSecret: form.graphClientSecret.trim() || undefined,
            graphSiteHost: form.graphSiteHost.trim(),
            graphSitePath: form.graphSitePath.trim(),
            graphUploadPath: form.graphUploadPath.trim() || undefined,
          },
    )
    // Rien de saisi ne reste en mémoire après l'enregistrement.
    form.graphTenantId = ''
    form.graphClientId = ''
    form.graphClientSecret = ''
    const s = store.settings
    if (s) {
      if (s.provider === 'Local') form.localPath = s.localPath
      form.graphSiteHost = s.graph.siteHost || form.graphSiteHost
      form.graphSitePath = s.graph.siteHost ? s.graph.sitePath : form.graphSitePath
      form.graphUploadPath = s.graph.uploadPath || form.graphUploadPath
    }
    saveCount.value++
    saved.value = true
  } catch {
    saveError.value = store.error ?? "Impossible d'enregistrer la configuration"
  } finally {
    saving.value = false
  }
}

/* ── Reinitialisation ──────────────────────────────────────────── */
const resetting = ref(false)

async function resetConfig() {
  const ok = await confirmDialog(
    "Réinitialiser la configuration du stockage ? Les réglages enregistrés (dossier et identifiants SharePoint) seront supprimés et plus aucun fichier ne pourra être envoyé tant qu'une nouvelle configuration n'est pas enregistrée. Les fichiers déjà déposés ne sont pas supprimés.",
    { danger: true },
  )
  if (!ok) return
  resetting.value = true
  saved.value = false
  saveError.value = ''
  testResult.value = null
  try {
    await store.reset()
    for (const k of Object.keys(errors)) delete errors[k]
    form.localPath = ''
    form.graphTenantId = ''
    form.graphClientId = ''
    form.graphClientSecret = ''
    form.graphSiteHost = ''
    form.graphSitePath = ''
    form.graphUploadPath = 'Shared Documents'
    saveCount.value++
  } catch {
    saveError.value = store.error ?? 'Impossible de réinitialiser la configuration'
  } finally {
    resetting.value = false
  }
}

/* ── Test ──────────────────────────────────────────────────────── */
const testing = ref(false)
const testResult = ref<{ ok: boolean; error: string | null } | null>(null)

// Le test porte sur la configuration ENREGISTRÉE : il n'est proposé que si
// l'écran montre exactement celle-là. Renvoie la raison du blocage, ou ''.
const providerLabel = (p: StorageProvider | null | undefined) => (p === 'Graph' ? 'SharePoint' : 'Dossier du serveur')
const testBlocker = computed(() => {
  const s = settings.value
  if (!s?.configured) return "Enregistrez d'abord une configuration pour pouvoir la tester."
  if (form.provider !== s.provider) {
    return `Le mode « ${providerLabel(form.provider)} » n'est pas enregistré (mode actif : « ${providerLabel(s.provider)} »). Enregistrez-le avant de le tester.`
  }
  const changed =
    form.provider === 'Local'
      ? form.localPath.trim() !== s.localPath
      : !!(form.graphTenantId.trim() || form.graphClientId.trim() || form.graphClientSecret.trim()) ||
        form.graphSiteHost.trim() !== s.graph.siteHost ||
        form.graphSitePath.trim() !== s.graph.sitePath ||
        form.graphUploadPath.trim() !== s.graph.uploadPath
  return changed ? 'Des modifications ne sont pas enregistrées : enregistrez-les avant de tester.' : ''
})

// Un résultat de test ne vaut que pour ce qui était affiché au moment du test.
watch(() => JSON.stringify(form), () => { testResult.value = null })

watch(() => form.provider, () => {
  saved.value = false
  saveError.value = ''
  for (const k of Object.keys(errors)) delete errors[k]
  // Un champ déjà enregistré revient à « Enregistré » : on oublie la saisie
  // abandonnée, sinon elle serait enregistrée sans être visible.
  const s = settings.value
  if (s?.graph.hasTenantId) form.graphTenantId = ''
  if (s?.graph.hasClientId) form.graphClientId = ''
  if (s?.graph.hasSecret) form.graphClientSecret = ''
})

async function runTest() {
  if (testing.value || testBlocker.value) return
  testResult.value = null
  testing.value = true
  try {
    const tested = JSON.stringify(form)
    const result = await store.test()
    if (JSON.stringify(form) === tested) testResult.value = result
  } finally {
    testing.value = false
  }
}

const activeLabel = computed(() => (settings.value?.provider === 'Graph' ? 'SharePoint (Microsoft Graph)' : 'Dossier du serveur'))
const activeDetail = computed(() =>
  settings.value?.provider === 'Graph'
    ? `Site : ${settings.value.graph.siteHost}${settings.value.graph.sitePath}`
    : `Dossier : ${settings.value?.localPath ?? ''}`,
)

const card = 'bg-card border border-border rounded-xl'
const cardTitle = 'text-[15px] font-semibold text-foreground'
const cardHint = 'text-[12px] text-muted-foreground mt-0.5'
</script>

<template>
  <div class="px-8 py-8 max-md:px-4 flex flex-col gap-6 max-w-[900px]">
    <!-- En-tête -->
    <div class="flex items-start gap-4">
      <div class="w-11 h-11 rounded-xl bg-tint text-primary flex items-center justify-center shrink-0">
        <FolderOpen class="w-5 h-5" />
      </div>
      <div>
        <h1 class="text-xl font-bold text-foreground leading-tight">Stockage des fichiers</h1>
        <p class="text-[13px] text-muted-foreground mt-1">
          Choisissez où l'application garde les justificatifs et les pièces jointes. Un seul mode reçoit les nouveaux fichiers ; les fichiers déjà déposés restent lisibles si vous changez de mode.
        </p>
      </div>
    </div>

    <SkeletonLoader v-if="loading" type="table" :lines="8" />
    <div v-else-if="!settings" :class="cls.fieldErrorBlock">{{ store.error ?? 'Configuration indisponible' }}</div>

    <template v-else>
      <!-- État -->
      <div
        :class="[
          'flex items-center gap-3 rounded-xl px-4 py-3 border',
          settings.configured ? 'bg-success-bg border-success/30 text-success' : 'bg-warning-bg border-warning/30 text-warning',
        ]"
      >
        <CircleCheck v-if="settings.configured" class="w-5 h-5 shrink-0" />
        <TriangleAlert v-else class="w-5 h-5 shrink-0" />
        <div class="min-w-0">
          <div class="text-[13px] font-semibold">
            {{ settings.configured ? `Stockage actif : ${activeLabel}` : 'Stockage non configuré' }}
          </div>
          <div class="text-[12px] opacity-90 break-all">
            {{ settings.configured ? activeDetail : "Aucun fichier ne peut être envoyé tant qu'un stockage n'est pas enregistré. Tous les utilisateurs en sont avertis par une bande en haut de l'écran." }}
          </div>
        </div>
      </div>

      <!-- Mode -->
      <section :class="[card, 'p-6']">
        <h2 :class="cardTitle">Où enregistrer les fichiers</h2>
        <p :class="cardHint">Le dossier du serveur est le choix le plus simple. SharePoint convient si votre organisation utilise Microsoft 365.</p>
        <div class="grid grid-cols-2 max-sm:grid-cols-1 gap-3 mt-4" role="radiogroup" aria-label="Mode de stockage">
          <button
            v-for="p in PROVIDERS"
            :key="p.value"
            type="button"
            role="radio"
            :aria-checked="form.provider === p.value"
            :class="[
              'relative text-left flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-colors',
              form.provider === p.value ? 'border-primary bg-tint' : 'border-border bg-card hover:border-primary/40',
            ]"
            @click="form.provider = p.value"
          >
            <component :is="p.icon" :class="['w-5 h-5 mt-0.5 shrink-0', form.provider === p.value ? 'text-primary' : 'text-muted-foreground']" />
            <span class="min-w-0 pr-6">
              <span class="block text-[14px] font-semibold text-foreground">
                {{ p.title }}
                <span v-if="p.badge" class="ml-1.5 align-middle text-[10px] font-medium uppercase tracking-wide text-primary bg-tint border border-primary/20 rounded px-1.5 py-0.5">{{ p.badge }}</span>
              </span>
              <span class="block text-[12px] text-muted-foreground mt-0.5">{{ p.text }}</span>
            </span>
            <span v-if="form.provider === p.value" class="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <Check class="w-3 h-3" />
            </span>
          </button>
        </div>
      </section>

      <!-- Réglages du mode -->
      <section :class="[card, 'p-6 flex flex-col gap-6']">
        <div :key="saveCount">
          <template v-if="form.provider === 'Local'">
            <h2 :class="cardTitle">Dossier du serveur</h2>
            <div :class="[cls.field, 'mt-3']">
              <label :class="cls.fieldLabel">Chemin complet du dossier *</label>
              <div class="flex items-center gap-2">
                <input
                  :value="form.localPath"
                  readonly
                  :class="[cls.fieldInput, 'cursor-pointer', errors.localPath && cls.inputError]"
                  placeholder="Cliquez pour choisir un dossier"
                  @click="pickerOpen = true"
                />
                <button type="button" :class="[cls.btnOutline, 'shrink-0']" @click="pickerOpen = true">
                  <FolderOpen class="w-4 h-4" /> Parcourir
                </button>
              </div>
              <div v-if="errors.localPath" :class="cls.fieldError">{{ errors.localPath }}</div>
              <ServerFolderPicker :open="pickerOpen" :start="form.localPath" @close="pickerOpen = false" @select="onPickFolder" />
            </div>
            <ul class="mt-4 flex flex-col gap-1.5 text-[12px] text-muted-foreground list-disc pl-5">
              <li>Le dossier est créé s'il n'existe pas ; l'application vérifie qu'elle peut y écrire avant d'enregistrer.</li>
              <li>Choisissez un dossier <strong class="text-foreground">en dehors du dossier de l'application</strong> : une mise à jour du serveur ne doit pas l'effacer.</li>
              <li>Le compte qui exécute l'application doit avoir le droit d'y lire et d'y écrire.</li>
              <li>Ajoutez ce dossier aux <strong class="text-foreground">sauvegardes</strong> du serveur : les justificatifs n'existent nulle part ailleurs.</li>
            </ul>
          </template>

          <template v-else>
            <h2 :class="cardTitle">Identifiants Microsoft Graph</h2>
            <p :class="cardHint">Application Azure AD avec la permission applicative Sites.ReadWrite.All.</p>
            <div class="flex flex-col gap-4 mt-3">
              <SecretField
                v-model="form.graphTenantId" label="Identifiant du tenant *"
                :saved="settings.graph.hasTenantId" :hint="settings.graph.tenantIdHint" :error="errors.graphTenantId"
              />
              <SecretField
                v-model="form.graphClientId" label="Identifiant du client (application) *"
                :saved="settings.graph.hasClientId" :hint="settings.graph.clientIdHint" :error="errors.graphClientId"
              />
              <SecretField
                v-model="form.graphClientSecret" label="Secret du client *" secret
                :saved="settings.graph.hasSecret" :error="errors.graphClientSecret"
              />
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Hôte SharePoint *</label>
                <input v-model="form.graphSiteHost" :class="[cls.fieldInput, errors.graphSiteHost && cls.inputError]" placeholder="contoso.sharepoint.com" autocomplete="off" />
                <div v-if="errors.graphSiteHost" :class="cls.fieldError">{{ errors.graphSiteHost }}</div>
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Chemin du site *</label>
                <input v-model="form.graphSitePath" :class="[cls.fieldInput, errors.graphSitePath && cls.inputError]" placeholder="/sites/RH" autocomplete="off" />
                <div v-if="errors.graphSitePath" :class="cls.fieldError">{{ errors.graphSitePath }}</div>
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Dossier de dépôt <span :class="cls.fieldOptional">(optionnel)</span></label>
                <input v-model="form.graphUploadPath" :class="cls.fieldInput" placeholder="Shared Documents" autocomplete="off" />
                <p class="text-[11px] text-muted-foreground">Dossier de la bibliothèque du site où sont déposés les justificatifs.</p>
              </div>
            </div>
            <p class="flex items-start gap-2 mt-5 text-[12px] text-muted-foreground bg-background rounded-lg px-3 py-2.5">
              <ShieldCheck class="w-4 h-4 text-primary shrink-0 mt-px" />
              <span>Les identifiants et secrets sont chiffrés à l'enregistrement et ne sont plus jamais affichés. Pour en changer un, cliquez sur « Modifier » et saisissez la nouvelle valeur : sinon l'existante est conservée.</span>
            </p>
          </template>
        </div>

        <div class="flex items-center gap-3 flex-wrap border-t border-border pt-5">
          <button :class="cls.btnPrimary" :disabled="saving" @click="save"><Save class="w-4 h-4" /> Enregistrer</button>
          <button v-if="settings.configured" :class="[cls.btnOutline, '!text-danger']" :disabled="resetting || saving" @click="resetConfig">
            <RotateCcw class="w-4 h-4" /> Réinitialiser
          </button>
          <span v-if="saved" class="text-[12px] text-success inline-flex items-center gap-1"><CircleCheck class="w-3.5 h-3.5" /> Configuration enregistrée</span>
          <span v-if="saveError" :class="cls.fieldError">{{ saveError }}</span>
        </div>
      </section>

      <!-- Test -->
      <section :class="[card, 'p-6 flex flex-col gap-3']">
        <div>
          <h2 :class="cardTitle">Vérifier la configuration</h2>
          <p :class="cardHint">
            Enregistrez d'abord, puis lancez le test : l'application essaie d'écrire dans le dossier, ou de se connecter au site SharePoint.
          </p>
        </div>
        <div>
          <button :class="cls.btnOutline" :disabled="testing || !!testBlocker" @click="runTest">
            <PlugZap class="w-4 h-4" /> {{ testing ? 'Test en cours…' : 'Tester le stockage' }}
          </button>
        </div>
        <p v-if="testBlocker" class="text-[12px] text-warning">{{ testBlocker }}</p>
        <div v-if="testResult?.ok" class="flex items-start gap-2 rounded-lg bg-success-bg text-success px-3 py-2 text-[13px]">
          <CircleCheck class="w-4 h-4 mt-0.5 shrink-0" />
          <span>Le stockage fonctionne : {{ settings.provider === 'Graph' ? 'connexion au site SharePoint réussie.' : "l'application peut écrire dans le dossier." }}</span>
        </div>
        <div v-else-if="testResult" class="flex items-start gap-2 rounded-lg bg-danger-bg text-danger px-3 py-2 text-[13px]">
          <TriangleAlert class="w-4 h-4 mt-0.5 shrink-0" />
          <span class="break-all">{{ testResult.error }}</span>
        </div>
      </section>
    </template>
  </div>
</template>
