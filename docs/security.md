# Security boundaries

## Secrets and API access

Gemini requests originate in the data-generation job. The key is supplied by a local ignored environment file or an encrypted GitHub Actions secret. It is sent only in Google's API-key header to the fixed Gemini endpoint. Model identifiers are validated before use. Error messages expose status and validation context rather than upstream response bodies or credentials.

The public application contains snapshots, not credentials. Docker/source contexts use allowlists. GitHub publishing receives a short-lived job token only in its publish step, does not retain credentials and can stage only the generated analysis JSON. Concurrent changes cause a normal push failure rather than a force-push.

## Model trust boundary

Survey attributes and environmental evidence are untrusted JSON data in the user-content portion of the Gemini request. The trusted system instruction is separate. Gemini has no shell, database, browser, file-writing or recipient-approval tools. Returned content is not executed.

Output must match the expected location, crop, support and rainfall coverage. It can select evidence and action keys only from enumerations. Trusted provider/model/hash metadata is assigned by code, not copied from model output. Plain-text checks reject markup, control characters and instruction payloads; grounding checks reject selected unsupported causal or certainty claims. React renders text without interpreting model HTML.

These checks are layered safeguards, not proof that every natural-language claim is correct. Recommendations remain conditional. Numeric measurements, uncertainty, dates and eligibility screens are computed outside the LLM. No pest, nutrient deficiency, dose, irrigation deficit or confirmed recipient is established solely by an AI narrative.

## Availability and deployment

Validated cache entries are bound to source inputs, prompt version, model and reference month. Incomplete or stale results cannot pass the publication gate. A failed refresh retains the last successful deployed image. Public visitors cannot trigger model calls, so anonymous traffic cannot directly spend Gemini quota.

The Cloud Run runtime is in Jakarta (`asia-southeast2`), with request-based billing and bounded scaling. Cloud Build's trigger is `global`; the current image repository remains in `us-central1`. This is not an all-services APAC residency claim.

## Verification scope

The authorized review covers source inspection, local automated tests, normal Gemini generation and a GET health check of the Jakarta service. It excludes exploitation, scanning, load tests or attempts to access credentials on Google or Kementan systems. Regression tests cover output markup/instruction rejection, fixed endpoint configuration, credential separation, cache identity, malformed snapshots and incomplete AI publication. No third-party red-team service or intrusive production probe is used.
