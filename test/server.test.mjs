/**
 * Offline tests: run the MCP server against a local mock of the REST API, so
 * they need no network and no remittances.mx deployment.
 *
 *   npm test
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const server = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'server.mjs')

let mock
let base

before(async () => {
  mock = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.url.startsWith('/api/v1/fail')) {
      res.statusCode = 500
      res.end('{"error":"boom"}')
      return
    }
    res.end(JSON.stringify({ path: req.url }))
  })
  await new Promise((resolve) => mock.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${mock.address().port}`
})

after(() => mock.close())

// Send requests to a fresh server process and collect every response by id.
function rpc(requests, apiBase = base) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [server], {
      env: { ...process.env, REMITTANCES_API_BASE: apiBase },
      stdio: ['pipe', 'pipe', 'inherit'],
    })
    let out = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => (out += chunk))
    child.on('error', reject)
    child.on('close', () => {
      resolve(out.split('\n').filter(Boolean).map((line) => JSON.parse(line)))
    })
    for (const request of requests) {
      child.stdin.write(typeof request === 'string' ? `${request}\n` : `${JSON.stringify(request)}\n`)
    }
    child.stdin.end()
  })
}

const call = (name, args, apiBase) =>
  rpc([{ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }], apiBase)
    .then(([response]) => response.result)

test('initialize reports the tools capability', async () => {
  const [response] = await rpc([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
  ])
  assert.equal(response.result.serverInfo.name, 'remittances')
  assert.deepEqual(response.result.capabilities, { tools: {} })
})

test('tools/list exposes the six tools without internal fields', async () => {
  const [response] = await rpc([{ jsonrpc: '2.0', id: 1, method: 'tools/list' }])
  const names = response.result.tools.map((tool) => tool.name)
  assert.deepEqual(names, [
    'get_coverage',
    'get_national_totals',
    'get_mexico_states',
    'get_mexico_state_timeseries',
    'get_mexico_municipalities',
    'get_us_states',
  ])
  for (const tool of response.result.tools) assert.equal(tool.path, undefined)
})

test('get_mexico_states builds the year and quarter query', async () => {
  const result = await call('get_mexico_states', { year: 2025, quarter: 'Q2' })
  assert.equal(JSON.parse(result.content[0].text).path, '/api/v1/mexico/states?year=2025&quarter=Q2')
})

test('state names are URL-encoded', async () => {
  const result = await call('get_mexico_state_timeseries', { state: 'Michoacán de Ocampo' })
  assert.match(JSON.parse(result.content[0].text).path, /state=Michoac%C3%A1n%20de%20Ocampo$/)
})

test('missing required year is rejected before any request', async () => {
  const result = await call('get_mexico_states', {})
  assert.equal(result.isError, true)
  assert.match(result.content[0].text, /Missing required argument "year"/)
})

test('invalid enum and non-integer values are rejected', async () => {
  const quarter = await call('get_us_states', { year: 2024, quarter: 'Q5' })
  assert.equal(quarter.isError, true)
  const year = await call('get_us_states', { year: '2024' })
  assert.equal(year.isError, true)
  assert.match(year.content[0].text, /must be an integer/)
})

test('unknown arguments are rejected', async () => {
  const result = await call('get_coverage', { verbose: true })
  assert.equal(result.isError, true)
  assert.match(result.content[0].text, /Unknown argument "verbose"/)
})

test('an unreachable API comes back as a tool error, not a protocol error', async () => {
  const result = await call('get_coverage', {}, 'http://127.0.0.1:1')
  assert.equal(result.isError, true)
  assert.match(result.content[0].text, /failed/)
})

test('unknown methods and bad JSON get JSON-RPC errors', async () => {
  const responses = await rpc([
    { jsonrpc: '2.0', id: 7, method: 'nope' },
    'not json',
  ])
  const byId = new Map(responses.map((r) => [r.id, r]))
  assert.equal(byId.get(7).error.code, -32601)
  assert.equal(byId.get(null).error.code, -32700)
})

test('notifications get no response', async () => {
  const responses = await rpc([{ jsonrpc: '2.0', method: 'notifications/initialized' }])
  assert.equal(responses.length, 0)
})
