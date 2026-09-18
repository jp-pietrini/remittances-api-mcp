/**
 * Shared loading and formatting helpers for the public data API
 * (src/app/api/v1/*). The dashboard's JSON files are imported so the routes
 * can be prerendered and served from the edge cache without filesystem access.
 */
import mxStates from '../../public/data/mexico_remittances.json'
import mxMunis from '../../public/data/mexico_muni_remittances.json'
import muniNames from '../../public/data/mexico_muni_names.json'
import usStates from '../../public/data/us_remittances.json'
import mexicanBorn from '../../public/data/mexican_born_population.json'
import { TIME_RANGE, LATEST_COMPLETE_YEAR, FIRST_YEAR } from './constants'

type Series = Record<string, Record<string, number>>

export const mexicoStateData = mxStates as {
  quarterly: Series
  yearly: Series
  meta: Record<string, unknown>
}
export const mexicoMuniData = mxMunis as {
  yearly: Series
  meta: Record<string, unknown>
}
export const usStateData = usStates as {
  quarterly: Series
  yearly: Series
  meta: Record<string, unknown>
}
export const muniNameByCode = muniNames as Record<string, string>
export const mexicanBornByState = mexicanBorn as Record<string, number>

/** US-origin series come from the Banxico SIE API and lag the municipal cube. */
export const US_LAST_QUARTER = '2025-Q3'

export const STATE_NAME_BY_CODE: Record<string, string> = {
  '01': 'Aguascalientes',
  '02': 'Baja California',
  '03': 'Baja California Sur',
  '04': 'Campeche',
  '05': 'Coahuila de Zaragoza',
  '06': 'Colima',
  '07': 'Chiapas',
  '08': 'Chihuahua',
  '09': 'Ciudad de México',
  '10': 'Durango',
  '11': 'Guanajuato',
  '12': 'Guerrero',
  '13': 'Hidalgo',
  '14': 'Jalisco',
  '15': 'Estado de México',
  '16': 'Michoacán de Ocampo',
  '17': 'Morelos',
  '18': 'Nayarit',
  '19': 'Nuevo León',
  '20': 'Oaxaca',
  '21': 'Puebla',
  '22': 'Querétaro',
  '23': 'Quintana Roo',
  '24': 'San Luis Potosí',
  '25': 'Sinaloa',
  '26': 'Sonora',
  '27': 'Tabasco',
  '28': 'Tamaulipas',
  '29': 'Tlaxcala',
  '30': 'Veracruz de Ignacio de la Llave',
  '31': 'Yucatán',
  '32': 'Zacatecas',
}

export const quartersOf = (series: Series): string[] => {
  const first = Object.values(series)[0] ?? {}
  return Object.keys(first).sort()
}

export const coverage = () => {
  const mxQuarters = quartersOf(mexicoStateData.quarterly)
  return {
    unit: 'USD',
    mexico: {
      first_quarter: mxQuarters[0],
      last_quarter: mxQuarters[mxQuarters.length - 1],
      complete_years: `${FIRST_YEAR}-${LATEST_COMPLETE_YEAR}`,
      states: Object.keys(mexicoStateData.yearly).length,
      municipalities: Object.keys(mexicoMuniData.yearly).length,
    },
    united_states: {
      first_quarter: quartersOf(usStateData.quarterly)[0],
      last_quarter: US_LAST_QUARTER,
      states: Object.keys(usStateData.yearly).length,
      note: 'US state of origin comes from the Banxico SIE API and lags the municipal series.',
    },
    latest_quarter: `${TIME_RANGE.end.year}-Q${TIME_RANGE.end.quarter}`,
  }
}

export const SOURCES = [
  { name: 'Banco de México', use: 'Remittance flows by Mexican state and municipality, and by US state of origin' },
  { name: 'US Census Bureau (ACS)', use: 'Mexican-born population by state and PUMA' },
  { name: 'CONAPO', use: 'Migration intensity index' },
  { name: 'INEGI (ENIGH, Census, ICMM)', use: 'Household demographics and income' },
]

export type Row = Record<string, string | number | null>

const csvCell = (value: string | number | null): string => {
  if (value === null) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const toCsv = (rows: Row[]): string => {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h] ?? null)).join(','))
  }
  return lines.join('\n')
}

const CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'

/** Every endpoint is open data: allow cross-origin reads from notebooks and tools. */
const baseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': CACHE_CONTROL,
}

export const respond = (
  rows: Row[] | Record<string, unknown>,
  request: Request,
  filename = 'remittances'
): Response => {
  const format = new URL(request.url).searchParams.get('format')

  if (format === 'csv') {
    const data = Array.isArray(rows) ? rows : [rows as Row]
    return new Response(toCsv(data), {
      headers: {
        ...baseHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `inline; filename="${filename}.csv"`,
      },
    })
  }

  const body = Array.isArray(rows)
    ? { count: rows.length, unit: 'USD', data: rows }
    : rows

  return new Response(JSON.stringify(body, null, 2), {
    headers: { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export const badRequest = (message: string): Response =>
  new Response(JSON.stringify({ error: message }, null, 2), {
    status: 400,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json; charset=utf-8',
    },
  })

/** Reads `year`/`quarter` params and returns the key used in the JSON series. */
export const periodKey = (request: Request): { key: string; error?: string } => {
  const params = new URL(request.url).searchParams
  const year = params.get('year')
  const quarter = params.get('quarter')?.toUpperCase()

  if (!year) return { key: '', error: 'Missing required parameter: year' }
  if (!/^\d{4}$/.test(year)) return { key: '', error: `Invalid year: ${year}` }
  if (quarter && !/^Q[1-4]$/.test(quarter)) {
    return { key: '', error: `Invalid quarter: ${quarter} (expected Q1, Q2, Q3 or Q4)` }
  }

  return { key: quarter ? `${year}-${quarter}` : year }
}
