import { reactive } from 'vue'
import { applyEnabledModules } from './features'

// Configuration publique de l'instance (marque + modules), lue sur le backend
// avant le premier affichage. Voir GET /api/config/public. Rien de propre a un
// client n'est ecrit ici : tant que le serveur ne repond pas autre chose, la
// marque est neutre ("HRM", sans logo, couleurs par defaut de main.css).

export interface BrandConfig {
  name: string
  shortName: string
  primaryColor: string | null
  accentColor: string | null
  backgroundColor: string | null
  tintColor: string | null
  supportEmail: string | null
  hasLogo: boolean
  logoVersion?: string | null
}

const apiBase = ((import.meta.env.VITE_API_URL as string) || '/api').replace(/\/+$/, '')

export const brand = reactive<BrandConfig>({
  name: 'HRM',
  shortName: 'HRM',
  primaryColor: null,
  accentColor: null,
  backgroundColor: null,
  tintColor: null,
  supportEmail: null,
  hasLogo: false,
})

// Logo du client, servi par le backend. Chaine vide quand le client n'en a pas :
// les templates masquent alors l'image (v-if="$brandLogo").
export function logoUrl(): string {
  if (!brand.hasLogo) return ''
  const v = brand.logoVersion ? `?v=${brand.logoVersion}` : ''
  return `${apiBase}/config/logo${v}`
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

// Melange `hex` avec une teinte : target 255 = vers le blanc, 0 = vers le noir.
function mix(hex: string, target: number, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => clamp(v + (target - v) * amount))
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
}

// Applique les deux couleurs du client ; toutes les autres teintes de
// l'interface (fonds clairs, survols, bordures actives) en sont derivees.
// Sans couleur renseignee, les valeurs neutres de main.css restent en place.
export function applyBrandTheme(): void {
  const root = document.documentElement.style
  const set = (name: string, value: string) => root.setProperty(name, value)

  const p = brand.primaryColor
  if (p) {
    set('--color-primary', p)
    set('--color-ring', p)
    set('--color-nav-active', p)
    set('--color-sidebar-primary', p)
    set('--color-sidebar-ring', p)
    set('--color-sidebar-accent-foreground', p)
    set('--color-chart-1', p)
    set('--brand-primary', p)
    set('--brand-primary-dark', mix(p, 0, 0.2))
    set('--brand-primary-mid', mix(p, 255, 0.65))
    set('--brand-department-bg', p)
    set('--brand-service-border', p)
  }

  // Fond des pages : choisi par le client (BRAND_BACKGROUND_COLOR), sinon gris
  // neutre de main.css. Le fond de l'application en est une version plus claire.
  const bg = brand.backgroundColor
  if (bg) {
    set('--color-page', bg)
    set('--color-background', mix(bg, 255, 0.55))
  }

  // Surfaces teintees (en-tetes de tableau, selections, champs) : BRAND_TINT_COLOR,
  // sinon gris neutre de main.css.
  const tint = brand.tintColor
  if (tint) {
    set('--color-tint', tint)
    set('--brand-primary-light', tint)
    set('--color-sidebar-accent', tint)
  }

  const a = brand.accentColor
  if (a) {
    const light = mix(a, 255, 0.88)
    set('--color-destructive', a)
    set('--color-danger', a)
    set('--color-danger-bg', light)
    set('--brand-accent', a)
    set('--brand-accent-light', light)
    set('--brand-direction-bg', a)
  }
}

// Le titre de l'onglet reste celui du produit ; seule l'icone vient du client,
// et uniquement s'il a fourni un logo (aucune icone sinon).
export function applyBrandDocument(): void {
  const icon = logoUrl()
  if (!icon) return
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = icon
}

// ── Chargement de la configuration ──────────────────────────────────────────
// Une seule requete au demarrage (jamais a chaque page), avec :
//  - un delai maximum (CONFIG_TIMEOUT_MS) : au-dela, l'application demarre sans
//    attendre plus longtemps ;
//  - un cache local de la derniere configuration recue : au demarrage suivant on
//    l'applique tout de suite (aucun ecran vide, aucun clignotement), puis on
//    verifie en arriere-plan. Si le serveur renvoie autre chose (couleur, modules,
//    logo changes), on met le cache a jour et on recharge la page UNE fois pour
//    que tout soit coherent.
const CACHE_KEY = 'p247-app-config'
const CONFIG_TIMEOUT_MS = 3000

interface PublicConfig {
  brand: BrandConfig
  modules: string[]
  features?: { jobDistributionUi?: boolean }
}

function readCache(): PublicConfig | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as PublicConfig) : null
  } catch {
    return null // stockage indisponible ou contenu corrompu : on repart du serveur
  }
}

function writeCache(cfg: PublicConfig): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cfg))
  } catch {
    // navigation privee, stockage plein : le cache n'est qu'un confort
  }
}

async function fetchConfig(): Promise<PublicConfig> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS)
  try {
    const res = await fetch(`${apiBase}/config/public`, { cache: 'no-store', signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as PublicConfig
  } finally {
    clearTimeout(timer)
  }
}

function applyConfig(cfg: PublicConfig): void {
  Object.assign(brand, cfg.brand)
  applyEnabledModules(cfg.modules ?? [], cfg.features ?? {})
  applyBrandTheme()
  applyBrandDocument()
}

// Verification en arriere-plan apres un demarrage depuis le cache.
async function refreshInBackground(cached: PublicConfig): Promise<void> {
  try {
    const fresh = await fetchConfig()
    if (JSON.stringify(fresh) !== JSON.stringify(cached)) {
      writeCache(fresh)
      window.location.reload()
    }
  } catch {
    // Serveur lent ou injoignable : on garde la configuration en cache.
  }
}

export async function loadAppConfig(): Promise<void> {
  const cached = readCache()
  if (cached) {
    applyConfig(cached)
    void refreshInBackground(cached)
    return
  }
  try {
    const cfg = await fetchConfig()
    writeCache(cfg)
    applyConfig(cfg)
  } catch (err) {
    // Premier chargement et serveur injoignable ou trop lent : marque neutre,
    // aucun module optionnel, rien en cache (le prochain essai repartira du serveur).
    console.error('[config] configuration publique indisponible', err)
    applyEnabledModules([])
    applyBrandTheme()
    applyBrandDocument()
  }
}
