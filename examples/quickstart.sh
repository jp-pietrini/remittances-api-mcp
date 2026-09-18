#!/usr/bin/env bash
# Pull remittance data with curl. No API key needed.
set -euo pipefail

BASE="${REMITTANCES_API_BASE:-https://remittances.mx}"

echo "== Coverage and sources"
curl -s "$BASE/api/v1/meta" | head -40

echo "== National totals per year (USD)"
curl -s "$BASE/api/v1/national?freq=yearly&format=csv"

echo "== Top receiving states, 2025"
curl -s "$BASE/api/v1/mexico/states?year=2025&format=csv" | head -11

echo "== Top 10 municipalities in Jalisco, 2025"
curl -s "$BASE/api/v1/mexico/municipalities?year=2025&state=Jalisco&limit=10&format=csv"

echo "== US sending states, 2024"
curl -s "$BASE/api/v1/us/states?year=2024&format=csv" | head -11
