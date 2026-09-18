import {
  usStateData,
  mexicanBornByState,
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
  const series = isQuarter ? usStateData.quarterly : usStateData.yearly

  // Source series are in millions of USD; the API reports plain USD.
  const rows: Row[] = Object.entries(series)
    .map(([state, periods]) => ({
      state,
      period: key,
      amount_usd: periods[key] != null ? Math.round(periods[key] * 1e6) : null,
      mexican_born_population: mexicanBornByState[state] ?? null,
    }))
    .filter((row) => row.amount_usd !== null)
    .sort((a, b) => (b.amount_usd as number) - (a.amount_usd as number))

  if (rows.length === 0) return badRequest(`No data for period ${key}`)

  return respond(rows, request, `remittances_us_states_${key}`)
}
