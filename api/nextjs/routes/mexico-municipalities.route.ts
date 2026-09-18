import {
  mexicoMuniData,
  muniNameByCode,
  STATE_NAME_BY_CODE,
  periodKey,
  respond,
  badRequest,
  type Row,
} from '@/lib/api-data'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 2500

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const { key, error } = periodKey(request)
  if (error) return badRequest(error)
  if (key.includes('-Q')) {
    return badRequest(
      'Municipal data is published yearly only; omit the quarter parameter'
    )
  }

  const stateFilter = params.get('state')
  const limit = Math.min(Number(params.get('limit') ?? DEFAULT_LIMIT), MAX_LIMIT)
  const offset = Math.max(Number(params.get('offset') ?? 0), 0)

  if (!Number.isFinite(limit) || limit <= 0) {
    return badRequest(`Invalid limit: ${params.get('limit')}`)
  }

  const all: Row[] = Object.entries(mexicoMuniData.yearly)
    .map(([code, years]) => {
      const stateCode = code.slice(2, 4)
      return {
        code,
        municipality: muniNameByCode[code] ?? null,
        state: STATE_NAME_BY_CODE[stateCode] ?? null,
        year: Number(key),
        amount_usd: years[key] != null ? Math.round(years[key]) : null,
      }
    })
    .filter((row) => row.amount_usd !== null)
    .filter((row) => !stateFilter || row.state === stateFilter)
    .sort((a, b) => (b.amount_usd as number) - (a.amount_usd as number))

  if (all.length === 0) {
    return badRequest(
      stateFilter
        ? `No data for state ${stateFilter} in ${key}`
        : `No data for year ${key}`
    )
  }

  return respond(
    all.slice(offset, offset + limit),
    request,
    `remittances_mx_municipalities_${key}`
  )
}
