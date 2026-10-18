# Evidence-gated monthly planning

Updated October 18, 2026. `planning-v2` replaces three automatic proposals for every survey location with explicit screening. The previous 318 cards described administrative readiness tasks; they were not evidence of 318 actual assistance needs.

## Decisions and calendar

The calendar covers twelve preparation months including the current month in Asia/Makassar. Filters select district, support category, calendar year and month. Cards are grouped by the month in which a review should take place; the observed period or future signal window is shown separately. Signals are not copied into every future month.

Field checks and confirmed assistance are separate views. Current connected snapshots contain no field-confirmed damage, assistance eligibility or recipients. Every generated check therefore remains unconfirmed. No AI narrative can create eligibility or a confirmed threat. Historical soil coverage and recent warm/humid weather alone no longer create proposals.

## Vegetation screening

A current-month field check requires all of the following:

- Previous NDVI at least 0.3, absolute decline at least 0.15, and relative decline at least 30%.
- Valid coverage at least 80% in both windows, extraction minimum three observations, and mean observations at least three.
- Finite, bounded measurements; non-overlapping comparable observation periods.
- Current period ending within thirty days, previous period ending within ninety days, and no future observations.

These are transparent pilot triage cutoffs, not calibrated crop-loss, pest or agronomic thresholds. The check asks extension staff to distinguish harvest, crop stage, water access and visible damage. It does not assign fertilizer, pesticides or aid recipients. The [NASA vegetation overview](https://science.nasa.gov/earth/earth-observatory/measuring-vegetation-ndvi-evi/) explains the vegetation index; NASA does not endorse these pilot cutoffs.

## Rainfall screening

A water-readiness check requires a projection issued within sixty days, medium or high model confidence, at least twenty valid historical same-month observations, and two consecutive projected intervals entirely below 80% of their corresponding historical medians. A continuous run creates one check at its start. The suggested preparation date is three months earlier, clamped to the current month.

The shared same-month historical comparison is consistent with the AI input's experimental anomaly logic. Current low-confidence seasonal projections cannot generate water checks. A usual annual dry month alone is insufficient. These rules do not establish irrigation failure, crop water requirements or drought damage. [CHIRPS](https://chc.ucsb.edu/data/chirps) provides regional rainfall context, and multiple polygons may share a pixel. The screening policy is not an official CHC or BMKG warning.

## AI and evidence

The numeric signal, eligibility and review date remain deterministic and inspectable. A matching, validated Gemini interpretation can supply a qualifying vegetation check's action. Existing cached water advice targets the previous lowest-rainfall policy, so it is not reused as an anomaly-specific action. No API key or additional model call is needed for these changes.

The UI labels an AI action with a sparkle icon. Exact indicators, periods, provenance and the pilot policy remain under Why this check. Model branding is omitted from the suggested-support label. Crop-candidate and source-quality sidebar entries are removed; source metadata remains available through the help control and evidence links. Farmer crop cards retain conditional assessments while omitting the repeated Missing data blocks.

No qualifying signal does not prove safety. An empty future month means the connected evidence has not established a schedulable check; it is not a prediction of zero agricultural risk.

## Verification

Unit tests exercise no automatic proposals from data availability, NDVI quality/freshness/period rejection, low-confidence and uncertain rainfall rejection, consecutive signals, sparse history, expiry, year boundaries, and AI's inability to create eligibility. Browser tests cover the twelve-month layout, month/year filtering and reset, district/category filters, separate confirmed status, map navigation, neutral card borders, AI icon, hidden sidebar entries, and removal of repeated crop-data blocks.
