# Product Publisher deployment for team use

## Deployment decision

The production deployment is intentionally split:

```text
Team browser
    |
    v
Vercel: React/Vite frontend
    |
    v
Persistent Node host: Fastify API  ---> S3/R2-compatible media storage
    |                                      ^
    v                                      |
Managed PostgreSQL <--- Persistent Node worker
    |
    v
Shopify Admin GraphQL API
```

Only the React frontend is deployed to Vercel. The API and worker use the same
Docker image but run as two separate services:

- API command: `npm run start:api`
- Worker command: `npm run start:worker`

This boundary is required by the current product workflow:

- A product upload can contain two files of up to 25 MB each. Vercel Functions
  limit request and response bodies to 4.5 MB.
- The worker is a continuous PostgreSQL queue poller. Vercel Functions have a
  finite execution duration and cannot host this loop reliably.
- Local disk is not shared between the API and worker. Production therefore
  requires `MEDIA_STORAGE_DRIVER=s3`.
- The frontend now polls the batch API and does not depend on a persistent SSE
  connection.

Relevant platform references:

- [Vercel Functions limits](https://vercel.com/docs/functions/limitations)
- [Vercel Vite deployments](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel monorepo root directories](https://vercel.com/docs/monorepos)
- [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection)

## Security model

There are two independent access layers:

1. Enable Vercel Authentication or another Deployment Protection method for the
   frontend so only authorized Vercel team members can load it.
2. Set a separate `APP_ACCESS_TOKEN` on the API. Team members enter this token
   in the frontend. It is kept in browser `sessionStorage` and sent only as an
   `Authorization: Bearer ...` header.

Never put `APP_ACCESS_TOKEN`, Shopify credentials, database credentials, or S3
credentials in a `VITE_*` variable. Vite variables are included in the public
browser bundle.

The Shopify Admin access token remains only on the API and worker services.

## Required managed resources

Provision these resources before deploying the frontend:

1. A managed PostgreSQL database reachable by both API and worker.
2. One private S3-compatible bucket. AWS S3 or Cloudflare R2 are suitable.
3. A persistent Node/Docker host capable of running two services continuously.
4. A stable HTTPS domain for the API, for example
   `https://publisher-api.example.com`.
5. A Vercel project for the frontend.

The API and worker must use the same PostgreSQL database, bucket, Shopify store,
pipeline version, write mode, and publication GID.

## Backend environment

Set these values on both the API and worker unless marked otherwise:

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://...
DATABASE_SSL=true

SHOPIFY_STORE_DOMAIN=gmsqgg-bk.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=...
SHOPIFY_API_VERSION=2026-07
SHOPIFY_ONLINE_STORE_PUBLICATION_GID=gid://shopify/Publication/...

SHOPIFY_WRITE_MODE=draft
PUBLISH_KILL_SWITCH=true
PIPELINE_VERSION=catalog-v1
PUBLISHER_ID=ersa-product-publisher
STORE_CURRENCY=USD
DEFAULT_PRODUCT_PRICE=19.99

MEDIA_STORAGE_DRIVER=s3
MEDIA_STORAGE_PATH=product-publisher
S3_ENDPOINT=https://...
S3_REGION=auto
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=false

MAX_BATCH_ITEMS=20
MAX_IMAGE_BYTES=26214400
RELEASE=production-YYYY.MM.DD-1
```

API-only values:

```dotenv
HOST=0.0.0.0
PORT=4310
APP_ACCESS_TOKEN=GENERATE_AT_LEAST_32_RANDOM_CHARACTERS
CORS_ORIGINS=https://YOUR-VERCEL-PRODUCTION-DOMAIN
```

Add additional exact Vercel preview origins to `CORS_ORIGINS`, separated by
commas, only when a preview must be tested.

Worker-only values:

```dotenv
WORKER_POLL_MS=500
WORKER_LEASE_SECONDS=120
```

Generate the team token locally without saving it to the repository:

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToHexString($bytes).ToLower()
```

## Backend rollout

1. Build the repository `tools/product-publisher/Dockerfile`.
2. Create the API service and set its Railway config path to
   `/tools/product-publisher/railway.api.json` when deploying from the full
   repository, or `/railway.api.json` when `tools/product-publisher` is the
   service root.
3. Create a second service from the same source and set its config path to
   `/tools/product-publisher/railway.worker.json` or `/railway.worker.json`,
   matching the selected service root.
4. Run database migrations once as a release command:

   ```bash
   npm run db:migrate
   ```

5. Check the public health endpoints:

   ```text
   GET https://YOUR-API/api/health/live
   GET https://YOUR-API/api/health/ready
   ```

6. Check that a protected endpoint returns `401` without
   `Authorization`, then succeeds with the team access token.
7. Keep `SHOPIFY_WRITE_MODE=draft` and `PUBLISH_KILL_SWITCH=true` for the first
   production canary.

## Vercel frontend deployment

Create a Vercel project from this repository with:

- Root Directory: `tools/product-publisher`
- Framework: Vite
- Install Command: `npm ci`
- Build Command: `npm run build:web`
- Output Directory: `apps/web/dist`

These values are also committed in `tools/product-publisher/vercel.json`.

Set only these frontend environment variables in Vercel:

```dotenv
VITE_API_BASE_URL=https://YOUR-STABLE-API-DOMAIN
VITE_AUTH_REQUIRED=true
```

Do not set `APP_ACCESS_TOKEN` as a Vercel frontend environment variable.

Deploy with the Vercel dashboard or, after authenticating the CLI:

```powershell
cd tools/product-publisher
npx vercel
npx vercel --prod
```

After Vercel assigns the final production domain, update the API
`CORS_ORIGINS` value and restart the API service.

## First production QA

1. Open the protected Vercel URL as a Vercel team member.
2. Enter the separate product-publisher access token.
3. Confirm that the UI shows the correct Shopify store and `draft` mode.
4. Select a folder containing exactly two canary images and the intended manual
   collection.
5. Run one product only.
6. Verify in Shopify Admin:
   - product remains `DRAFT`;
   - both images are present;
   - collection GID and handle are correct;
   - metafield external ID exists;
   - no unrelated product changed.
7. Only after this canary passes, upload a larger folder.
8. Change to `SHOPIFY_WRITE_MODE=publish` and
   `PUBLISH_KILL_SWITCH=false` only when the merchant explicitly intends to
   publish automatically.

## Known limitations

- Team access currently uses one shared application token, not individual user
  accounts or role-based permissions.
- The Docker image was not built locally during this change because Docker is
  not installed in the current Windows environment. Typecheck, unit tests, and
  application builds are validated.
- A live deployment still requires the managed resource URLs and provider
  credentials listed above; none are stored in the repository.
