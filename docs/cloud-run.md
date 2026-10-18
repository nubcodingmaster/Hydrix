# Deploy HYDRIX to Cloud Run

Google Cloud project: `hydrix-512010` (HYDRIX). Suggested demo service: `hydrix`, region `us-central1`, request-based billing, minimum zero instances and maximum one instance.

The container serves the Vite production build with Nginx on Cloud Run's `PORT`. It includes published data snapshots. Gemini runs in the local data-generation workflow; no API key or service-account file is required by this website container. Source and Docker build contexts use explicit allowlists to exclude local credentials, caches, dependencies, and test artifacts. The Nginx configuration serves module workers with a JavaScript MIME type and allows SPA navigation.

After linking an active billing account, use Cloud Shell from this project:

```sh
git clone https://github.com/nubcodingmaster/Hydrix.git
cd Hydrix
gcloud run deploy hydrix \
  --project=hydrix-512010 \
  --region=us-central1 \
  --source=apps/web \
  --port=8080 \
  --cpu=1 \
  --memory=256Mi \
  --cpu-throttling \
  --min-instances=0 \
  --max-instances=1 \
  --no-allow-unauthenticated
```

The initial service requires authentication. Enable public access only after reviewing the service and approving that visitors may access the published website and data. Source deployment may request enabling APIs, creating the build repository, or assigning build permissions; review each requested grant.

Free-tier allowances are not a hard spending cap. Cloud Build, Artifact Registry, network egress, and excess Cloud Run usage can incur charges. Billing activation and payment details must be completed by the account owner. A budget alert provides notifications, not an automatic spending cutoff.

Local verification:

```sh
cd apps/web
npm run build
docker build -t hydrix-cloud-run .
docker run --rm -p 8080:8080 -e PORT=8080 hydrix-cloud-run
```

Check `/healthz`, the dashboard, data JSON responses, and the map worker's MIME type. Docker requires a running local Docker daemon. A successful Vite build alone does not verify the container or a deployed service.
