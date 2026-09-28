const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const multer = require('multer');
const { createWorker } = require('tesseract.js');
const { receiveStock, createOrder, transitionOrder } = require('./services/inventory');
const { parseInvoiceText } = require('./services/invoice-import');
const { saveRestockPreview, applyRestockImport } = require('./services/restock-import');
const { generateInvoice, getInvoiceById, listInvoices, updateInvoicePayment } = require('./services/invoice');
const JWT_SECRET = process.env.JWT_SECRET || 'development-only-change-me';

function createApp(db) {
  const app = express();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/png', 'image/jpeg', 'image/webp'];
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(new Error('Only PNG, JPEG and WEBP images are supported'));
    }
  });

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json());

  function fail(res, err, status = 400) {
    res.status(status).json({ error: err.message || String(err) });
  }

  function auth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET);
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  function roles(...allowed) {
    return (req, res, next) => {
      if (!req.user || !allowed.includes(req.user.role)) return res.status(403).json({ error: 'Permission denied' });
      next();
    };
  }

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(['WHOLESALER', 'CUSTOMER']).default('CUSTOMER'),
        phone: z.string().optional()
      });
      const data = schema.parse(req.body);
      const hash = await bcrypt.hash(data.password, 10);
      const id = require('node:crypto').randomUUID();
      db.prepare('INSERT INTO users (id, name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?, ?)').run(id, data.name, data.email, hash, data.role, data.phone || null);
      const token = jwt.sign({ sub: id, role: data.role, email: data.email, name: data.name }, JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({ token, user: { id, name: data.name, email: data.email, role: data.role } });
    } catch (e) { fail(res, e); }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Invalid email or password' });
      const token = jwt.sign({ sub: user.id, role: user.role, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (e) { fail(res, e); }
  });

  app.get('/api/auth/me', auth, (req, res) => {
    const user = db.prepare('SELECT id, name, email, role, phone FROM users WHERE id = ?').get(req.user.sub);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  });

  // Dashboard route
  app.get('/api/dashboard', auth, roles('WHOLESALER'), (_req, res) => {
    const totalProducts = db.prepare('SELECT COUNT(*) as c FROM products WHERE archived_at IS NULL').get().c;
    const stockStats = db.prepare(`
      SELECT 
        COUNT(DISTINCT product_id) as inStock,
        SUM(available_quantity * purchase_price) as stockValue
      FROM inventory_batches 
      WHERE expiry_date > date('now') AND available_quantity > 0
    `).get();
    const lowStock = db.prepare(`
      SELECT COUNT(*) as c FROM products p 
      LEFT JOIN (SELECT product_id, SUM(available_quantity) as total_avail FROM inventory_batches WHERE expiry_date > date('now') GROUP BY product_id) b ON b.product_id = p.id
      WHERE p.archived_at IS NULL AND COALESCE(b.total_avail, 0) < p.minimum_stock
    `).get().c;
    const expiringSoon = db.prepare(`
      SELECT COUNT(*) as c FROM inventory_batches 
      WHERE expiry_date > date('now') AND expiry_date <= date('now', '+90 days') AND available_quantity > 0
    `).get().c;
    const pendingOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'PENDING'").get().c;
    const pendingRequirements = db.prepare("SELECT COUNT(*) as c FROM requirements WHERE status = 'NEW'").get().c;

    res.json({
      totalProducts,
      inStock: stockStats.inStock || 0,
      outOfStock: Math.max(0, totalProducts - (stockStats.inStock || 0)),
      lowStock,
      expiringSoon,
      pendingOrders,
      pendingRequirements,
      stockValue: Math.round((stockStats.stockValue || 0) * 100) / 100
    });
  });

  // Categories
  app.get('/api/categories', auth, (_req, res) => {
    res.json({ items: db.prepare('SELECT * FROM categories ORDER BY name ASC').all() });
  });

  app.post('/api/categories', auth, roles('WHOLESALER'), (req, res) => {
    try {
      const { name } = z.object({ name: z.string().min(2) }).parse(req.body);
      const id = require('node:crypto').randomUUID();
      db.prepare('INSERT INTO categories (id, name) VALUES (?, ?)').run(id, name);
      res.status(201).json({ id, name });
    } catch (e) { fail(res, e); }
  });

  // Products
  app.get('/api/products', auth, roles('WHOLESALER'), (_req, res) => {
    const items = db.prepare(`
      SELECT p.*, c.name as category,
        COALESCE((SELECT SUM(available_quantity) FROM inventory_batches WHERE product_id = p.id AND expiry_date > date('now')), 0) as available_quantity
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.archived_at IS NULL
      ORDER BY p.name ASC
    `).all();
    res.json({ items });
  });

  app.post('/api/products', auth, roles('WHOLESALER'), (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(2),
        brand: z.string().min(2),
        composition: z.string().min(2),
        categoryId: z.string(),
        manufacturer: z.string().optional(),
        packSize: z.string().optional(),
        classification: z.string().optional(),
        description: z.string().optional(),
        mrp: z.number().nonnegative(),
        wholesalePrice: z.number().nonnegative(),
        gstRate: z.number().nonnegative().default(12),
        minimumStock: z.number().int().nonnegative().default(10),
        marketplaceVisible: z.boolean().default(true),
        availabilityStatus: z.enum(['AVAILABLE', 'UNAVAILABLE', 'DISCONTINUED']).default('AVAILABLE')
      });
      const data = schema.parse(req.body);
      const id = require('node:crypto').randomUUID();
      db.prepare(`
        INSERT INTO products (id, name, brand, composition, category_id, manufacturer, pack_size, classification, description, mrp, wholesale_price, gst_rate, minimum_stock, marketplace_visible, availability_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, data.name, data.brand, data.composition, data.categoryId, data.manufacturer || null, data.packSize || null, data.classification || null, data.description || null, data.mrp, data.wholesalePrice, data.gstRate, data.minimumStock, data.marketplaceVisible ? 1 : 0, data.availabilityStatus);
      res.status(201).json({ id });
    } catch (e) { fail(res, e); }
  });

  app.patch('/api/products/:id', auth, roles('WHOLESALER'), (req, res) => {
    try {
      const schema = z.object({
        categoryId: z.string().optional(),
        wholesalePrice: z.number().nonnegative().optional(),
        mrp: z.number().nonnegative().optional(),
        minimumStock: z.number().int().nonnegative().optional(),
        marketplaceVisible: z.boolean().optional(),
        availabilityStatus: z.enum(['AVAILABLE', 'UNAVAILABLE', 'DISCONTINUED']).optional()
      });
      const data = schema.parse(req.body);
      const product = db.prepare('SELECT * FROM products WHERE id = ? AND archived_at IS NULL').get(req.params.id);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      db.prepare(`
        UPDATE products SET
          category_id = COALESCE(?, category_id),
          wholesale_price = COALESCE(?, wholesale_price),
          mrp = COALESCE(?, mrp),
          minimum_stock = COALESCE(?, minimum_stock),
          marketplace_visible = COALESCE(?, marketplace_visible),
          availability_status = COALESCE(?, availability_status),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        data.categoryId,
        data.wholesalePrice,
        data.mrp,
        data.minimumStock,
        data.marketplaceVisible !== undefined ? (data.marketplaceVisible ? 1 : 0) : null,
        data.availabilityStatus,
        req.params.id
      );

      const raw = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
      res.json({
        product: {
          ...raw,
          categoryId: raw.category_id,
          wholesalePrice: raw.wholesale_price,
          mrp: raw.mrp,
          minimumStock: raw.minimum_stock,
          marketplaceVisible: Boolean(raw.marketplace_visible),
          availabilityStatus: raw.availability_status
        }
      });
    } catch (e) { fail(res, e); }
  });

  // Customer Catalogue
  app.get('/api/catalogue', auth, (_req, res) => {
    const items = db.prepare(`
      SELECT p.id, p.name, p.brand, p.composition, p.manufacturer, p.pack_size, p.classification,
             p.mrp, p.wholesale_price, p.gst_rate, p.marketplace_visible as marketplaceVisible, c.name as category,
             COALESCE((SELECT SUM(available_quantity) FROM inventory_batches WHERE product_id = p.id AND expiry_date > date('now')), 0) as availableQuantity
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.archived_at IS NULL AND p.marketplace_visible = 1 AND p.availability_status = 'AVAILABLE'
      ORDER BY p.name ASC
    `).all();
    res.json({ items: items.map(i => ({ ...i, marketplaceVisible: Boolean(i.marketplaceVisible) })) });
  });

  // Inventory Batches
  app.get('/api/inventory/batches', auth, roles('WHOLESALER'), (_req, res) => {
    const items = db.prepare(`
      SELECT b.*, p.name as product_name, p.brand as product_brand,
             ROUND(JULIANDAY(b.expiry_date) - JULIANDAY('now'), 1) as days_remaining
      FROM inventory_batches b
      JOIN products p ON p.id = b.product_id
      ORDER BY b.expiry_date ASC
    `).all();
    res.json({ items });
  });

  app.post('/api/inventory/receive', auth, roles('WHOLESALER'), (req, res) => {
    try {
      const schema = z.object({
        productId: z.string(),
        batchNumber: z.string().min(1),
        expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        quantity: z.number().int().positive(),
        purchasePrice: z.number().nonnegative(),
        sellingPrice: z.number().nonnegative().optional(),
        warehouse: z.string().optional(),
        notes: z.string().optional()
      });
      const data = schema.parse(req.body);
      const batchId = receiveStock(db, { ...data, actorId: req.user.sub });
      res.status(201).json({ batchId });
    } catch (e) { fail(res, e); }
  });

  // Orders
  app.get('/api/orders', auth, (req, res) => {
    const own = req.user.role === 'CUSTOMER';
    const items = db.prepare(`
      SELECT o.*, (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
             u.name as customer_name
      FROM orders o
      JOIN users u ON u.id = o.customer_id
      ${own ? 'WHERE o.customer_id = ?' : ''}
      ORDER BY o.created_at DESC
    `).all(...(own ? [req.user.sub] : []));
    res.json({ items });
  });

  app.post('/api/orders', auth, roles('CUSTOMER'), (req, res) => {
    try {
      const data = z.object({
        items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive() })).min(1),
        shippingAddress: z.string().optional()
      }).parse(req.body);
      res.status(201).json({ order: createOrder(db, { ...data, customerId: req.user.sub, actorId: req.user.sub }) });
    } catch (e) { fail(res, e); }
  });

  app.get('/api/orders/:id', auth, (req, res) => {
    const own = req.user.role === 'CUSTOMER';
    const order = db.prepare(`
      SELECT o.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone
      FROM orders o
      JOIN users u ON u.id = o.customer_id
      WHERE o.id = ? ${own ? 'AND o.customer_id = ?' : ''}
    `).get(req.params.id, ...(own ? [req.user.sub] : []));

    if (!order) return res.status(404).json({ error: 'Order not found' });
    const items = db.prepare(`
      SELECT oi.*, p.brand, p.composition, p.pack_size
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ?
    `).all(req.params.id);
    const allocations = db.prepare(`
      SELECT a.*, b.expiry_date
      FROM order_allocations a
      JOIN inventory_batches b ON b.id = a.batch_id
      WHERE a.order_id = ?
    `).all(req.params.id);

    res.json({ order: { ...order, items, allocations } });
  });

  app.patch('/api/orders/:id/status', auth, roles('WHOLESALER'), (req, res) => {
    try {
      const { status } = z.object({
        status: z.enum(['CONFIRMED', 'REJECTED', 'PROCESSING', 'PACKED', 'DISPATCHED', 'DELIVERED', 'CANCELLED'])
      }).parse(req.body);
      const order = transitionOrder(db, { orderId: req.params.id, status, actorId: req.user.sub });
      res.json({ order });
    } catch (e) { fail(res, e); }
  });

  // Invoicing Routes
  app.post('/api/invoices/generate', auth, roles('WHOLESALER'), (req, res) => {
    try {
      const { orderId, dueDate } = z.object({
        orderId: z.string(),
        dueDate: z.string().optional()
      }).parse(req.body);
      const invoice = generateInvoice(db, { orderId, actorId: req.user.sub, dueDate });
      res.status(201).json({ invoice });
    } catch (e) { fail(res, e); }
  });

  app.get('/api/invoices', auth, (req, res) => {
    try {
      const customerId = req.user.role === 'CUSTOMER' ? req.user.sub : null;
      const items = listInvoices(db, { customerId });
      res.json({ items });
    } catch (e) { fail(res, e); }
  });

  app.get('/api/invoices/:id', auth, (req, res) => {
    try {
      const invoice = getInvoiceById(db, req.params.id);
      if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
      if (req.user.role === 'CUSTOMER' && invoice.customer_id !== req.user.sub) {
        return res.status(403).json({ error: 'Permission denied' });
      }
      res.json({ invoice });
    } catch (e) { fail(res, e); }
  });

  app.get('/api/invoices/by-order/:orderId', auth, (req, res) => {
    try {
      const invRow = db.prepare('SELECT id FROM invoices WHERE order_id = ?').get(req.params.orderId);
      if (!invRow) return res.status(404).json({ error: 'No invoice generated yet for this order' });
      const invoice = getInvoiceById(db, invRow.id);
      if (req.user.role === 'CUSTOMER' && invoice.customer_id !== req.user.sub) {
        return res.status(403).json({ error: 'Permission denied' });
      }
      res.json({ invoice });
    } catch (e) { fail(res, e); }
  });

  app.patch('/api/invoices/:id/payment', auth, roles('WHOLESALER'), (req, res) => {
    try {
      const { paymentStatus, amount, method, referenceId } = z.object({
        paymentStatus: z.enum(['PAID', 'PENDING', 'OVERDUE', 'PARTIAL']),
        amount: z.number().positive().optional(),
        method: z.string().optional(),
        referenceId: z.string().optional()
      }).parse(req.body);
      const invoice = updateInvoicePayment(db, {
        invoiceId: req.params.id,
        paymentStatus,
        amount,
        method,
        referenceId,
        actorId: req.user.sub
      });
      res.json({ invoice });
    } catch (e) { fail(res, e); }
  });

  // Invoice OCR Restock Image Upload
  app.post('/api/restock/invoice-image', auth, roles('WHOLESALER'), upload.single('invoice'), async (req, res) => {
    try {
      if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'Invoice image file is required' });
      const worker = await createWorker('eng');
      const ret = await worker.recognize(req.file.buffer);
      await worker.terminate();
      const ocrText = ret?.data?.text || '';
      const parsedItems = parseInvoiceText(ocrText);
      if (!parsedItems.length) return res.status(422).json({ error: 'No valid medicine invoice line items detected in image', extracted_text: ocrText });
      const preview = saveRestockPreview(db, { filename: req.file.originalname || 'invoice_upload.png', extractedText: ocrText, items: parsedItems, actorId: req.user.sub });
      const applyResult = applyRestockImport(db, { importId: preview.importId, actorId: req.user.sub });
      res.status(201).json({
        success: true,
        import_id: preview.importId,
        applied: applyResult.applied,
        itemCount: applyResult.appliedCount,
        applied_count: applyResult.appliedCount,
        unmatched: applyResult.unmatched,
        items: applyResult.items
      });
    } catch (e) { fail(res, e); }
  });

  // Requirements / Medicine Requests
  app.get('/api/requirements', auth, (req, res) => {
    const own = req.user.role === 'CUSTOMER';
    res.json({
      items: db.prepare(`
        SELECT r.*, u.name as customer_name
        FROM requirements r
        JOIN users u ON u.id = r.customer_id
        ${own ? 'WHERE r.customer_id = ?' : ''}
        ORDER BY r.created_at DESC
      `).all(...(own ? [req.user.sub] : []))
    });
  });

  app.post('/api/requirements', auth, roles('CUSTOMER'), (req, res) => {
    try {
      const data = z.object({
        medicineName: z.string().min(2),
        composition: z.string().optional(),
        quantity: z.number().int().positive(),
        notes: z.string().optional(),
        priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL')
      }).parse(req.body);
      const id = require('node:crypto').randomUUID();
      db.prepare('INSERT INTO requirements (id, customer_id, medicine_name, composition, quantity, notes, priority) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, req.user.sub, data.medicineName, data.composition || null, data.quantity, data.notes || null, data.priority);
      res.status(201).json({ item: { id, medicine_name: data.medicineName, quantity: data.quantity, priority: data.priority } });
    } catch (e) { fail(res, e); }
  });

  app.use(express.static(require('node:path').join(__dirname, '..', 'public')));
  app.use((err, _req, res, _next) => res.status(500).json({ error: err.message || 'Internal server error' }));
  return app;
}

module.exports = { createApp };
