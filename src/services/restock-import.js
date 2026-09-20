const crypto = require('node:crypto');
const { receiveStock } = require('./inventory');
const id = () => crypto.randomUUID();
const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function findProduct(db, productName) {
  const target = normalized(productName);
  return db.prepare('SELECT id, name FROM products WHERE archived_at IS NULL').all().find(product => normalized(product.name) === target) || null;
}
function saveRestockPreview(db, { filename, text, items, actorId }) {
  const importId = id();
  const tx = db.transaction(() => {
    db.prepare('INSERT INTO restock_imports(id,filename,extracted_text,status,item_count,actor_id) VALUES(?,?,?,?,?,?)').run(importId, filename, text, 'SCANNED', items.length, actorId);
    const insert = db.prepare('INSERT INTO restock_import_items(id,import_id,product_id,raw_product_name,batch_number,expiry_date,quantity,purchase_price) VALUES(?,?,?,?,?,?,?,?)');
    const enriched = items.map(item => ({ ...item, product: findProduct(db, item.productName) }));
    for (const item of enriched) insert.run(id(), importId, item.product?.id || null, item.productName, item.batchNumber, item.expiryDate, item.quantity, item.purchasePrice);
    return enriched;
  });
  return { importId, items: tx() };
}
function applyRestockImport(db, { importId, actorId }) {
  const tx = db.transaction(() => {
    const record = db.prepare("SELECT * FROM restock_imports WHERE id = ? AND status = 'SCANNED'").get(importId);
    if (!record) throw new Error('Invoice import is unavailable or has already been applied');
    const items = db.prepare('SELECT * FROM restock_import_items WHERE import_id = ?').all(importId);
    if (!items.length || items.some(item => !item.product_id)) throw new Error('Every scanned line must match a medicine before stock can be updated');
    for (const item of items) receiveStock(db, { productId: item.product_id, batchNumber: item.batch_number, expiryDate: item.expiry_date, quantity: item.quantity, purchasePrice: item.purchase_price, actorId, notes: `Invoice image import: ${record.filename}` });
    db.prepare("UPDATE restock_imports SET status = 'APPLIED', applied_at = CURRENT_TIMESTAMP WHERE id = ?").run(importId);
    return { importId, itemCount: items.length };
  });
  return tx();
}
module.exports = { saveRestockPreview, applyRestockImport };
