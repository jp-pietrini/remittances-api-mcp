import {
  mexicoStateData,
  periodKey,
  respond,
  badRequest,
  type Row,
} from '@/lib/api-data'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { key, error } = periodKey(request)
  if (error) return badRequest(error)

  const isQuarter = key.includes('-Q')
  const series = isQuarter ? mexicoStateData.quarterly : mexicoStateData.yearly

  const rows: Row[] = Object.entries(series)
    .map(([state, periods]) => ({
      state,
      period: key,
      amount_usd: periods[key] != null ? Math.round(periods[key]) : null,
    }))
    .filter((row) => row.amount_usd !== null)
    .sort((a, b) => (b.amount_usd as number) - (a.amount_usd as number))

  if (rows.length === 0) return badRequest(`No data for period ${key}`)

  return respond(rows, request, `remittances_mx_states_${key}`)
}
