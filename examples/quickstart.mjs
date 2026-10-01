#!/usr/bin/env node
/**
 * Pull remittance data from Node 18+ with the built-in fetch. No dependencies.
 *
 *   node examples/quickstart.mjs
 */
const BASE = (process.env.REMITTANCES_API_BASE || 'https://remittances.mx').replace(/\/$/, '')

async function get(path) {
  const response = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`${path} failed (${response.status})`)
  return response.json()
}

const meta = await get('/api/v1/meta')
console.log('Endpoints:', Object.keys(meta.endpoints ?? meta).slice(0, 6).join(', '))

const national = await get('/api/v1/national?freq=yearly')
const rows = national.data ?? national
console.log('\nLast 3 years received by Mexico (USD bn):')
for (const row of rows.slice(-3)) {
  const amount = row.amount_usd ?? row.amount
  console.log(`  ${row.period ?? row.year}: ${(amount / 1e9).toFixed(1)}`)
}
