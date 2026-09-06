import { createI18n } from 'vue-i18n'
import fr from '../locales/fr.json'
import en from '../locales/en.json'

// Language switching is locked for this first version — the app is French
// only. The English catalogue is kept as fallback source for missing keys,
// not as a user-selectable option (no UI exposes it, see AppTopBar.vue).
export const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  fallbackLocale: 'fr',
  messages: { fr, en },
})
