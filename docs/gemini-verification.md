# Gemini verification

Verification work dated October 19, 2026 (Asia/Makassar).

## What judges can verify

The public Jakarta dashboard serves validated, generated analysis snapshots. Opening a page does not invoke Gemini. Judges can select survey locations, inspect farmer and government explanations, review the preparation calendar and open each proposal's evidence. Numerical observations, intervals, preparation dates and eligibility come from source data and the shared planning policy, not from invented AI measurements.

The [Refresh AI analysis workflow](https://github.com/nubcodingmaster/Hydrix/actions/workflows/refresh-ai.yml) provides an operational trail. It checks the configured Google key/model with an authenticated tokenizer request, generates missing or changed analyses, validates complete current coverage and runs application tests before publication. A cache-only run reports zero new analyses; the tokenizer check verifies connectivity rather than new text generation. Actual generation logs identify completed batches. A displayed Gemini label alone is not proof of a live request.

Published `analysis.json` records the model, generation timestamps, prompt version and source fingerprints. These are assigned by trusted generator code. They support traceability; they are not cryptographic attestations from Google. Google AI Studio usage can be shown privately by the account owner if judges request provider-side evidence. Credentials should never be disclosed to judges or committed to the repository.

## Reproducible checks

From `apps/web`:

```sh
npm run data:verify
npm run data:ai -- --check-connection
npm run data:verify:ai
npm test
npm run build
npm run test:e2e
```

The published-snapshot regression checks real analysis coverage and matching input fingerprints. Controlled AI browser fixtures test display and failure behavior separately; they are not published as provider-generated observations. Agent QA MCP was unavailable, so evidence comes from repository tests, actual provider generation and browser inspection.

Local results: 53 unit tests passed, six browser tests passed and the production build succeeded. Strict verification accepted all 106 locations and ten rainfall pixels. A subsequent authenticated connection/cache check returned the configured model, zero new analyses and an unchanged SHA-256 for `analysis.json`. No configured Gemini key was found in tracked or non-ignored publication candidates. These local results do not substitute for the separate GitHub and Cloud Build run statuses.

## Issues addressed

- AI and dashboard planning now share the first qualifying consecutive dry window, preparation lead time and current soil review month.
- Plaintext and unsupported-claim validation is shared between generator and browser attachment.
- Invalid model paths cannot redirect requests away from Google's fixed API origin. Credentials use an authentication header and never enter model facts.
- Source and AI coverage gates prevent partial or incompatible snapshots from being published.
- A live generation batch exceeded Google's output limit. Valid progress was retained, and the default batch was reduced from eight to four locations before resuming.
- Current-cache refreshes retain the original timestamp, preventing unnecessary data commits and deployments when no analysis changes.
- The Jakarta service initially required IAM login. Public access was explicitly approved, enabled and verified with an unauthenticated dashboard HTTP 200 and 106 loaded survey locations.
- The former `/healthz` path returned Google's frontend 404. The container endpoint is now `/health`, avoiding Cloud Run's reserved paths ending in `z`.
- Unused component examples and generated review screenshots were removed from the tracked repository. Unrelated local output was preserved.

## Limits

The security review is defensive and local. No exploitation, scanning, load test, credential-access attempt or production red-team exercise was performed against Google or Kementan. Plaintext and claim guards do not prove every sentence correct or defeat every prompt injection.

Vite reports a bundle-size warning. External quota and service availability remain outside test guarantees. Source acquisition is separate from the automatic AI interpretation schedule; dates are not relabeled as fresh observations. There are no field-confirmed aid recipients, pest diagnoses or soil NPK application rates in the connected data.
