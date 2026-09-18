import { coverage, SOURCES, respond } from '@/lib/api-data'

export const dynamic = 'force-dynamic'

const ENDPOINTS = [
  {
    path: '/api/v1/meta',
    description: 'Coverage, sources and this endpoint list',
    params: [],
  },
  {
    path: '/api/v1/national',
    description: 'National remittance totals received by Mexico',
    params: ['freq=yearly|quarterly', 'format=json|csv'],
  },
  {
    path: '/api/v1/mexico/states',
    description: 'Remittances received by Mexican state for one period',
    params: ['year (required)', 'quarter=Q1..Q4', 'format=json|csv'],
  },
  {
    path: '/api/v1/mexico/states/timeseries',
    description: 'Full series for one Mexican state, or all states',
    params: ['state', 'freq=yearly|quarterly', 'format=json|csv'],
  },
  {
    path: '/api/v1/mexico/municipalities',
    description: 'Remittances received by municipality for one year',
    params: ['year (required)', 'state', 'limit', 'offset', 'format=json|csv'],
  },
  {
    path: '/api/v1/us/states',
    description: 'Remittances sent by US state, with Mexican-born population',
    params: ['year (required)', 'quarter=Q1..Q4', 'format=json|csv'],
  },
]

export async function GET(request: Request) {
  return respond(
    {
      name: 'US-Mexico Remittances API',
      version: 'v1',
      documentation: 'https://remittances.mx/dashboard/api',
      citation:
        'Pietrini, J.P. US-Mexico Remittances Dashboard. Available at remittances.mx',
      license: 'Open data. Attribute the original statistical agencies.',
      coverage: coverage(),
      sources: SOURCES,
      endpoints: ENDPOINTS,
    },
    request
  )
}
