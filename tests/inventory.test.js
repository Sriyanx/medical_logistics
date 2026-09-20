const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { initializeDatabase } = require('../src/db');
const { receiveStock, createOrder, transitionOrder } = require('../src/services/inventory');

function database() {
  const db = new Database(':memory:');
  initializeDatabase(db);
  db.prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES ('admin', 'Admin', 'admin@test.local', 'hash', 'WHOLESALER')").run();
  db.prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES ('store', 'City Care Pharmacy', 'store@test.local', 'hash', 'CUSTOMER')").run();
  db.prepare("INSERT INTO categories (id, name) VALUES ('cat', 'Analgesics')").run();
  db.prepare("INSERT INTO products (id, name, brand, composition, category_id, mrp, wholesale_price, gst_rate, minimum_stock, marketplace_visible, availability_status) VALUES ('p1', 'Paracetamol 500mg', 'MediCare', 'Paracetamol 500mg', 'cat', 35, 28, 12, 10, 1, 'AVAILABLE')").run();
  return db;
}

test('received batch is tracked separately and creates a stock transaction', () => {
  const db = database();
  receiveStock(db, { productId: 'p1', batchNumber: 'A-100', expiryDate: '2027-06-30', quantity: 20, purchasePrice: 18, actorId: 'admin' });
  const batch = db.prepare('SELECT quantity, available_quantity FROM inventory_batches WHERE batch_number = ?').get('A-100');
  assert.deepEqual(batch, { quantity: 20, available_quantity: 20 });
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM stock_transactions WHERE type = 'PURCHASE_RECEIVED'").get().c, 1);
});

test('order allocation uses FEFO and refuses stock beyond availability', () => {
  const db = database();
  receiveStock(db, { productId: 'p1', batchNumber: 'LATE', expiryDate: '2027-12-31', quantity: 8, purchasePrice: 18, actorId: 'admin' });
  receiveStock(db, { productId: 'p1', batchNumber: 'EARLY', expiryDate: '2027-06-30', quantity: 5, purchasePrice: 18, actorId: 'admin' });
  const order = createOrder(db, { customerId: 'store', items: [{ productId: 'p1', quantity: 7 }], actorId: 'store' });
  assert.equal(order.status, 'PENDING');
  const allocated = db.prepare('SELECT batch_number, quantity FROM order_allocations WHERE order_id = ? ORDER BY batch_number').all(order.id);
  assert.deepEqual(allocated, [{ batch_number: 'EARLY', quantity: 5 }, { batch_number: 'LATE', quantity: 2 }]);
  assert.throws(() => createOrder(db, { customerId: 'store', items: [{ productId: 'p1', quantity: 7 }], actorId: 'store' }), /Insufficient available stock/);
});

test('confirmation converts reservation to sale and cancellation restores it', () => {
  const db = database();
  receiveStock(db, { productId: 'p1', batchNumber: 'A-100', expiryDate: '2027-06-30', quantity: 10, purchasePrice: 18, actorId: 'admin' });
  const order = createOrder(db, { customerId: 'store', items: [{ productId: 'p1', quantity: 6 }], actorId: 'store' });
  transitionOrder(db, { orderId: order.id, status: 'CONFIRMED', actorId: 'admin' });
  let batch = db.prepare('SELECT quantity, reserved_quantity, available_quantity FROM inventory_batches').get();
  assert.deepEqual(batch, { quantity: 4, reserved_quantity: 0, available_quantity: 4 });
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM stock_transactions WHERE type = 'SALE'").get().c, 1);
  transitionOrder(db, { orderId: order.id, status: 'CANCELLED', actorId: 'admin' });
  batch = db.prepare('SELECT quantity, reserved_quantity, available_quantity FROM inventory_batches').get();
  assert.deepEqual(batch, { quantity: 10, reserved_quantity: 0, available_quantity: 10 });
});
