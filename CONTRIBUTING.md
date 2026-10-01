# Contributing

Thanks for helping improve the remittances API and MCP server.

## Setup

No install step: the server is a single Node (>= 18) script with no
dependencies.

```bash
git clone https://github.com/jp-pietrini/remittances-api-mcp.git
cd remittances-api-mcp
npm run smoke
```

`npm run smoke` drives the server over stdio and checks `initialize`,
`tools/list` and a `tools/call` round trip. Point it at a local deployment with
`REMITTANCES_API_BASE=http://localhost:3000 npm run smoke`.

## Pull requests

- Keep changes focused; one concern per PR.
- If you add or change an MCP tool, update the tool table in the README and
  `api/openapi.yaml` when the REST surface changes too.
- Run `npm run smoke` before opening the PR. CI runs it on Node 18, 20 and 22.
- Data caveats (coverage periods, revisions) belong in the README's
  "Data and caveats" section.
