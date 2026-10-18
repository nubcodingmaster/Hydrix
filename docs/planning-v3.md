# Seasonal preparation and soil support

Updated October 18, 2026. `planning-v3` follows the requested distinction between preparing support and confirming an actual recipient. It supersedes the restrictive anomaly-only rainfall gate in v2. All proposals remain conditional; no current dataset verifies allocation, current planting or crop damage.

## Water readiness

Use the existing CHIRPS-derived seasonal projection, including low-confidence projections. A projection must have been issued within sixty days. Screen valid, nonnegative monthly estimates and ordered intervals. At least two consecutive point estimates below 100 mm/month trigger one proposal for the entire continuous dry run. Isolated low months, missing months and malformed intervals cannot form a run.

The 100 mm/month reference is grounded in [BMKG's monthly low-rainfall classification](https://www.bmkg.go.id/iklim/analisis-dinamika-atmosfer-dasarian-iii-juni-2020). The two-month trigger and three-month preparation lead time are application planning policies, not BMKG definitions of season onset or drought. Rainfall alone does not establish crop water demand, available irrigation, river flows or a water deficit.

Prepare three months before the first low-rainfall month, clamped to the current month. Show the full projected dry window separately from the preparation month. Screen all available future projection months before limiting preparation dates to the displayed twelve-month horizon. A late event can require preparation inside that horizon.

Suggested support includes canal inspection/repair, shared pump servicing, storage and delivery planning where appropriate. Active crops, water access and unmet demand determine actual recipients, equipment and volumes. Disclose low confidence, forecast intervals, model issue date and historical evaluation error. Several polygons may share a rainfall pixel; their proposals are not independent confirmations of damage. Recheck projections before procurement.

## Soil and fertilizer support

Screen the modeled 10 cm soil estimates for these specific signals:

- For recorded shallot locations, pH below 5.6 triggers acidity correction and fertilizer assessment. pH above 6.5 triggers nutrient-availability review without recommending lime. These crop thresholds are not applied to spring onion or garlic.
- Organic carbon below 20 g/kg (2%) triggers organic soil support review. This is a general soil-carbon screen, not proof of any NPK deficiency or a crop-specific application rate.
- Missing, nonfinite, impossible or incorrectly unit-labeled values cannot trigger proposals. Normal pH/carbon or the mere availability of soil coverage do not create proposals.

[Kementan's shallot cultivation guide](https://banten.brmp.pertanian.go.id/storage/assets/uploads/file/GeY2HQf382EJXVJsYRiE9ZwRfFwnHSw5fL8twqWy.pdf) describes checking acidity, liming below pH 5.6 and timing amendments before planting. [BRMP Tanah dan Pupuk](https://tanahpupuk.brmp.pertanian.go.id/berita/bpsi-tanah-dan-pupuk-hadir-dalam-webinar-standar-mutu-dan-mekanisme-pendaftaran-pupuk-organik) discusses low organic carbon below 2%. Applying these references to historical regional estimates is an assessment priority, not a current laboratory result.

The proposed government action is soil testing and extension support, followed by conditional dolomite/liming for confirmed acidity or mature compost/suitable organic fertilizer for confirmed low carbon. Lime is a soil amendment, not NPK fertilizer. Product choice and quantity require current pH, N, P and K results, soil class, variety and an actual planting schedule. [BRMP's PUTK example](https://sulteng.brmp.pertanian.go.id/berita/wabin-dilatih-cara-menentukan-dosis-pemupukan-spesifik-lokasi-untuk-komoditi-bawang-lokal-palu) illustrates deriving site-specific fertilizer rates from soil testing. Example rates for another field are not copied into HYDRIX.

Arrange soil sampling in the current month because no actual planting date is connected. Historical modeled soil periods remain visible. The snapshot supplies no measured NPK status, so the planner does not invent an NPK product, dose or fertilizer budget.

## Vegetation and AI

The recent, quality-controlled NDVI decline gate remains unchanged from v2. It requests crop inspection; it does not diagnose a pest.

Numeric evidence and dates remain deterministic and inspectable. Matching validated Gemini advice can supplement an eligible proposal, with an AI icon and provenance. AI cannot create an indicator, rewrite measurements, schedule a risk date or confirm eligibility. Cached water prose mentioning unmeasured hydrology is excluded from the planning action. The conditions above remain attached to water and soil advice.

## Calendar and validation

District, category, month, year and evidence-status filters remain available. Preparation proposals and confirmed assistance are separate views. No qualifying item means the connected evidence has not produced a proposal, not that the location is safe.

The October 18 snapshot produces 106 water-readiness proposals (36 in March 2027 and 70 in April 2027), 79 soil-assessment proposals and 12 crop inspections. These are 197 proposals across 106 historical locations, not 197 recipients. No organic-carbon proposal is triggered by this snapshot: its available carbon values are at least 20 g/kg.

Tests cover low-confidence readiness, contiguous runs, isolated/gapped/invalid/expired projections, late-event preparation, soil thresholds and units, missing values, avoiding lime on alkaline soil, AI grounding and month/year filtering. The twelve-month calendar remains October 2026 through September 2027 at this reference date.
