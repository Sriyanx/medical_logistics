const crypto = require('node:crypto');
const id = () => crypto.randomUUID();

function activeBatches(db, productId) {
  return db.prepare(`SELECT * FROM inventory_batches WHERE product_id = ? AND expiry_date > date('now') AND available_quantity > 0 ORDER BY expiry_date ASC, created_at ASC`).all(productId);
}
function receiveStock(db, input) {
  const tx = db.transaction(({ productId, batchNumber, expiryDate, quantity, purchasePrice = 0, sellingPrice = null, warehouse = null, actorId, notes = null }) => {
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Quantity must be a positive integer');
    const existing = db.prepare('SELECT id FROM inventory_batches WHERE product_id = ? AND batch_number = ?').get(productId, batchNumber);
    let batchId;
    if (existing) { batchId = existing.id; db.prepare('UPDATE inventory_batches SET quantity = quantity + ?, available_quantity = available_quantity + ?, purchase_price = ?, selling_price = ?, warehouse = COALESCE(?, warehouse) WHERE id = ?').run(quantity, quantity, purchasePrice, sellingPrice, warehouse, batchId); }
    else { batchId = id(); db.prepare('INSERT INTO inventory_batches (id, product_id, batch_number, expiry_date, quantity, reserved_quantity, available_quantity, purchase_price, selling_price, warehouse) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)').run(batchId, productId, batchNumber, expiryDate, quantity, quantity, purchasePrice, sellingPrice, warehouse); }
    db.prepare('INSERT INTO stock_transactions (id, product_id, batch_id, type, quantity, notes, actor_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id(), productId, batchId, 'PURCHASE_RECEIVED', quantity, notes, actorId);
    return batchId;
  });
  return tx(input);
}
function createOrder(db, { customerId, items, actorId, shippingAddress = null }) {
  const tx = db.transaction(() => {
    if (!Array.isArray(items) || items.length === 0) throw new Error('Order must contain at least one item');
    const orderId = id(); let subtotal = 0; let gstTotal = 0;
    const prepared = items.map(({ productId, quantity }) => {
      if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Quantity must be a positive integer');
      const product = db.prepare("SELECT * FROM products WHERE id = ? AND archived_at IS NULL AND marketplace_visible = 1 AND availability_status = 'AVAILABLE'").get(productId);
      if (!product) throw new Error('Product is unavailable');
      const batches = activeBatches(db, productId); let remaining = quantity; const allocations = [];
      for (const batch of batches) { const take = Math.min(remaining, batch.available_quantity); if (take) { allocations.push({ batch, quantity: take }); remaining -= take; } if (!remaining) break; }
      if (remaining) throw new Error(`Insufficient available stock for ${product.name}`);
      const line = product.wholesale_price * quantity; const gst = line * product.gst_rate / 100; subtotal += line; gstTotal += gst;
      return { product, quantity, allocations, lineTotal: line + gst };
    });
    const number = `ORD-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${orderId.slice(0,6).toUpperCase()}`;
    db.prepare('INSERT INTO orders (id, number, customer_id, subtotal, gst_total, grand_total, shipping_address) VALUES (?, ?, ?, ?, ?, ?, ?)').run(orderId, number, customerId, subtotal, gstTotal, subtotal + gstTotal, shippingAddress);
    for (const row of prepared) {
      const itemId = id(); db.prepare('INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, gst_rate, line_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(itemId, orderId, row.product.id, row.product.name, row.quantity, row.product.wholesale_price, row.product.gst_rate, row.lineTotal);
      for (const allocation of row.allocations) {
        db.prepare('UPDATE inventory_batches SET reserved_quantity = reserved_quantity + ?, available_quantity = available_quantity - ? WHERE id = ? AND available_quantity >= ?').run(allocation.quantity, allocation.quantity, allocation.batch.id, allocation.quantity);
        db.prepare('INSERT INTO order_allocations (id, order_id, order_item_id, batch_id, batch_number, quantity) VALUES (?, ?, ?, ?, ?, ?)').run(id(), orderId, itemId, allocation.batch.id, allocation.batch.batch_number, allocation.quantity);
        db.prepare('INSERT INTO stock_transactions (id, product_id, batch_id, type, quantity, reference_type, reference_id, actor_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id(), row.product.id, allocation.batch.id, 'RESERVATION', -allocation.quantity, 'ORDER', orderId, actorId);
      }
    }
    db.prepare('INSERT INTO order_status_history (id, order_id, status, actor_id) VALUES (?, ?, ?, ?)').run(id(), orderId, 'PENDING', actorId);
    return { id: orderId, number, status: 'PENDING', grandTotal: subtotal + gstTotal };
  }); return tx();
}
function transitionOrder(db, { orderId, status, actorId }) {
  const terminal = new Set(['CANCELLED', 'REJECTED']);
  const tx = db.transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId); if (!order) throw new Error('Order not found');
    const allocations = db.prepare('SELECT a.*, i.product_id FROM order_allocations a JOIN order_items i ON i.id = a.order_item_id WHERE a.order_id = ?').all(orderId);
    if (status === 'CONFIRMED' && order.status === 'PENDING') for (const a of allocations) { db.prepare('UPDATE inventory_batches SET quantity = quantity - ?, reserved_quantity = reserved_quantity - ? WHERE id = ? AND reserved_quantity >= ?').run(a.quantity, a.quantity, a.batch_id, a.quantity); db.prepare('INSERT INTO stock_transactions (id, product_id, batch_id, type, quantity, reference_type, reference_id, actor_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id(), a.product_id, a.batch_id, 'SALE', -a.quantity, 'ORDER', orderId, actorId); }
    if (terminal.has(status) && ['PENDING', 'CONFIRMED'].includes(order.status)) for (const a of allocations) { if (order.status === 'PENDING') db.prepare('UPDATE inventory_batches SET reserved_quantity = reserved_quantity - ?, available_quantity = available_quantity + ? WHERE id = ?').run(a.quantity, a.quantity, a.batch_id); else db.prepare('UPDATE inventory_batches SET quantity = quantity + ?, available_quantity = available_quantity + ? WHERE id = ?').run(a.quantity, a.quantity, a.batch_id); }
    db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, orderId); db.prepare('INSERT INTO order_status_history (id, order_id, status, actor_id) VALUES (?, ?, ?, ?)').run(id(), orderId, status, actorId); return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  }); return tx();
}
module.exports = { receiveStock, createOrder, transitionOrder, activeBatches };
