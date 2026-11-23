<script setup lang="ts">
/**
 * Paramètres > Messagerie : le client choisit UN mode d'envoi des emails,
 * Microsoft Graph ou SMTP avec son nom de domaine. Réservé au compte
 * administrateur de lancement (le serveur le vérifie aussi). Tous les
 * identifiants sont chiffrés côté serveur et jamais réaffichés : un champ
 * enregistré se remplace via « Modifier », sinon il est conservé.
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Cloud, Server, Mail, Send, Save, CircleCheck, TriangleAlert, ShieldCheck, Check } from 'lucide-vue-next'
import { SkeletonLoader } from '../../components'
import SecretField from '../../components/ui/form-field/SecretField.vue'
import * as cls from '../../lib/formClasses'
import { useAuthStore } from '../../stores/auth'
import { useMailSettingsStore, type MailProvider } from '../../stores/mailSettings'

const store = useMailSettingsStore()
const auth = useAuthStore()
const router = useRouter()

const loading = ref(true)
const saving = ref(false)
const saveError = ref('')
const saved = ref(false)

const form = reactive({
  provider: 'Graph' as MailProvider,
  sender: '',
  graphTenantId: '',
  graphClientId: '',
  graphClientSecret: '',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpAuth: true,
  smtpUser: '',
  smtpPassword: '',
})
const errors = reactive<Record<string, string>>({})
// Change apres chaque enregistrement : remet les champs secrets en mode "enregistre".
const saveCount = ref(0)

const settings = computed(() => store.settings)

const PROVIDERS: { value: MailProvider; title: string; text: string; icon: typeof Cloud }[] = [
  { value: 'Graph', title: 'Microsoft Graph', text: 'Boîte Microsoft 365 / Entra ID de votre organisation.', icon: Cloud },
  { value: 'Smtp', title: 'SMTP', text: 'Serveur de messagerie de votre nom de domaine.', icon: Server },
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
      form.sender = s.sender
      form.smtpHost = s.smtp.host
      form.smtpPort = s.smtp.port
      form.smtpSecure = s.smtp.secure
      form.smtpAuth = s.provider === 'Smtp' ? s.smtp.hasUser : true
    }
  } catch {
    // le message d'erreur du store est affiché dans la page
  } finally {
    loading.value = false
  }
})

function validate(): boolean {
  for (const k of Object.keys(errors)) delete errors[k]
  if (!form.sender.trim() || !/^\S+@\S+\.\S+$/.test(form.sender.trim())) errors.sender = 'Adresse expéditrice invalide'
  if (form.provider === 'Graph') {
    if (!form.graphTenantId.trim() && !settings.value?.graph.hasTenantId) errors.graphTenantId = 'Obligatoire'
    if (!form.graphClientId.trim() && !settings.value?.graph.hasClientId) errors.graphClientId = 'Obligatoire'
    if (!form.graphClientSecret.trim() && !settings.value?.graph.hasSecret) errors.graphClientSecret = 'Obligatoire'
  } else {
    if (!form.smtpHost.trim()) errors.smtpHost = 'Obligatoire'
    if (!form.smtpPort || form.smtpPort < 1 || form.smtpPort > 65535) errors.smtpPort = 'Port invalide'
    if (form.smtpAuth) {
      if (!form.smtpUser.trim() && !settings.value?.smtp.hasUser) errors.smtpUser = 'Obligatoire'
      if (!form.smtpPassword.trim() && !settings.value?.smtp.hasPassword) errors.smtpPassword = 'Obligatoire'
    }
  }
  return Object.keys(errors).length === 0
}

async function save() {
  saved.value = false
  saveError.value = ''
  if (!validate()) return
  saving.value = true
  try {
    await store.save(
      form.provider === 'Graph'
        ? {
            provider: 'Graph',
            sender: form.sender.trim(),
            graphTenantId: form.graphTenantId.trim() || undefined,
            graphClientId: form.graphClientId.trim() || undefined,
            graphClientSecret: form.graphClientSecret.trim() || undefined,
          }
        : {
            provider: 'Smtp',
            sender: form.sender.trim(),
            smtpHost: form.smtpHost.trim(),
            smtpPort: Number(form.smtpPort),
            smtpSecure: form.smtpSecure,
            smtpAuth: form.smtpAuth,
            smtpUser: form.smtpUser.trim() || undefined,
            smtpPassword: form.smtpPassword.trim() || undefined,
          },
    )
    // Rien de saisi ne reste en mémoire après l'enregistrement.
    form.graphTenantId = ''
    form.graphClientId = ''
    form.graphClientSecret = ''
    form.smtpUser = ''
    form.smtpPassword = ''
    saveCount.value++
    saved.value = true
  } catch {
    saveError.value = store.error ?? "Impossible d'enregistrer la configuration"
  } finally {
    saving.value = false
  }
}

/* ── Email de test ─────────────────────────────────────────────── */
const testTo = ref(auth.user?.email ?? '')
const testing = ref(false)
const testResult = ref<{ ok: boolean; error: string | null; to?: string } | null>(null)

async function sendTest() {
  testResult.value = null
  if (!/^\S+@\S+\.\S+$/.test(testTo.value.trim())) {
    testResult.value = { ok: false, error: 'Saisissez une adresse de destinataire valide.' }
    return
  }
  testing.value = true
  try {
    const to = testTo.value.trim()
    testResult.value = { ...(await store.sendTest(to)), to }
  } finally {
    testing.value = false
  }
}

const card = 'bg-card border border-border rounded-xl'
const cardTitle = 'text-[15px] font-semibold text-foreground'
const cardHint = 'text-[12px] text-muted-foreground mt-0.5'
</script>

<template>
  <div class="px-8 py-8 max-md:px-4 flex flex-col gap-6 max-w-[900px]">
    <!-- En-tête -->
    <div class="flex items-start gap-4">
      <div class="w-11 h-11 rounded-xl bg-tint text-primary flex items-center justify-center shrink-0">
        <Mail class="w-5 h-5" />
      </div>
      <div>
        <h1 class="text-xl font-bold text-foreground leading-tight">Messagerie</h1>
        <p class="text-[13px] text-muted-foreground mt-1">
          Choisissez comment l'application envoie ses emails : validations de demandes, création de comptes, justificatifs. Un seul mode est actif à la fois.
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
            {{ settings.configured ? `Envoi d'emails actif : ${settings.provider === 'Smtp' ? 'SMTP' : 'Microsoft Graph'}` : "Envoi d'emails non configuré" }}
          </div>
          <div class="text-[12px] opacity-90">
            {{ settings.configured ? `Expéditeur : ${settings.sender}` : "Aucun email ne part tant qu'un mode n'est pas enregistré. Tous les utilisateurs en sont avertis par une bande en haut de l'écran." }}
          </div>
        </div>
      </div>

      <!-- Mode d'envoi -->
      <section :class="[card, 'p-6']">
        <h2 :class="cardTitle">Mode d'envoi</h2>
        <p :class="cardHint">Le client choisit l'un des deux.</p>
        <div class="grid grid-cols-2 max-sm:grid-cols-1 gap-3 mt-4" role="radiogroup" aria-label="Mode d'envoi">
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
            <span class="min-w-0">
              <span class="block text-[14px] font-semibold text-foreground">{{ p.title }}</span>
              <span class="block text-[12px] text-muted-foreground mt-0.5">{{ p.text }}</span>
            </span>
            <span v-if="form.provider === p.value" class="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <Check class="w-3 h-3" />
            </span>
          </button>
        </div>
      </section>

      <!-- Expéditeur + identifiants -->
      <section :class="[card, 'p-6 flex flex-col gap-6']">
        <div>
          <h2 :class="cardTitle">Expéditeur</h2>
          <div :class="[cls.field, 'mt-3']">
            <label :class="cls.fieldLabel">Adresse expéditrice *</label>
            <input v-model="form.sender" type="email" :class="[cls.fieldInput, errors.sender && cls.inputError]" placeholder="noreply@exemple.com" />
            <div v-if="errors.sender" :class="cls.fieldError">{{ errors.sender }}</div>
            <p class="text-[11px] text-muted-foreground">
              {{ form.provider === 'Graph' ? 'Boîte Microsoft 365 depuis laquelle les emails sont envoyés.' : 'Adresse affichée comme expéditeur des emails.' }}
            </p>
          </div>
        </div>

        <div class="border-t border-border pt-6" :key="saveCount">
          <template v-if="form.provider === 'Graph'">
            <h2 :class="cardTitle">Identifiants Microsoft Graph</h2>
            <div class="flex flex-col gap-4 mt-3">
              <div :class="cls.fieldRow">
                <SecretField
                  v-model="form.graphTenantId" label="Identifiant du tenant *"
                  :saved="settings.graph.hasTenantId" :hint="settings.graph.tenantIdHint" :error="errors.graphTenantId"
                />
                <SecretField
                  v-model="form.graphClientId" label="Identifiant du client (application) *"
                  :saved="settings.graph.hasClientId" :hint="settings.graph.clientIdHint" :error="errors.graphClientId"
                />
              </div>
              <SecretField
                v-model="form.graphClientSecret" label="Secret du client *" secret
                :saved="settings.graph.hasSecret" :error="errors.graphClientSecret"
              />
            </div>
          </template>

          <template v-else>
            <h2 :class="cardTitle">Serveur SMTP</h2>
            <div class="flex flex-col gap-4 mt-3">
              <div :class="cls.fieldRow">
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Serveur *</label>
                  <input v-model="form.smtpHost" :class="[cls.fieldInput, errors.smtpHost && cls.inputError]" placeholder="smtp.exemple.com" autocomplete="off" />
                  <div v-if="errors.smtpHost" :class="cls.fieldError">{{ errors.smtpHost }}</div>
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Port *</label>
                  <input v-model.number="form.smtpPort" type="number" min="1" max="65535" :class="[cls.fieldInput, errors.smtpPort && cls.inputError]" />
                  <div v-if="errors.smtpPort" :class="cls.fieldError">{{ errors.smtpPort }}</div>
                </div>
              </div>
              <label class="flex items-start gap-2.5 text-[13px] text-foreground cursor-pointer">
                <input type="checkbox" v-model="form.smtpSecure" class="accent-primary mt-0.5" />
                <span>
                  Connexion sécurisée directe (TLS)
                  <span class="block text-[11px] text-muted-foreground">À cocher pour le port 465. Laissez décoché pour 587 ou 25.</span>
                </span>
              </label>
              <label class="flex items-start gap-2.5 text-[13px] text-foreground cursor-pointer">
                <input type="checkbox" v-model="form.smtpAuth" class="accent-primary mt-0.5" />
                <span>
                  Le serveur demande un identifiant et un mot de passe
                  <span class="block text-[11px] text-muted-foreground">À décocher uniquement pour un relais interne sans authentification.</span>
                </span>
              </label>
              <div v-if="form.smtpAuth" :class="cls.fieldRow">
                <SecretField
                  v-model="form.smtpUser" label="Identifiant *"
                  :saved="settings.smtp.hasUser" :hint="settings.smtp.userHint" :error="errors.smtpUser"
                />
                <SecretField
                  v-model="form.smtpPassword" label="Mot de passe *" secret
                  :saved="settings.smtp.hasPassword" :error="errors.smtpPassword"
                />
              </div>
            </div>
          </template>

          <p class="flex items-start gap-2 mt-5 text-[12px] text-muted-foreground bg-background rounded-lg px-3 py-2.5">
            <ShieldCheck class="w-4 h-4 text-primary shrink-0 mt-px" />
            <span>Les identifiants et secrets sont chiffrés à l'enregistrement et ne sont plus jamais affichés. Pour en changer un, cliquez sur « Modifier » et saisissez la nouvelle valeur : sinon l'existante est conservée.</span>
          </p>
        </div>

        <div class="flex items-center gap-3 flex-wrap border-t border-border pt-5">
          <button :class="cls.btnPrimary" :disabled="saving" @click="save"><Save class="w-4 h-4" /> Enregistrer</button>
          <span v-if="saved" class="text-[12px] text-success inline-flex items-center gap-1"><CircleCheck class="w-3.5 h-3.5" /> Configuration enregistrée</span>
          <span v-if="saveError" :class="cls.fieldError">{{ saveError }}</span>
        </div>
      </section>

      <!-- Test -->
      <section :class="[card, 'p-6 flex flex-col gap-3']">
        <div>
          <h2 :class="cardTitle">Vérifier la configuration</h2>
          <p :class="cardHint">
            Enregistrez d'abord, puis saisissez l'adresse de votre choix : un message de test y est envoyé et vous vérifiez vous-même qu'il arrive.
          </p>
        </div>
        <div class="flex items-end gap-3 flex-wrap">
          <div :class="[cls.field, 'flex-1 min-w-[240px]']">
            <label :class="cls.fieldLabel">Adresse du destinataire</label>
            <input v-model="testTo" type="email" :class="cls.fieldInput" placeholder="prenom.nom@exemple.com" @keyup.enter="sendTest" />
          </div>
          <button :class="cls.btnOutline" :disabled="testing || !settings.configured" @click="sendTest">
            <Send class="w-4 h-4" /> {{ testing ? 'Envoi…' : 'Envoyer le test' }}
          </button>
        </div>
        <div v-if="testResult?.ok" class="flex items-start gap-2 rounded-lg bg-success-bg text-success px-3 py-2 text-[13px]">
          <CircleCheck class="w-4 h-4 mt-0.5 shrink-0" />
          <span>Email de test envoyé à <strong>{{ testResult.to }}</strong>. Vérifiez sa boîte de réception (et les courriers indésirables).</span>
        </div>
        <div v-else-if="testResult" class="flex items-start gap-2 rounded-lg bg-danger-bg text-danger px-3 py-2 text-[13px]">
          <TriangleAlert class="w-4 h-4 mt-0.5 shrink-0" />
          <span>{{ testResult.error }}</span>
        </div>
      </section>
    </template>
  </div>
</template>
