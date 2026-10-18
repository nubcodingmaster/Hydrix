# Automatic Gemini analysis

The application is a static dashboard with a private generation pipeline. Visitors never receive a Gemini credential or an endpoint that can spend API quota.

## Triggers and schedule

`.github/workflows/refresh-ai.yml` runs after changes to published source snapshots, the shared planning policy or AI generation code. It also checks daily at 21:17 UTC, approximately 05:17 Asia/Makassar. Scheduled GitHub jobs may be delayed. A manual workflow dispatch is available for maintenance.

This is an analysis-refresh schedule, not an automatic refresh of Kementan, satellite or weather observations. Run the separate `data:sync` pipeline to acquire new source data with the necessary Earth Engine authorization. The AI cannot turn historical source dates into current measurements.

## Processing

1. Install the locked dependencies and verify that source snapshots share the same base version and cover every location.
2. Build a fingerprint of each location's approved input fields, model, prompt version and reference month.
3. Check the configured key/model through Google's authenticated tokenizer endpoint, then reuse current validated analyses. Generate only missing or changed location analyses and rainfall summaries through the fixed Google Gemini endpoint. A tokenizer check verifies connectivity and configuration, not new text generation; cache-only runs explicitly report zero new analyses.
4. Validate exact location/crop/support coverage, enumerated evidence keys, plain text, unsupported-claim checks and trusted provenance. Save successful batches locally to permit retries.
5. Require complete current coverage, run tests and build the application before publishing.
6. Commit only `apps/web/public/data/analysis.json` using the job's short-lived token. Refuse unrelated changes and never force-push. The existing Cloud Build trigger deploys the commit to Jakarta.

If generation fails or quota is exhausted, the workflow fails visibly and does not commit partial results. Cloud Build also checks AI coverage before publishing a new image, so source changes without corresponding AI cannot replace the last successful deployment. Workflows use concurrency control to prevent overlapping scheduled publication.

## Repository configuration

- Actions secret `GEMINI_API_KEY`: the Google AI Studio credential.
- Actions variable `GEMINI_MODEL`: the user's configured model identifier.
- The refresh job has repository contents-write permission only to publish the generated snapshot. Verification jobs are read-only. Fork pull requests do not receive generation secrets or publishing access.
- Official checkout and Node setup actions are pinned to verified commit hashes; checkout does not retain Git credentials. Only the publish step receives the GitHub token. The Gemini step receives only its Gemini configuration.

The key must be added through the repository's encrypted Actions secret settings, never committed or prefixed with `VITE_`. A workflow change by a trusted collaborator can use repository secrets, so repository write/admin access remains a trust boundary. No claim is made that automated checks defeat all prompt injection.

GitHub requires a nonempty value when creating a repository secret. Preparing a name in the form does not create or activate that secret. The repository owner can enter the value directly in [Actions secrets](https://github.com/nubcodingmaster/Hydrix/settings/secrets/actions).

### Configuration inventory

| Name | Where it belongs | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | GitHub Actions repository secret | Required for automatic AI generation |
| `GEMINI_MODEL` | GitHub Actions repository variable | Model identifier; currently `gemini-3.8-flash` |
| `EARTH_ENGINE_PROJECT` | Local environment; repository variable if a source-acquisition job is later added | Registered Earth Engine project; not a credential |
| `GOOGLE_APPLICATION_CREDENTIALS` | Local environment | Path to a service-account JSON file; a laptop path cannot be used on a GitHub runner |
| `EARTH_ENGINE_ACCESS_TOKEN` | Local environment only for temporary extraction | Expiring alternative to the service-account file; unsuitable for a durable scheduled setup |
| `GITHUB_TOKEN` | Automatically supplied by GitHub | Short-lived publication token; do not create a personal-token secret |

The current scheduled job consumes only the Gemini secret and model variable. Earth Engine credentials are not uploaded to Cloud Run or GitHub by this setup. Source acquisition remains a separate local workflow. The Cloud Build GitHub App connection handles deployment without a new service-account key in the repository.

## Operator checks

```sh
cd apps/web
npm run data:verify
npm run data:ai
npm run data:verify:ai
npm test
npm run build
```

`data:verify` reports source identity and current AI coverage. `data:verify:ai` fails unless every location and rainfall pixel has a matching, validated analysis. It checks identity and structure; source observation dates and agronomic quality remain visible and require domain review.

API timeouts and bounded retries cover temporary limits. Malformed responses, unsupported output and persistent quota failures remain failures. A static rule-based fallback is explicitly labeled when an analysis cannot be attached; it is never relabeled as a Gemini result.
