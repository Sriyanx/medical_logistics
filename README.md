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

This is an MVP deliberately built on SQLite to be self-contained. Before deploying at scale: migrate to PostgreSQL, serve images through object storage, add refresh tokens/rate limits, build PDF invoice rendering and payment integrations, and expand test coverage for invoices, purchase orders, reports, notifications, and concurrency across database connections.
