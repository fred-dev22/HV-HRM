import Papa from 'papaparse'

// Moteur de l'export configurable (voir ExportConfigModal.vue) : transforme
// une liste de colonnes choisies par l'utilisateur en tableau, puis en fichier
// Excel ou CSV. Aucune connaissance metier ici.

export type ExportValue = string | number
export type ExportFormat = 'xlsx' | 'csv'

// Donnee exportable proposee a l'utilisateur (une colonne possible).
export interface ExportSource {
  key: string
  label: string
  // Un nombre reste un nombre dans Excel ; un texte reste un texte (utile pour
  // un matricule : "03958" ne doit pas devenir 3958).
  get: (row: any) => ExportValue | null | undefined
}

// Colonne choisie : soit une donnee (sourceKey), soit une valeur fixe
// identique sur toutes les lignes (sourceKey = null, ex : un code Sage).
export interface ExportColumnConfig {
  uid: string
  sourceKey: string | null
  header: string
  fixedValue?: string
}

export interface CsvOptions {
  delimiter: ';' | ',' | '\t'
  decimal: ',' | '.'
}

export interface ExportTable {
  headers: string[]
  rows: ExportValue[][]
}

const PLAIN_NUMBER = /^-?(0|[1-9]\d*)([.,]\d+)?$/

// "0" ou "12,5" tapes dans une valeur fixe deviennent des nombres ; "007"
// reste du texte (le zero initial compte, ex : un code).
export function coerceFixedValue(raw: string): ExportValue {
  const text = raw.trim()
  if (PLAIN_NUMBER.test(text)) return Number(text.replace(',', '.'))
  return raw
}

export function buildTable(
  columns: ExportColumnConfig[],
  sources: ExportSource[],
  rows: any[],
): ExportTable {
  const byKey = new Map(sources.map(s => [s.key, s]))
  const resolved = columns.map(col => {
    const source = col.sourceKey ? byKey.get(col.sourceKey) : undefined
    const header = col.header.trim() || source?.label || ''
    if (col.sourceKey === null) {
      const fixed = coerceFixedValue(col.fixedValue ?? '')
      return { header, read: () => fixed }
    }
    return { header, read: (row: any) => source?.get(row) ?? '' }
  })
  return {
    headers: resolved.map(c => c.header),
    rows: rows.map(row => resolved.map(c => c.read(row))),
  }
}

// Un texte commencant par = + - @ est interprete comme une formule par Excel a
// l'ouverture d'un CSV (injection de formule : un nom d'employe pourrait
// executer du code chez celui qui ouvre le fichier). On le neutralise.
function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

export function buildCsv(table: ExportTable, options: CsvOptions, includeHeader: boolean): string {
  const format = (v: ExportValue): string =>
    typeof v === 'number'
      ? String(v).replace('.', options.decimal)
      : neutralizeFormula(v)
  const data = table.rows.map(row => row.map(format))
  const body = includeHeader ? [table.headers.map(neutralizeFormula), ...data] : data
  return Papa.unparse(body, { delimiter: options.delimiter, newline: '\r\n' })
}

export async function buildXlsx(table: ExportTable, includeHeader: boolean, sheetName: string): Promise<Blob> {
  // Charge a la demande : la bibliotheque n'est utile qu'au moment de l'export.
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const toCell = (v: ExportValue) =>
    typeof v === 'number' ? { value: v, type: Number } : { value: v, type: String }
  const head = table.headers.map(h => ({ value: h, type: String, fontWeight: 'bold' as const }))
  const data = [
    ...(includeHeader ? [head] : []),
    ...table.rows.map(row => row.map(toCell)),
  ]
  const widths = table.headers.map((h, i) => {
    const longest = Math.max(h.length, ...table.rows.slice(0, 200).map(r => String(r[i] ?? '').length))
    return { width: Math.min(Math.max(longest + 2, 10), 50) }
  })
  return writeXlsxFile(data as never, { columns: widths, sheet: sheetName.slice(0, 31) }).toBlob()
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// "BOM" UTF-8 : sans lui Excel (Windows) ouvre un CSV avec les accents casses.
export function csvBlob(csv: string): Blob {
  return new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
}
