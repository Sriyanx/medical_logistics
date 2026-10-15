# MediSales production deployment

## Render deployment

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
