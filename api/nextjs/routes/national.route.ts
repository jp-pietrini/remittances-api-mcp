import { mexicoStateData, respond, badRequest, type Row } from '@/lib/api-data'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const freq = new URL(request.url).searchParams.get('freq') ?? 'yearly'
  if (freq !== 'yearly' && freq !== 'quarterly') {
    return badRequest(`Invalid freq: ${freq} (expected yearly or quarterly)`)
  }

  const series =
    freq === 'yearly' ? mexicoStateData.yearly : mexicoStateData.quarterly

  const totals = new Map<string, number>()
  for (const periods of Object.values(series)) {
    for (const [period, amount] of Object.entries(periods)) {
      totals.set(period, (totals.get(period) ?? 0) + amount)
    }
  }

  const rows: Row[] = [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, amount]) => ({ period, amount_usd: Math.round(amount) }))

  return respond(rows, request, `remittances_national_${freq}`)
}
