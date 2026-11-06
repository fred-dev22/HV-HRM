// Feuille de temps d'un employe en PDF : meme mise en page que le systeme de pointage
// (en-tete, bloc employe, quatre totaux, detail jour par jour, signatures).
import { api } from './api'
import { brand } from '../config/appConfig'
import type { Timesheet } from '../stores/time'

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MONTH_NAMES = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

// Dates 'AAAA-MM-JJ' lues a la main : pas de decalage de fuseau (voir lib/date.ts).
function parts(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number]
  return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }
}

export function pdfHours(value: number): string {
  return `${Math.round(value * 10) / 10}h`
}

export function longDate(iso: string): string {
  const { y, m, d } = parts(iso)
  return `${String(d).padStart(2, '0')} ${MONTH_NAMES[m - 1]} ${y}`
}

export interface PdfDayRow {
  date: string // jj/mm
  day: string // Lun, Mar...
  required: string
  worked: string
  overtime: string
  note: string
  muted: boolean // week-end ou jour ferie : ligne grisee
}

// Lignes du detail : la note est le nom du jour ferie, sinon "Weekend" le samedi et le dimanche.
export function buildPdfRows(sheet: Timesheet, holidayNames: Record<string, string>): PdfDayRow[] {
  return sheet.days.map((d) => {
    const { m, d: dd, dow } = parts(d.date)
    const holiday = holidayNames[d.date.slice(0, 10)]
    const weekend = dow === 0 || dow === 6
    return {
      date: `${String(dd).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
      day: DAY_NAMES[dow]!,
      required: pdfHours(d.required),
      worked: pdfHours(d.worked),
      overtime: d.overtime > 0 ? `+${pdfHours(d.overtime)}` : '',
      note: holiday ?? (weekend ? 'Weekend' : ''),
      muted: !!holiday || weekend,
    }
  })
}

// Noms des jours feries de la periode (le backend remappe les jours recurrents sur chaque annee).
async function loadHolidayNames(from: string, to: string): Promise<Record<string, string>> {
  const names: Record<string, string> = {}
  const first = parts(from).y
  const last = parts(to).y
  for (let year = first; year <= last; year++) {
    try {
      const { data } = await api.get<{ Name: string; Date: string }[]>(`/holidays/year/${year}`)
      for (const h of data) names[String(h.Date).slice(0, 10)] = h.Name
    } catch {
      // Sans les jours feries, la note retombe sur "Weekend" ou reste vide : le PDF reste valable.
    }
  }
  return names
}

export async function generateTimesheetPdf(sheet: Timesheet): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const holidayNames = await loadHolidayNames(sheet.period.from, sheet.period.to)
  const rows = buildPdfRows(sheet, holidayNames)
  const appName = brand.productName || brand.name || 'HRM'

  const doc = new jsPDF()
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('FEUILLE DE TEMPS', 105, 20, { align: 'center' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text(appName, 105, 28, { align: 'center' })
  doc.setTextColor(0)

  // Bloc employe
  doc.setFillColor(245, 245, 245)
  doc.rect(14, 35, 182, 25, 'F')
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(sheet.employee.FullName, 20, 44)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Matricule: ${sheet.employee.EmployeeNumber}`, 20, 52)
  doc.text(`Service: ${sheet.employee.Service || '-'}`, 100, 52)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(`Période: ${longDate(sheet.period.from)} au ${longDate(sheet.period.to)}`, 14, 70)

  // Quatre totaux
  const boxes: { label: string; value: string; fill: [number, number, number]; color: [number, number, number] }[] = [
    { label: 'Heures prévues', value: pdfHours(sheet.summary.required), fill: [230, 240, 255], color: [0, 0, 0] },
    { label: 'Heures travaillées', value: pdfHours(sheet.summary.worked), fill: [230, 255, 230], color: [0, 0, 0] },
    { label: 'Heures sup.', value: `+${pdfHours(sheet.summary.overtime)}`, fill: [255, 250, 230], color: [0, 128, 0] },
    { label: 'Absences', value: pdfHours(sheet.summary.absence), fill: [255, 235, 235], color: [200, 0, 0] },
  ]
  const boxY = 78
  const boxW = 44
  const boxH = 18
  const gap = 2
  boxes.forEach((b, i) => {
    const x = 14 + (boxW + gap) * i
    doc.setFillColor(...b.fill)
    doc.rect(x, boxY, boxW, boxH, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80)
    doc.text(b.label, x + boxW / 2, boxY + 6, { align: 'center' })
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...b.color)
    doc.text(b.value, x + boxW / 2, boxY + 14, { align: 'center' })
  })
  doc.setTextColor(0)

  autoTable(doc, {
    startY: 102,
    head: [['Date', 'Jour', 'Prévu', 'Travaillé', 'HS', 'Notes']],
    body: rows.map((r) => [r.date, r.day, r.required, r.worked, r.overtime, r.note]),
    theme: 'striped',
    headStyles: { fillColor: [0, 106, 78], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 25 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 25 },
      3: { halign: 'right', cellWidth: 25 },
      4: { halign: 'right', cellWidth: 20, textColor: [0, 128, 0] },
      5: { halign: 'left', cellWidth: 'auto', textColor: [100, 100, 100], fontStyle: 'italic' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && rows[data.row.index]?.muted) {
        data.cell.styles.fillColor = [248, 248, 248]
        data.cell.styles.textColor = [120, 120, 120]
      }
    },
  })

  // Signatures sous le tableau (nouvelle page s'il n'y a plus de place)
  const pageHeight = doc.internal.pageSize.height
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let signY = (doc as any).lastAutoTable.finalY + 15
  if (signY > pageHeight - 30) {
    doc.addPage()
    signY = 30
  }
  doc.setTextColor(0)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Signature employé:', 14, signY)
  doc.line(50, signY, 95, signY)
  doc.text('Signature responsable:', 110, signY)
  doc.line(155, signY, 196, signY)

  // Pied de page sur chaque page
  const generated = new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFontSize(8)
    doc.setTextColor(128)
    doc.text(`Généré le ${generated}`, 14, pageHeight - 10)
    doc.text(`${appName} - Système de Gestion des Temps`, 196, pageHeight - 10, { align: 'right' })
  }

  doc.save(`feuille_temps_${sheet.employee.EmployeeNumber}_${sheet.period.from}_${sheet.period.to}.pdf`)
}

export interface GlobalPdfRow {
  name: string
  employeeNumber: string
  required: number
  worked: number
  overtime: number
  absence: number
}

// Lignes du rapport global : "-" quand l'employe n'a pas d'heures supplementaires.
export function buildGlobalPdfRows(rows: GlobalPdfRow[]): string[][] {
  return rows.map((r) => [r.name, r.employeeNumber, pdfHours(r.required), pdfHours(r.worked), pdfHours(r.absence), r.overtime > 0 ? `+${pdfHours(r.overtime)}` : '-'])
}

// Rapport global des horaires de tous les employes sur une periode (meme mise en page que le systeme de pointage).
export async function generateGlobalReportPdf(rows: GlobalPdfRow[], period: { from: string; to: string }): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const appName = brand.productName || brand.name || 'HRM'
  const doc = new jsPDF()
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('RAPPORT GLOBAL DES HORAIRES', 105, 20, { align: 'center' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text(appName, 105, 28, { align: 'center' })
  doc.setTextColor(0)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(`Période: ${longDate(period.from)} au ${longDate(period.to)}`, 14, 40)

  const sum = (f: (r: GlobalPdfRow) => number) => rows.reduce((s, r) => s + f(r), 0)
  const boxes: { label: string; value: string; fill: [number, number, number] }[] = [
    { label: 'Total prévu', value: pdfHours(sum((r) => r.required)), fill: [230, 240, 255] },
    { label: 'Total travaillé', value: pdfHours(sum((r) => r.worked)), fill: [230, 255, 230] },
    { label: 'Total HS', value: `+${pdfHours(sum((r) => r.overtime))}`, fill: [255, 250, 230] },
    { label: 'Total absences', value: pdfHours(sum((r) => r.absence)), fill: [255, 235, 235] },
  ]
  boxes.forEach((b, i) => {
    const x = 14 + 46 * i
    doc.setFillColor(...b.fill)
    doc.rect(x, 48, 44, 18, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80)
    doc.text(b.label, x + 22, 54, { align: 'center' })
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0)
    doc.text(b.value, x + 22, 62, { align: 'center' })
  })

  autoTable(doc, {
    startY: 74,
    head: [['Employé', 'Matricule', 'Prévu', 'Travaillé', 'Absences', 'HS']],
    body: buildGlobalPdfRows(rows),
    theme: 'striped',
    headStyles: { fillColor: [0, 106, 78], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', textColor: [0, 128, 0] } },
  })

  const pageHeight = doc.internal.pageSize.height
  const generated = new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  for (let p = 1; p <= doc.getNumberOfPages(); p++) {
    doc.setPage(p)
    doc.setFontSize(8)
    doc.setTextColor(128)
    doc.text(`Généré le ${generated}`, 14, pageHeight - 10)
    doc.text(`${appName} - Système de Gestion des Temps`, 196, pageHeight - 10, { align: 'right' })
  }
  doc.save(`rapport_global_${period.from}_${period.to}.pdf`)
}
