# Gemini integration verification

Verified locally on October 18, 2026.

## Scope

HYDRIX uses the direct Google Gemini API through an offline generator. The published snapshot contains distinct farmer and government summaries, three conditional crop assessments, and water, soil, and pest-monitoring proposals for 106 locations. Ten rainfall pixels have Gemini seasonal summaries. Numerical rainfall projections remain statistical estimates derived from CHIRPS.

The browser checks source fingerprints, model, prompt version, reference month, output structure, and claim guards before attaching analyses. Stale or unavailable analyses receive explicit fallback labels. The guards reject observed classes of unsupported crop certainty, NDVI causes, future streamflow or ET claims, and unsupported fixed scouting schedules. These checks do not prove every generated sentence correct.

## Repairs

- Corrected unsupported narrative fields through Gemini while preserving measurements and unrelated prose.
- Added checkpointing for validated corrections when another correction fails validation.
- Added regression coverage for actual published snapshot coverage and source fingerprints.
- Configured Playwright to start the local server automatically; a stopped preview previously caused `ERR_CONNECTION_REFUSED` in all browser tests.
- Resolved the MapLibre worker through Vite's asset pipeline. Its previous relative URL returned HTTP 404 after dependency optimization. Browser regression coverage now requires HTTP 200 for the worker.
- Preserved the requested UI removals, white sidebar, unified agronomy card, and commodity illustrations.

## Reproducible checks

From `apps/web`:

```sh
npm test
npm run build
npm run test:e2e
npm run data:ai
npm audit --omit=dev
```

Final results: 39 unit tests passed, six browser tests passed, and the production build succeeded with the worker emitted as an asset. The cache check reports 106/106 locations, 10/10 rainfall pixels, and zero new analyses. Unit coverage includes schema failures, cache invalidation, quota recovery, repair target restrictions, partial correction checkpoints, and snapshot consistency. Browser tests cover government planning, filtering, mobile layout, farmer location failure, agronomy observations, Gemini display across views, and explicit unavailable-data states. The controlled AI browser fixture is separate from the real published-snapshot test.

## Defensive API review

The API security review is limited to local source and artifact inspection. No authentication bypass, enumeration, rate-limit attack, destructive request, or penetration test was performed against Google or Kementan. Agent QA MCP and recorded Agent QA runs were unavailable; verification uses repository tests and their local failure evidence.

Credentials are read by Node from ignored `.env.local`; the browser loads public JSON snapshots and does not call Gemini. Requests use Google's fixed API origin, an authentication header, a timeout, and constrained output schemas. Generator failures retain earlier completed batches. A scan of tracked and non-ignored candidate files found no configured Gemini key or private-key material. Production dependency audit reported zero known vulnerabilities.

## Remaining limits

Vite reports a bundle-size warning. External API availability and quota remain outside local test guarantees. Analyses are cached snapshots and require regeneration when source inputs or the reference month change. Farmer groups remain unlinked; the integration does not invent recipients, fertilizer doses, pest diagnoses, or crop suitability guarantees.
