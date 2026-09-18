# Remittances API + MCP

Open API and MCP server for remittance flows between the United States and
Mexico: **$62.5B received in 2025**, broken down by 32 Mexican states, 2,488
municipalities and 51 US states of origin, quarterly from 2013.

No API key. No rate limit worth mentioning. JSON or CSV.

Data powers [remittances.mx](https://remittances.mx); docs live at
[remittances.mx/dashboard/api](https://remittances.mx/dashboard/api).

## Use it from an AI agent (MCP)

`src/server.mjs` is a Model Context Protocol server: one dependency-free Node
script speaking JSON-RPC over stdio.

```bash
git clone https://github.com/jp-pietrini/remittances-api-mcp.git
cd remittances-api-mcp
claude mcp add remittances -- node "$(pwd)/src/server.mjs"
```

Or for Claude Desktop, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "remittances": {
      "command": "node",
      "args": ["/absolute/path/to/remittances-api-mcp/src/server.mjs"]
    }
  }
}
```

Then ask things like *"which Mexican municipalities received the most
remittances in 2025?"* or *"chart quarterly remittances since 2019"*.

### Tools

| Tool | Returns |
| --- | --- |
| `get_coverage` | Periods available, counts, sources, endpoint list |
| `get_national_totals` | National series, yearly or quarterly |
| `get_mexico_states` | State ranking for one period |
| `get_mexico_state_timeseries` | One state (or all) over time |
| `get_mexico_municipalities` | Municipal ranking for one year |
| `get_us_states` | US sending states, with Mexican-born population |

Point the server at another deployment with `REMITTANCES_API_BASE`:

```bash
REMITTANCES_API_BASE=http://localhost:3000 node src/server.mjs
```

Check it works:

```bash
npm run smoke
```

## Use it from code (REST)

```bash
curl "https://remittances.mx/api/v1/meta"
curl "https://remittances.mx/api/v1/mexico/states?year=2025"
curl "https://remittances.mx/api/v1/mexico/municipalities?year=2025&state=Jalisco&limit=10"
curl "https://remittances.mx/api/v1/us/states?year=2024&format=csv"
```

```python
import pandas as pd

df = pd.read_csv(
    "https://remittances.mx/api/v1/national?freq=quarterly&format=csv"
)
```

| Endpoint | Parameters |
| --- | --- |
| `GET /api/v1/meta` | `format` |
| `GET /api/v1/national` | `freq=yearly\|quarterly`, `format` |
| `GET /api/v1/mexico/states` | `year` (required), `quarter`, `format` |
| `GET /api/v1/mexico/states/timeseries` | `state`, `freq`, `format` |
| `GET /api/v1/mexico/municipalities` | `year` (required), `state`, `limit`, `offset`, `format` |
| `GET /api/v1/us/states` | `year` (required), `quarter`, `format` |

Full description in [`api/openapi.yaml`](api/openapi.yaml). Every endpoint
accepts `format=csv` and sends permissive CORS headers, so a browser or
notebook can call it directly.

## Run the API yourself

`api/nextjs/` holds the reference implementation: Next.js App Router route
handlers plus the loading and formatting helpers they share. Drop them into a
Next.js project as

```
src/lib/api-data.ts
src/app/api/v1/meta/route.ts
src/app/api/v1/national/route.ts
src/app/api/v1/mexico/states/route.ts
src/app/api/v1/mexico/states/timeseries/route.ts
src/app/api/v1/mexico/municipalities/route.ts
src/app/api/v1/us/states/route.ts
```

and supply the source JSON in `public/data/` (`mexico_remittances.json`,
`mexico_muni_remittances.json`, `mexico_muni_names.json`, `us_remittances.json`,
`mexican_born_population.json`). The handlers import those files, so there is
no database and no filesystem access at request time.

## Data and caveats

| Source | Used for |
| --- | --- |
| Banco de México (via the DataMexico cube) | Remittances by Mexican state and municipality |
| Banco de México SIE | Remittances by US state of origin |
| US Census Bureau (ACS) | Mexican-born population by state |
| CONAPO | Migration intensity |
| INEGI (ENIGH, Census, ICMM) | Household demographics and income |

- All amounts are current USD.
- Mexican state and municipal series run to **2026-Q2**. US state-of-origin
  series run to **2025-Q3**: they come from a different Banco de México product
  and lag, so the two sides of the corridor can end on different periods.
- Municipal figures are annual only.
- The most recent calendar year is partial until all four quarters publish.
  Check `get_coverage` before computing year-over-year changes.
- Banco de México revises past quarters; totals shift slightly between pulls.

## Citation

> Pietrini, J.P. *US-Mexico Remittances Dashboard*. Available at
> [remittances.mx](https://remittances.mx).

Please also credit Banco de México, INEGI, CONAPO and the US Census Bureau.

## License

MIT. See [LICENSE](LICENSE).
