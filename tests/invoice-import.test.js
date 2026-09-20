const test = require('node:test');
const assert = require('node:assert/strict');
const { parseInvoiceText } = require('../src/services/invoice-import');

test('parses recognized invoice lines and extracts batch, expiry, quantity and purchase price', () => {
  const invoice = `
    Supplier Invoice INV-2026-101
    Paracetamol 500mg | Batch: PCT-A1 | Exp: 06/2027 | Qty: 120 | Rate: 18.50
    Amoxicillin 500mg | Batch: AMX-B2 | Exp: 2027-11-30 | Qty: 60 | Rate: 42
  `;
  const result = parseInvoiceText(invoice);
  assert.equal(result.items.length, 2);
  assert.deepEqual(result.items[0], { productName: 'Paracetamol 500mg', batchNumber: 'PCT-A1', expiryDate: '2027-06-30', quantity: 120, purchasePrice: 18.5 });
  assert.deepEqual(result.items[1], { productName: 'Amoxicillin 500mg', batchNumber: 'AMX-B2', expiryDate: '2027-11-30', quantity: 60, purchasePrice: 42 });
});

test('rejects an invoice line missing fields required for a safe stock update', () => {
  const result = parseInvoiceText('Paracetamol 500mg | Qty: 10 | Rate: 18');
  assert.equal(result.items.length, 0);
  assert.equal(result.unparsedLines.length, 1);
});
