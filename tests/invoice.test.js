const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { initializeDatabase } = require('../src/db');
const { receiveStock, createOrder, transitionOrder } = require('../src/services/inventory');
const { generateInvoice, getInvoiceById, listInvoices, updateInvoicePayment } = require('../src/services/invoice');

function setupTestDb() {
  const db = new Database(':memory:');
  initializeDatabase(db);

  // Seed user
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, phone)
    VALUES ('admin-1', 'Apex MedSupply', 'admin@apexmed.example.test', 'hash', 'WHOLESALER', '+919820011223'),
           ('customer-1', 'City Care Pharmacy', 'citycare@example.test', 'hash', 'CUSTOMER', '+919830022334')
  `).run();

  // Seed category and product
  db.prepare(`
    INSERT INTO categories (id, name) VALUES ('cat-1', 'Antibiotics')
  `).run();

  db.prepare(`
    INSERT INTO products (id, name, brand, composition, category_id, pack_size, mrp, wholesale_price, gst_rate, minimum_stock, marketplace_visible, availability_status)
    VALUES ('prod-1', 'Amoxicillin 500mg', 'Moxicip', 'Amoxicillin IP', 'cat-1', '10x10 Tablets', 120, 80, 12, 10, 1, 'AVAILABLE'),
           ('prod-2', 'Azithromycin 250mg', 'Aziwok', 'Azithromycin IP', 'cat-1', '6 Tablets', 150, 95, 12, 5, 1, 'AVAILABLE')
  `).run();

  // Seed stock
  receiveStock(db, {
    productId: 'prod-1',
    batchNumber: 'MOX-2026-01',
    expiryDate: '2027-12-31',
    quantity: 100,
    purchasePrice: 60,
    actorId: 'admin-1'
  });

  receiveStock(db, {
    productId: 'prod-2',
    batchNumber: 'AZI-2026-01',
    expiryDate: '2028-06-30',
    quantity: 50,
    purchasePrice: 70,
    actorId: 'admin-1'
  });

  return db;
}

test('wholesaler can generate GST-compliant tax invoice from confirmed order', () => {
  const db = setupTestDb();

  // Create order
  const orderRes = createOrder(db, {
    customerId: 'customer-1',
    items: [
      { productId: 'prod-1', quantity: 10 },
      { productId: 'prod-2', quantity: 5 }
    ],
    actorId: 'customer-1',
    shippingAddress: 'Plot 10, Main Street, Mumbai'
  });

  // Confirm order
  transitionOrder(db, { orderId: orderRes.id, status: 'CONFIRMED', actorId: 'admin-1' });

  // Generate invoice
  const invoice = generateInvoice(db, { orderId: orderRes.id, actorId: 'admin-1' });

  assert.ok(invoice);
  assert.match(invoice.number, /^INV-\d{8}-\d{4}$/);
  assert.equal(invoice.order_id, orderRes.id);
  assert.equal(invoice.customer_name, 'City Care Pharmacy');
  assert.equal(invoice.items.length, 2);

  // Check GST calculations
  // Item 1: 10 * 80 = 800 taxable, 12% GST (6% CGST = 48, 6% SGST = 48), lineTotal = 896
  // Item 2: 5 * 95 = 475 taxable, 12% GST (6% CGST = 28.5, 6% SGST = 28.5), lineTotal = 532
  // Total Taxable = 1275, Total CGST = 76.5, Total SGST = 76.5, Total GST = 153, Grand Total = 1428
  assert.equal(invoice.totals.taxableAmount, 1275);
  assert.equal(invoice.totals.cgstAmount, 76.5);
  assert.equal(invoice.totals.sgstAmount, 76.5);
  assert.equal(invoice.totals.grandTotal, 1428);
  assert.match(invoice.totals.amountInWords, /Rupees One Thousand Four Hundred and Twenty Eight Only/);

  // Verify batches attached
  assert.equal(invoice.items[0].batchNumber, 'MOX-2026-01');
  assert.equal(invoice.items[0].expiryDate, '2027-12-31');
});

test('wholesaler can record payment and update invoice payment status', () => {
  const db = setupTestDb();
  const orderRes = createOrder(db, {
    customerId: 'customer-1',
    items: [{ productId: 'prod-1', quantity: 5 }],
    actorId: 'customer-1'
  });
  transitionOrder(db, { orderId: orderRes.id, status: 'CONFIRMED', actorId: 'admin-1' });

  const invoice = generateInvoice(db, { orderId: orderRes.id, actorId: 'admin-1' });
  assert.equal(invoice.payment_status, 'PENDING');

  const updated = updateInvoicePayment(db, {
    invoiceId: invoice.id,
    paymentStatus: 'PAID',
    amount: invoice.totals.grandTotal,
    method: 'NEFT',
    referenceId: 'UTR9988776655',
    actorId: 'admin-1'
  });

  assert.equal(updated.payment_status, 'PAID');
  const invoicesList = listInvoices(db);
  assert.equal(invoicesList.length, 1);
  assert.equal(invoicesList[0].payment_status, 'PAID');
});
