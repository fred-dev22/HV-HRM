import { computed, onMounted, onUnmounted, ref } from 'vue'

export type DayPart = 'morning' | 'afternoon' | 'evening'

// Moment de la journee : bonjour avant midi, bon apres-midi jusqu'a 18 h, bonsoir ensuite.
export function dayPartOf(date: Date): DayPart {
  const h = date.getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

// Prenom a afficher : le prenom du compte, ou le premier mot du nom complet.
export function firstNameOf(user: { firstName?: string; name?: string } | null | undefined): string {
  const first = user?.firstName?.trim()
  if (first) return first
  return (user?.name ?? '').trim().split(/\s+/)[0] ?? ''
}

// Moment de la journee, remis a jour chaque minute : la page restee ouverte change seule de salutation.
export function useDayPart() {
  const now = ref(new Date())
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => { timer = setInterval(() => { now.value = new Date() }, 60_000) })
  onUnmounted(() => { if (timer) clearInterval(timer) })
  return computed(() => dayPartOf(now.value))
}
