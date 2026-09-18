import { mexicoStateData, respond, badRequest, type Row } from '@/lib/api-data'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const freq = params.get('freq') ?? 'quarterly'
  const state = params.get('state')

  if (freq !== 'yearly' && freq !== 'quarterly') {
    return badRequest(`Invalid freq: ${freq} (expected yearly or quarterly)`)
  }

  const series =
    freq === 'yearly' ? mexicoStateData.yearly : mexicoStateData.quarterly

  if (state && !series[state]) {
    return badRequest(
      `Unknown state: ${state}. Valid values: ${Object.keys(series).sort().join(', ')}`
    )
  }

  const states = state ? [state] : Object.keys(series).sort()
  const rows: Row[] = []
  for (const name of states) {
    for (const [period, amount] of Object.entries(series[name]).sort(([a], [b]) =>
      a.localeCompare(b)
    )) {
      rows.push({ state: name, period, amount_usd: Math.round(amount) })
    }
  }

  return respond(rows, request, `remittances_mx_timeseries_${freq}`)
}
