# Apex MedSupply

A working B2B medical wholesale marketplace and inventory-management MVP. It provides distinct wholesaler and medical-store experiences using a real SQLite database, JWT authentication, role-based APIs, batch-level FEFO allocation, stock reservations, and an inventory ledger.

## Included

- Wholesaler dashboard with catalogue, batch inventory, order, and requirement views.
- Customer marketplace with searchable catalogue, live stock visibility, ordering, and medicine requirements.
- Product data supports optional manufacturer, pack size, classification, and description fields.
- Physical stock, marketplace visibility, and product availability are separate controls.
- Batch inventory with expiry exclusion and FEFO allocation.
- Order placement reserves inventory; wholesaler confirmation records the sale; cancellation/rejection restores stock.
- `stock_transactions` captures receipts, reservations, and sales.
- 30 fictional medicines, batches, stock transactions, accounts, and sample requirement seeded on first startup.

## Run

```bash
npm install
npm start
```

Open http://localhost:3000.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Wholesaler | `admin@apexmed.example.test` | `DemoPass123!` |
| Medical Store | `citycare@example.test` | `DemoPass123!` |

The database is stored at `data/medical.db`. Set `DATABASE_PATH` to use another location and `PORT` to change the listening port.

```bash
DATABASE_PATH=C:/data/apex.db PORT=8080 npm start
```

Set `JWT_SECRET` to a random deployment secret; the development fallback must not be used in production.

## Verification

```bash
npm test
```

The test suite covers receipt ledger creation, separate batch records, FEFO order allocations, oversell rejection, reservation-to-sale conversion, cancellation restoration, role authorization, and end-to-end customer ordering.

## Production next steps

Production uses PostgreSQL through `DATABASE_URL`; SQLite is retained only for the in-memory automated tests. For Cloud Run, use Cloud SQL or a managed PostgreSQL provider and keep credentials in Secret Manager.

## Mobile app

The `mobile/` directory contains the React Native/Expo MediSales app. See [`mobile/README.md`](mobile/README.md) for setup, API configuration, and Android release steps.

## Production database

MediSales uses PostgreSQL in production and SQLite only for the automated test suite. Production startup requires `DATABASE_URL` and fails closed when it is missing.

For local PostgreSQL development:

```bash
docker compose up --build
```

For Google Cloud Run, configure `DATABASE_URL` as a Secret Manager-backed environment variable pointing to Cloud SQL for PostgreSQL (preferably through the Cloud SQL connector) or a managed provider such as Neon/Supabase. Keep the database outside the container; Cloud Run's local filesystem is ephemeral.

## Docker deployment

The repository root contains a production Dockerfile. Build and run it with a persistent host directory for SQLite:

```bash
docker build -t medisales-api .
mkdir -p data
docker run -d --name medisales-api \
  -p 3000:3000 \
  -v "$(pwd)/data:/data" \
  -e JWT_SECRET="replace-with-a-long-random-secret" \
  medisales-api
```

The container listens on port `3000`, binds to `0.0.0.0`, runs as the non-root `node` user, and stores the database at `/data/medical.db`. Put Caddy or another TLS reverse proxy in front of it for public HTTPS.

## Production hosting

Render deployment configuration is in [`render.yaml`](render.yaml). Follow [`DEPLOYMENT.md`](DEPLOYMENT.md) to provision the API with managed HTTPS and a persistent SQLite disk.
