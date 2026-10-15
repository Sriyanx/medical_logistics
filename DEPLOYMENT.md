# MediSales production deployment

MediSales uses PostgreSQL in production and SQLite only for automated tests. Cloud Run is stateless, so do not use SQLite or a container-mounted database in production.

## Google Cloud Run

Build and deploy with Cloud Build:

```bash
gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT_ID/medisales/api
gcloud run deploy medisales-api \
  --image REGION-docker.pkg.dev/PROJECT_ID/medisales/api \
  --region REGION --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets DATABASE_URL=medisales-database-url:latest,JWT_SECRET=medisales-jwt-secret:latest
```

Store `DATABASE_URL` and `JWT_SECRET` in Secret Manager. Point `DATABASE_URL` to Cloud SQL for PostgreSQL through the Cloud Run integration, or to a managed PostgreSQL provider such as Neon/Supabase. Cloud Run provides the public HTTPS URL automatically; verify `https://SERVICE-URL/api/health`.

## Local PostgreSQL

```bash
docker compose up --build
```

This starts PostgreSQL and the API at `http://localhost:3000` with persistent local database storage. The Compose password is for local development only.

## Legacy Render deployment

The repository includes `render.yaml`, which provisions:

- A Node.js web service from the repository
- `npm ci` build and `npm start` launch commands
- `/api/health` health checks
- A persistent 1 GB disk mounted at `/var/data`
- `DATABASE_PATH=/var/data/medical.db`
- A generated `JWT_SECRET`

1. Push the latest `main` branch to GitHub.
2. Open [Render](https://render.com) and choose **New → Blueprint**.
3. Connect `Sriyanx/medical_logistics` and select the `main` branch.
4. Review the `medisales-api` service and create it.
5. Wait for the deploy to finish, then verify:

   ```text
   https://YOUR-RENDER-SERVICE.onrender.com/api/health
   ```

   Expected response:

   ```json
   {"status":"ok"}
   ```

Render automatically provides HTTPS. Do not use the local SQLite database for production; the Render persistent disk is required because SQLite data is otherwise lost on restart/redeploy.

## Mobile configuration

After Render creates the service URL, replace `YOUR-RENDER-SERVICE` in `mobile/app.json` and `mobile/src/api.js`, or set the build environment variable:

```bash
EXPO_PUBLIC_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api
```

Then rebuild the mobile app. Never commit JWT secrets, database files, GitHub tokens, or other credentials.

## Important production limitation

The current app seeds demo accounts only when the database has no users. Before public launch, replace demo credentials, set a strong secret through Render environment variables, add rate limiting, configure backups, and migrate from SQLite to PostgreSQL when multiple instances or high traffic are needed.
