#!/usr/bin/env node
/**
 * MCP server for the US-Mexico Remittances dataset.
 *
 * Wraps the public REST API (see /dashboard/api) as MCP tools so an agent can
 * pull remittance tables directly. Speaks JSON-RPC 2.0 over stdio and has no
 * dependencies, so it runs with plain `node`.
 *
 *   claude mcp add remittances -- node /absolute/path/to/remittances-api-mcp/src/server.mjs
 *
 * Set REMITTANCES_API_BASE to point at a different deployment
 * (default: https://remittances.mx).
 */

const BASE = (process.env.REMITTANCES_API_BASE || 'https://remittances.mx').replace(/\/$/, '')
const SERVER_INFO = { name: 'remittances', version: '1.0.0' }
const PROTOCOL_VERSION = '2024-11-05'
const REQUEST_TIMEOUT_MS = 30_000

const TOOLS = [
  {
    name: 'get_coverage',
    description:
      'Coverage of the US-Mexico remittances dataset: first and last quarter available, ' +
      'state and municipality counts, sources, and the list of API endpoints. Call this ' +
      'first to learn which periods can be requested.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    path: () => '/api/v1/meta',
  },
  {
    name: 'get_national_totals',
    description:
      'Total remittances received by Mexico per period, in USD. Use freq=quarterly for ' +
      'the quarterly series or freq=yearly for annual totals (the most recent year may be partial).',
    inputSchema: {
      type: 'object',
      properties: {
        freq: { type: 'string', enum: ['yearly', 'quarterly'], default: 'yearly' },
      },
      additionalProperties: false,
    },
    path: (args) => `/api/v1/national?freq=${args.freq || 'yearly'}`,
  },
  {
    name: 'get_mexico_states',
    description:
      'Remittances received by each of the 32 Mexican states for one period, ranked by ' +
      'amount. Pass a year for the annual total, or a year plus quarter (Q1-Q4) for one quarter.',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'integer', description: 'Calendar year, e.g. 2025' },
        quarter: { type: 'string', enum: ['Q1', 'Q2', 'Q3', 'Q4'] },
      },
      required: ['year'],
      additionalProperties: false,
    },
    path: (args) =>
      `/api/v1/mexico/states?year=${args.year}${args.quarter ? `&quarter=${args.quarter}` : ''}`,
  },
  {
    name: 'get_mexico_state_timeseries',
    description:
      'Full remittance time series for one Mexican state (or every state when state is ' +
      'omitted). Use the exact state name from get_mexico_states, e.g. "Michoacán de Ocampo".',
    inputSchema: {
      type: 'object',
      properties: {
        state: { type: 'string', description: 'Mexican state name; omit for all states' },
        freq: { type: 'string', enum: ['yearly', 'quarterly'], default: 'quarterly' },
      },
      additionalProperties: false,
    },
    path: (args) =>
      `/api/v1/mexico/states/timeseries?freq=${args.freq || 'quarterly'}` +
      (args.state ? `&state=${encodeURIComponent(args.state)}` : ''),
  },
  {
    name: 'get_mexico_municipalities',
    description:
      'Remittances received by Mexican municipality for one year, ranked by amount. ' +
      'Filter to one state with state, and page through results with limit and offset. ' +
      'Municipal data is annual only.',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'integer', description: 'Calendar year, e.g. 2025' },
        state: { type: 'string', description: 'Restrict to one state' },
        limit: { type: 'integer', default: 100, maximum: 2500 },
        offset: { type: 'integer', default: 0 },
      },
      required: ['year'],
      additionalProperties: false,
    },
    path: (args) =>
      `/api/v1/mexico/municipalities?year=${args.year}` +
      (args.state ? `&state=${encodeURIComponent(args.state)}` : '') +
      (args.limit ? `&limit=${args.limit}` : '') +
      (args.offset ? `&offset=${args.offset}` : ''),
  },
  {
    name: 'get_us_states',
    description:
      'Remittances sent from each US state for one period, with the Mexican-born ' +
      'population of that state. The US-origin series lags the Mexican series by a quarter or two.',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'integer', description: 'Calendar year, e.g. 2024' },
        quarter: { type: 'string', enum: ['Q1', 'Q2', 'Q3', 'Q4'] },
      },
      required: ['year'],
      additionalProperties: false,
    },
    path: (args) =>
      `/api/v1/us/states?year=${args.year}${args.quarter ? `&quarter=${args.quarter}` : ''}`,
  },
]

const toolByName = new Map(TOOLS.map((t) => [t.name, t]))

async function callTool(name, args) {
  const tool = toolByName.get(name)
  if (!tool) throw new Error(`Unknown tool: ${name}`)

  const url = `${BASE}${tool.path(args || {})}`
  let response
  let body
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    body = await response.text()
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Request to ${url} failed: ${err.message}` }],
      isError: true,
    }
  }

  if (!response.ok) {
    return {
      content: [{ type: 'text', text: `Request to ${url} failed (${response.status}): ${body}` }],
      isError: true,
    }
  }

  return { content: [{ type: 'text', text: body }] }
}

function handle(request) {
  const { method, params } = request

  if (method === 'initialize') {
    return {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    }
  }

  if (method === 'tools/list') {
    return {
      tools: TOOLS.map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      })),
    }
  }

  if (method === 'tools/call') {
    return callTool(params?.name, params?.arguments)
  }

  if (method === 'ping') return {}

  const error = new Error(`Method not found: ${method}`)
  error.code = -32601
  throw error
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

let buffer = ''
let pending = 0
let draining = false
let stdinClosed = false

// Exit only once stdin is done, the buffer is drained and every in-flight
// request has answered; exiting on 'end' alone drops pending tool calls.
const maybeExit = () => {
  if (stdinClosed && !draining && pending === 0) process.exit(0)
}

process.stdin.setEncoding('utf8')
process.stdin.on('data', async (chunk) => {
  buffer += chunk
  draining = true
  let newline
  while ((newline = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, newline).trim()
    buffer = buffer.slice(newline + 1)
    if (!line) continue

    let request
    try {
      request = JSON.parse(line)
    } catch {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
      continue
    }

    // Notifications (no id) expect no response.
    const isNotification = request.id === undefined || request.id === null

    pending += 1
    try {
      const result = await handle(request)
      if (!isNotification) send({ jsonrpc: '2.0', id: request.id, result })
    } catch (err) {
      if (!isNotification) {
        send({
          jsonrpc: '2.0',
          id: request.id,
          error: { code: err.code ?? -32603, message: err.message },
        })
      }
    } finally {
      pending -= 1
      maybeExit()
    }
  }

  draining = false
  maybeExit()
})

process.stdin.on('end', () => {
  stdinClosed = true
  maybeExit()
})
