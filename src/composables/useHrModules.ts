import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import {
  PAYROLL_MODULE_ENABLED, REPORTS_MODULE_ENABLED, RECRUITMENT_MODULE_ENABLED, FORMATION_MODULE_ENABLED,
} from '../config/features'

// Modules du cote RH (Administration, Recrutement...) et navigation entre
// eux. Partage par la barre de navigation (grand ecran) et le tiroir du menu
// burger (petit ecran), pour que les deux proposent exactement les memes choix.
// Les modules proposes dependent de la configuration de l'instance
// (config/features.ts, alimente par ENABLED_MODULES cote serveur).
export function useHrModules() {
  const router = useRouter()
  const auth   = useAuthStore()
  const { t }  = useI18n()

  // 'administration' contient des fonctionnalites reelles couvertes par des
  // permissions, masque si l'utilisateur n'en a aucune.
  const hrNavItems = computed(() => [
    { key: 'administration', label: t('nav.admin'), visible: auth.hasAnyPermission([
      'EMPLOYE_VOIR_TOUT', 'EMPLOYE_VOIR_EQUIPE', 'ENTITE_VOIR',
      'MISSION_VOIR_TOUT', 'MISSION_VOIR_EQUIPE', 'FRAIS_VOIR_TOUT', 'FRAIS_VOIR_EQUIPE',
      'CONGE_VOIR_TOUT', 'CONGE_VOIR_EQUIPE',
      'CONFIG_CALENDRIER', 'CONFIG_FRAIS_MISSION',
    ]) },
    { key: 'recruitment', label: t('nav.recruitment'), visible: RECRUITMENT_MODULE_ENABLED && auth.hasPermission('RECRUTEMENT_ACCES') },
    { key: 'training',    label: t('nav.training'),    visible: FORMATION_MODULE_ENABLED && auth.hasPermission('FORMATION_ACCES') },
    { key: 'payroll',     label: t('nav.payroll'),     visible: PAYROLL_MODULE_ENABLED },
    { key: 'reports',     label: t('nav.reports'),     visible: REPORTS_MODULE_ENABLED && auth.hasAnyPermission(['RAPPORT_VOIR', 'ENTITE_VOIR']) },
  ].filter((item) => item.visible))

  // Ne pose pas navStore.setModule(key) : le module actif est deduit de l'URL
  // reelle par le garde de navigation (voir router/index.ts, moduleForPath).
  function handleHRNav(key: string) {
    const defaults: Record<string, string> = {
      administration: 'hr-dashboard',
      recruitment:    'hr-recruitment',
      training:       'hr-training',
      payroll:        'hr-payroll',
      reports:        'hr-reports',
    }
    if (defaults[key]) router.push({ name: defaults[key] })
  }

  return { hrNavItems, handleHRNav }
}
