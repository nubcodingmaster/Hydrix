# HYDRIX data and application methods

See the [project README](../../README.md) for the project overview, the [planning policy](../../docs/planning-v3.md) for support screening, and [AI automation](../../docs/ai-automation.md) for generation and publication.

## Run the dashboard

From this directory, install Node.js 22 dependencies and start the local application:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/` for government planning or `http://127.0.0.1:5173/?view=farmer` for the farmer page. Published snapshots require no API key to display. Local generation uses the ignored `.env.local`; `.env.example` lists configuration names without credentials.

## Source pipeline

Node.js 22 and Python 3 are required. Python uses its standard library for NOAA HTTP transport. Source extraction and modeling run in Node. Published snapshots let the dashboard run without credentials.

```sh
npm run data:base
npm run data:environment
npm run data:history
npm run data:project
npm run data:earth-engine
npm run data:ai
npm run data:verify:ai
```

`data:sync` runs this sequence. Source acquisition is separate from the change-triggered AI interpretation job. Snapshot writes use temporary files and atomic renames. Failed providers do not produce invented observations; compatible cached layers retain their original dates and are labeled accordingly.

## Survey and rainfall

The pilot contains 105 shallot polygons and one spring-onion polygon from Kementan. Survey attributes date from 2019. Garlic records containing test attributes are excluded. Owner, farmer and surveyor names are not requested. Geometry checks use the Majalengka bounding region, not a formal administrative boundary. Calculated polygon area is not reported planted area.

CHIRPS v2 observations cover September 2025 through August 2026 in the current snapshot. Sampling uses native 0.05-degree pixels at polygon bounding-box centers; plots sharing a pixel share its values. These are regional estimates, not field sensors or polygon means.

The NOAA mirror supplies complete historical years from 1991 through 2024. The model also uses the latest twelve observed months, totaling 420 monthly observations per pixel. January through August 2025 are absent. History does not fill that gap or mix in projections.

## Seasonal projection

The projection covers twelve full months after issuance, using Asia/Makassar. It is a statistical seasonal estimate, not a daily weather forecast or official BMKG warning.

Calendar-month medians and harmonic ridge regression are compared using hindcasts from 2010–2014. Absolute errors from 2015–2019 calibrate nominal eighty-percent intervals; 2020–2024 provides later evaluation. Each hindcast uses only earlier training data. Calendar-month medians win across the ten pilot pixels. Evaluation MAE ranges from 59.5 to 88.9 mm/month, and empirical interval coverage from 71.7 to 90 percent. ENSO, sea-surface-temperature and future atmospheric circulation are not model inputs.

Calendar dates within one month share that month's total. Color indicates relative rainfall, not confirmed drought or crop damage. Forecast intervals and confidence remain visible.

## Soil, weather and vegetation

Earth Engine extraction uses a registered project and read-only authorization. Local configuration accepts `EARTH_ENGINE_PROJECT` plus a service-account file path in `GOOGLE_APPLICATION_CREDENTIALS`, or an expiring `EARTH_ENGINE_ACCESS_TOKEN`. Keep credential files outside Git. The service-account path is a local path, not a portable GitHub secret value.

- OpenLandMap estimates pH, organic carbon and texture at 0, 10 and 30 cm with 250 m regional pixels. These are historical modeled estimates, not laboratory nutrient measurements. pH is divided by ten, carbon is converted to g/kg, and texture uses the polygon modal class.
- ERA5-Land provides a dated thirty-day weather window. Missing hours remain missing; the extraction accepts at least 648 of 720 hours and reports actual coverage. Relative humidity is derived from temperature and dew point. This is reanalysis context, not a future weather forecast.
- Sentinel-2 NDVI uses cloud masking and SCL classes 4, 5 and 6. Each pixel requires at least three valid observations. Extraction requires at least fifty-percent coverage; planning applies the stricter eighty-percent gate to comparable windows. A decline does not diagnose a pest or prove its cause.
- WaPOR actual ET is a ten-day mean in mm/day with raster scale 0.1 and a 0.0029296875-degree grid. Reference ET is daily, with scale 0.1 and a coarser regional grid. Their differing periods and resolutions are not treated as a direct water balance or ratio. Neither measures soil moisture.
- WorldCereal provides historical 2021 temporary-crop cover and class confidence at 10 m; it does not establish current crop identity or suitability.

The frontend rejects incompatible base versions and malformed agronomy values. Published source dates remain available. Assistance recipients, field-confirmed threats, soil NPK results and application rates are unavailable; the app does not invent them.

## Gemini and verification

Gemini reads approved structured facts and supplies separate farmer and government explanations, conditional crop assessments, support narratives and rainfall summaries. Numerical projections remain statistical. Plot geometry and center coordinates are omitted from Gemini inputs. The shared planning policy supplies the same dry-season window and soil review month to both the generator and dashboard.

Input fingerprints, model, prompt version and reference month determine cache validity. Schema, coverage, plaintext and unsupported-claim checks reject malformed output. Valid batches are checkpointed; a failed batch preserves progress for a later resume. Complete current coverage is required before deployment. These guards constrain output but do not prove every sentence agronomically correct.

```sh
npm run data:verify
npm test
npm run build
npm run test:e2e
```

Playwright uses installed Chrome on macOS and managed Chromium on Linux. Screenshots and reports remain local. beUI components retain their source attribution. MapLibre serves OpenStreetMap with attribution; its module worker is emitted by Vite. The production build currently reports a bundle-size warning.
