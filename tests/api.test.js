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

test('wholesaler can edit medicine category, wholesale price, availability, visibility and status', async (t) => {
  const { db, server, base } = await boot(); t.after(() => server.close());
  const admin = await login(base, 'admin@apexmed.example.test', 'DemoPass123!');
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${admin.token}` };
  const categories = await (await fetch(`${base}/api/categories`, { headers })).json();
  const current = db.prepare('SELECT category_id FROM products WHERE id = ?').get('product-1');
  const category = categories.items.find(item => item.id !== current.category_id);
  const response = await fetch(`${base}/api/products/product-1`, { method: 'PATCH', headers, body: JSON.stringify({ categoryId: category.id, wholesalePrice: 42, availabilityStatus: 'UNAVAILABLE', marketplaceVisible: false }) });
  assert.equal(response.status, 200);
  const { product } = await response.json();
  assert.equal(product.categoryId, category.id);
  assert.equal(product.wholesalePrice, 42);
  assert.equal(product.availabilityStatus, 'UNAVAILABLE');
  assert.equal(product.marketplaceVisible, false);
  const persisted = db.prepare('SELECT * FROM products WHERE id = ?').get('product-1');
  assert.equal(persisted.category_id, category.id);
  assert.equal(persisted.wholesale_price, 42);
  assert.equal(persisted.availability_status, 'UNAVAILABLE');
  assert.equal(persisted.marketplace_visible, 0);
});

test('customer cannot edit medicine catalogue fields', async (t) => {
  const { server, base } = await boot(); t.after(() => server.close());
  const customer = await login(base, 'citycare@example.test', 'DemoPass123!');
  const response = await fetch(`${base}/api/products/product-1`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${customer.token}` }, body: JSON.stringify({ wholesalePrice: 1 }) });
  assert.equal(response.status, 403);
});

test('customer cannot upload invoice for restock', async (t) => {
  const { server, base } = await boot(); t.after(() => server.close());
  const customer = await login(base, 'citycare@example.test', 'DemoPass123!');
  const response = await fetch(`${base}/api/restock/invoice-image`, { method: 'POST', headers: { authorization: `Bearer ${customer.token}` } });
  assert.equal(response.status, 403);
});

test('wholesaler uploading invoice image extracts details and auto-updates stocks', async (t) => {
  const fs = require('node:fs');
  const imagePath = 'C:/temp/invoice-tests/test-invoice-1.png';
  if (!fs.existsSync(imagePath)) return;
  const { db, server, base } = await boot(); t.after(() => server.close());
  const admin = await login(base, 'admin@apexmed.example.test', 'DemoPass123!');
  
  const fileBuffer = fs.readFileSync(imagePath);
  const blob = new Blob([fileBuffer], { type: 'image/png' });
  const form = new FormData();
  form.append('invoice', blob, 'test-invoice-1.png');

  const response = await fetch(`${base}/api/restock/invoice-image`, {
    method: 'POST',
    headers: { authorization: `Bearer ${admin.token}` },
    body: form
  });

  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.itemCount, 3);

  // Verify batch was created in database
  const batch = db.prepare("SELECT * FROM inventory_batches WHERE batch_number = 'PCT-A1'").get();
  assert.ok(batch);
  assert.equal(batch.quantity, 200);
  assert.equal(batch.available_quantity, 200);
  assert.equal(batch.purchase_price, 18.5);

  // Verify stock transaction was recorded
  const tx = db.prepare("SELECT * FROM stock_transactions WHERE batch_id = ?").get(batch.id);
  assert.ok(tx);
  assert.equal(tx.type, 'PURCHASE_RECEIVED');
  assert.equal(tx.quantity, 200);
});
