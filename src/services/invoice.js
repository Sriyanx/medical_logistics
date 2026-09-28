const crypto = require('node:crypto');
const id = () => crypto.randomUUID();

function numberToWords(num) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  function convert(n) {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  }

  const parts = Number(num || 0).toFixed(2).split('.');
  const whole = parseInt(parts[0], 10);
  const fraction = parseInt(parts[1], 10);

  if (whole === 0 && fraction === 0) return 'Rupees Zero Only';

  let str = '';
  if (whole > 0) str += 'Rupees ' + convert(whole);
  if (fraction > 0) str += (str ? ' and ' : '') + convert(fraction) + ' Paise';
  return str + ' Only';
}

const WHOLESALER_DETAILS = {
  name: 'Apex MedSupply Wholesale Distributors Pvt. Ltd.',
  tagline: 'Authorized Pharmaceutical & Healthcare Wholesale Supply',
  address: 'Plot 42, Pharma Logistics Park, MIDC Industrial Area, Mumbai, Maharashtra - 400705',
  gstin: '27AABCA1234F1Z5',
  pan: 'AABCA1234F',
  drugLicense: 'DL-20B/MH/2022/098765, DL-21B/MH/2022/098766',
  fssai: '11521018000234',
  email: 'billing@apexmedsupply.test',
  phone: '+91 98200 88990',
  bank: {
    name: 'HDFC Bank Ltd',
    branch: 'MIDC Industrial Estate Branch, Mumbai',
    accountNumber: '50200088992211',
    ifsc: 'HDFC0001234',
    accountType: 'Current Account'
  },
  terms: [
    'Goods once sold will not be accepted back without prior written batch verification.',
    'Discrepancies in quantity or breakage must be reported within 48 hours of delivery receipt.',
    'Payment is due within the stipulated credit terms. Overdue interest @18% p.a. applicable thereafter.',
    'All disputes are subject to Mumbai jurisdiction only.'
  ]
};

function generateInvoice(db, { orderId, actorId, dueDate = null }) {
  const tx = db.transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) throw new Error('Order not found');

    // Check if an invoice already exists
    const existing = db.prepare('SELECT * FROM invoices WHERE order_id = ?').get(orderId);
    if (existing) {
      return getInvoiceById(db, existing.id);
    }

    const countRow = db.prepare('SELECT COUNT(*) as count FROM invoices').get();
    const seq = String((countRow ? countRow.count : 0) + 1).padStart(4, '0');
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const number = `INV-${todayStr}-${seq}`;
    const invoiceId = id();

    db.prepare(`
      INSERT INTO invoices (id, number, order_id, issued_at, payment_status)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).run(invoiceId, number, orderId, order.payment_status || 'PENDING');

    return getInvoiceById(db, invoiceId);
  });

  return tx();
}

function getInvoiceById(db, invoiceId) {
  const invoice = db.prepare(`
    SELECT i.*, o.number as order_number, o.created_at as order_date, o.subtotal, o.gst_total, o.grand_total,
           o.shipping_address, o.customer_id, u.name as customer_name, u.email as customer_email, u.phone as customer_phone
    FROM invoices i
    JOIN orders o ON o.id = i.order_id
    JOIN users u ON u.id = o.customer_id
    WHERE i.id = ?
  `).get(invoiceId);

  if (!invoice) return null;

  // Get order items with allocated batches
  const items = db.prepare(`
    SELECT oi.*, p.brand, p.composition, p.pack_size, c.name as category_name
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE oi.order_id = ?
  `).all(invoice.order_id);

  // Get allocations for each item
  const allocations = db.prepare(`
    SELECT a.*, b.expiry_date, b.warehouse
    FROM order_allocations a
    JOIN inventory_batches b ON b.id = a.batch_id
    WHERE a.order_id = ?
  `).all(invoice.order_id);

  const allocationsByItemId = {};
  for (const a of allocations) {
    if (!allocationsByItemId[a.order_item_id]) allocationsByItemId[a.order_item_id] = [];
    allocationsByItemId[a.order_item_id].push(a);
  }

  // Calculate taxes and format items
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;

  const invoiceItems = items.map((item, idx) => {
    const itemAllocations = allocationsByItemId[item.id] || [];
    const batchList = itemAllocations.map(a => `${a.batch_number} (Exp: ${a.expiry_date}) [Qty: ${a.quantity}]`).join(', ');
    const firstBatch = itemAllocations[0] || {};
    
    const taxableValue = item.unit_price * item.quantity;
    const gstRate = item.gst_rate || 0;
    const cgstRate = gstRate / 2;
    const sgstRate = gstRate / 2;
    const cgstAmount = (taxableValue * cgstRate) / 100;
    const sgstAmount = (taxableValue * sgstRate) / 100;
    const lineTotal = taxableValue + cgstAmount + sgstAmount;

    totalTaxable += taxableValue;
    totalCgst += cgstAmount;
    totalSgst += sgstAmount;

    return {
      srNo: idx + 1,
      productId: item.product_id,
      name: item.product_name,
      brand: item.brand,
      composition: item.composition,
      packSize: item.pack_size || '1 Strip/Unit',
      hsnCode: '300490', // Standard pharmaceutical formulation HSN
      batchNumber: firstBatch.batch_number || 'BATCH-STD',
      expiryDate: firstBatch.expiry_date || 'N/A',
      batchSummary: batchList || 'Standard Allocation',
      quantity: item.quantity,
      unitPrice: item.unit_price,
      taxableValue: Math.round(taxableValue * 100) / 100,
      gstRate: gstRate,
      cgstRate: cgstRate,
      cgstAmount: Math.round(cgstAmount * 100) / 100,
      sgstRate: sgstRate,
      sgstAmount: Math.round(sgstAmount * 100) / 100,
      lineTotal: Math.round(lineTotal * 100) / 100
    };
  });

  const grandTotal = Math.round((totalTaxable + totalCgst + totalSgst) * 100) / 100;

  return {
    ...invoice,
    seller: WHOLESALER_DETAILS,
    buyer: {
      name: invoice.customer_name,
      businessName: `${invoice.customer_name} (Retail Pharmacy)`,
      email: invoice.customer_email,
      phone: invoice.customer_phone || '+91 98000 11223',
      address: invoice.shipping_address || 'Shop 12, Ground Floor, Central Market Road, Mumbai 400001',
      gstin: '27AABCP5678Q1Z2',
      drugLicense: 'DL-20/MH/2023/112233'
    },
    items: invoiceItems,
    totals: {
      taxableAmount: Math.round(totalTaxable * 100) / 100,
      cgstAmount: Math.round(totalCgst * 100) / 100,
      sgstAmount: Math.round(totalSgst * 100) / 100,
      igstAmount: 0,
      totalGst: Math.round((totalCgst + totalSgst) * 100) / 100,
      grandTotal: grandTotal,
      amountInWords: numberToWords(grandTotal)
    }
  };
}

function listInvoices(db, { customerId = null } = {}) {
  const query = `
    SELECT i.id, i.number, i.issued_at, i.payment_status,
           o.id as order_id, o.number as order_number, o.subtotal, o.gst_total, o.grand_total,
           u.name as customer_name, u.email as customer_email
    FROM invoices i
    JOIN orders o ON o.id = i.order_id
    JOIN users u ON u.id = o.customer_id
    ${customerId ? 'WHERE o.customer_id = ?' : ''}
    ORDER BY i.issued_at DESC
  `;
  return customerId ? db.prepare(query).all(customerId) : db.prepare(query).all();
}

function updateInvoicePayment(db, { invoiceId, paymentStatus, amount = null, method = 'BANK_TRANSFER', referenceId = null, actorId }) {
  const tx = db.transaction(() => {
    const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
    if (!inv) throw new Error('Invoice not found');

    db.prepare('UPDATE invoices SET payment_status = ? WHERE id = ?').run(paymentStatus, invoiceId);
    db.prepare('UPDATE orders SET payment_status = ? WHERE id = ?').run(paymentStatus, inv.order_id);

    if (amount && Number(amount) > 0) {
      db.prepare(`
        INSERT INTO payments (id, invoice_id, amount, method, reference_id, paid_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(id(), invoiceId, amount, method, referenceId);
    }

    return getInvoiceById(db, invoiceId);
  });
  return tx();
}

module.exports = {
  generateInvoice,
  getInvoiceById,
  listInvoices,
  updateInvoicePayment,
  WHOLESALER_DETAILS
};
