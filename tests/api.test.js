const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { createApp } = require('../src/app');
const { initializeDatabase } = require('../src/db');
const { seedDemo } = require('../src/seed');

async function boot() {
  const db = new Database(':memory:'); initializeDatabase(db); seedDemo(db);
  const app = createApp(db); const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { db, server, base };
}
async function login(base, email, password) {
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  assert.equal(response.status, 200); return response.json();
}

test('customer sees only visible products and can create a reserved order', async (t) => {
  const { db, server, base } = await boot(); t.after(() => server.close());
  const auth = await login(base, 'citycare@example.test', 'DemoPass123!');
  const products = await (await fetch(`${base}/api/catalogue`, { headers: { authorization: `Bearer ${auth.token}` } })).json();
  assert.ok(products.items.length >= 20);
  assert.ok(products.items.every(p => p.marketplaceVisible && p.availableQuantity > 0));
  const first = products.items[0];
  const placed = await fetch(`${base}/api/orders`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${auth.token}` }, body: JSON.stringify({ items: [{ productId: first.id, quantity: 1 }] }) });
  assert.equal(placed.status, 201);
  assert.equal((await placed.json()).order.status, 'PENDING');
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM stock_transactions WHERE type = 'RESERVATION'").get().c, 1);
});

test('customer cannot modify wholesaler inventory', async (t) => {
  const { server, base } = await boot(); t.after(() => server.close());
  const auth = await login(base, 'citycare@example.test', 'DemoPass123!');
  const result = await fetch(`${base}/api/inventory/receive`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${auth.token}` }, body: JSON.stringify({}) });
  assert.equal(result.status, 403);
});
