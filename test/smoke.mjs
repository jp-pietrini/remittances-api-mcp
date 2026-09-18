#!/usr/bin/env node
/**
 * Smoke test: drives the MCP server over stdio and checks that initialize,
 * tools/list and a tools/call round trip.
 *
 *   node test/smoke.mjs
 *   REMITTANCES_API_BASE=http://localhost:3000 node test/smoke.mjs
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const server = path.join(here, '..', 'src', 'server.mjs')

const requests = [
  { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke', version: '1.0.0' } } },
  { jsonrpc: '2.0', method: 'notifications/initialized' },
  { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_coverage', arguments: {} } },
]

const child = spawn('node', [server], { stdio: ['pipe', 'pipe', 'inherit'] })
const responses = []
let buffer = ''

child.stdout.setEncoding('utf8')
child.stdout.on('data', (chunk) => {
  buffer += chunk
  let newline
  while ((newline = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, newline).trim()
    buffer = buffer.slice(newline + 1)
    if (line) responses.push(JSON.parse(line))
  }
})

for (const request of requests) child.stdin.write(`${JSON.stringify(request)}\n`)
child.stdin.end()

child.on('close', () => {
  const failures = []

  const init = responses.find((r) => r.id === 1)
  if (init?.result?.serverInfo?.name !== 'remittances') {
    failures.push(`initialize did not identify the server: ${JSON.stringify(init)}`)
  }

  const list = responses.find((r) => r.id === 2)
  const names = list?.result?.tools?.map((t) => t.name) ?? []
  for (const expected of ['get_coverage', 'get_national_totals', 'get_mexico_states']) {
    if (!names.includes(expected)) failures.push(`tools/list is missing ${expected}`)
  }

  const call = responses.find((r) => r.id === 3)
  const text = call?.result?.content?.[0]?.text ?? ''
  if (call?.result?.isError) {
    failures.push(`get_coverage returned an error: ${text.slice(0, 200)}`)
  } else if (!text.includes('coverage')) {
    failures.push(`get_coverage payload looks wrong: ${text.slice(0, 200)}`)
  }

  if (failures.length > 0) {
    console.error('FAIL')
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exit(1)
  }

  console.log(`PASS  ${names.length} tools, coverage fetched`)
})
