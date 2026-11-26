// Impression d'une semaine de pointage (une page A4 en paysage).
import type { WeekDetail } from '../stores/timeWeeks'
import { WEEK_STATUS_LABELS } from '../stores/timeWeeks'
import { PAIR_COUNT, dayName, draftOf, isWeekend } from '../components/time/weekGrid'

const fr = (date: string) => date.split('-').reverse().join('/')
const num = (n: number | null) => (n ? String(n).replace('.', ',') : '')
// Les polices du PDF ne connaissent pas l'espace fine des milliers du francais.
const amount = (n: number) => n.toLocaleString('fr-FR').replace(/\s/g, ' ')

export async function printWeek(week: WeekDetail): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text(`Pointage, semaine ${week.weekNumber} du ${fr(week.weekStart)} au ${fr(week.weekEnd)}`, 14, 15)
  doc.setFontSize(10)
  doc.text(`${week.employee.code}  ${week.employee.name}${week.employee.service ? `  (${week.employee.service})` : ''}`, 14, 22)
  const signed = [
    week.controlledBy ? `contrôlée par ${week.controlledBy}` : '',
    week.validatedBy ? `validée par ${week.validatedBy}` : '',
  ].filter(Boolean).join(', ')
  doc.text(`État : ${WEEK_STATUS_LABELS[week.status]}${signed ? ` (${signed})` : ''}`, 14, 28)

  const pairHeads = Array.from({ length: PAIR_COUNT }, (_, i) => [`Entrée ${i + 1}`, `Sortie ${i + 1}`]).flat()
  autoTable(doc, {
    startY: 33,
    head: [['Jour', 'Date', ...pairHeads, 'Sortie lendemain', 'Panier', 'Permanence', 'Congé', 'Travaillé', 'HS']],
    body: week.days.map((d) => {
      const draft = draftOf(d)
      return [
        dayName(d.date), fr(d.date).slice(0, 5), ...draft.pairs.flatMap(p => [p.start, p.end]), draft.nextDayOut,
        d.panier ? 'Oui' : '', d.permanence ? 'Oui' : '', d.leave ?? (d.holiday ? 'Férié' : ''), num(d.worked), num(d.overtime),
      ]
    }),
    styles: { fontSize: 8, cellPadding: 1.6, halign: 'center' },
    headStyles: { fillColor: [60, 60, 60] },
    didParseCell: (cell) => {
      const day = week.days[cell.row.index]
      if (cell.section === 'body' && cell.column.index < 2 && day && isWeekend(day.date)) cell.cell.styles.textColor = [200, 0, 0]
    },
  })

  const t = week.totals
  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6,
    head: [['Travaillé', 'Heures sup.', 'À 130 %', 'À 150 %', 'Nuit', 'Dimanche / férié', 'Paniers', 'Permanence (Ar)']],
    body: [[num(t.worked) || '0', num(t.overtime) || '0', num(t.hs130) || '0', num(t.hs150) || '0', num(t.night) || '0', num(t.holiday) || '0', String(t.panier), amount(t.permanenceAmount)]],
    styles: { fontSize: 9, halign: 'center' },
    headStyles: { fillColor: [60, 60, 60] },
  })
  doc.save(`pointage-${week.employee.code}-semaine-${week.weekNumber}.pdf`)
}
