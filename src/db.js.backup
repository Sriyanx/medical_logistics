const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('WHOLESALER','CUSTOMER')),
  phone TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, brand TEXT NOT NULL, composition TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id), manufacturer TEXT, pack_size TEXT,
  classification TEXT, description TEXT, storage_instructions TEXT, notes TEXT,
  image_url TEXT, mrp REAL NOT NULL CHECK(mrp >= 0), wholesale_price REAL NOT NULL CHECK(wholesale_price >= 0),
  gst_rate REAL NOT NULL DEFAULT 0 CHECK(gst_rate >= 0), minimum_stock INTEGER NOT NULL DEFAULT 0 CHECK(minimum_stock >= 0),
  marketplace_visible INTEGER NOT NULL DEFAULT 1, availability_status TEXT NOT NULL DEFAULT 'AVAILABLE'
    CHECK(availability_status IN ('AVAILABLE','UNAVAILABLE','DISCONTINUED')),
  archived_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS inventory_batches (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), batch_number TEXT NOT NULL,
  expiry_date TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity >= 0), reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK(reserved_quantity >= 0),
  available_quantity INTEGER NOT NULL CHECK(available_quantity >= 0), purchase_price REAL NOT NULL DEFAULT 0,
  selling_price REAL, warehouse TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, batch_number)
);
CREATE INDEX IF NOT EXISTS idx_batches_product_expiry ON inventory_batches(product_id, expiry_date);
CREATE TABLE IF NOT EXISTS stock_transactions (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), batch_id TEXT REFERENCES inventory_batches(id),
  type TEXT NOT NULL CHECK(type IN ('PURCHASE_RECEIVED','SALE','SALES_RETURN','PURCHASE_RETURN','DAMAGED','EXPIRED','MANUAL_ADJUSTMENT','STOCK_TRANSFER','STOCK_CORRECTION','RESERVATION','RESERVATION_RELEASE')),
  quantity INTEGER NOT NULL, reference_type TEXT, reference_id TEXT, notes TEXT, actor_id TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_product ON stock_transactions(product_id, created_at);
CREATE TABLE IF NOT EXISTS carts (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL UNIQUE REFERENCES users(id), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS cart_items (id TEXT PRIMARY KEY, cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE, product_id TEXT NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL CHECK(quantity > 0), UNIQUE(cart_id, product_id));
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, number TEXT NOT NULL UNIQUE, customer_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'PENDING'
  CHECK(status IN ('PENDING','CONFIRMED','REJECTED','PROCESSING','PACKED','DISPATCHED','DELIVERED','CANCELLED','RETURNED')),
  subtotal REAL NOT NULL, gst_total REAL NOT NULL, grand_total REAL NOT NULL, shipping_address TEXT, payment_status TEXT NOT NULL DEFAULT 'PENDING', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id, created_at);
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id TEXT NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0), unit_price REAL NOT NULL, gst_rate REAL NOT NULL, line_total REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS order_allocations (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, order_item_id TEXT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE, batch_id TEXT NOT NULL REFERENCES inventory_batches(id), batch_number TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0), UNIQUE(order_item_id, batch_id));
CREATE TABLE IF NOT EXISTS order_status_history (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, status TEXT NOT NULL, actor_id TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS requirements (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES users(id), medicine_name TEXT NOT NULL, composition TEXT, quantity INTEGER NOT NULL, notes TEXT, priority TEXT NOT NULL DEFAULT 'NORMAL', status TEXT NOT NULL DEFAULT 'NEW', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, number TEXT NOT NULL UNIQUE, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id), issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, payment_status TEXT NOT NULL DEFAULT 'PENDING');
CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES invoices(id), amount REAL NOT NULL CHECK(amount > 0), method TEXT NOT NULL, reference_id TEXT, paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS suppliers (id TEXT PRIMARY KEY, name TEXT NOT NULL, contact_person TEXT, phone TEXT, email TEXT, address TEXT, gst_number TEXT, archived_at TEXT);
CREATE TABLE IF NOT EXISTS restock_imports (
  id TEXT PRIMARY KEY, filename TEXT NOT NULL, extracted_text TEXT, status TEXT NOT NULL CHECK(status IN ('SCANNED','APPLIED','FAILED')), item_count INTEGER NOT NULL DEFAULT 0,
  actor_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, applied_at TEXT
);
CREATE TABLE IF NOT EXISTS restock_import_items (
  id TEXT PRIMARY KEY, import_id TEXT NOT NULL REFERENCES restock_imports(id) ON DELETE CASCADE, product_id TEXT REFERENCES products(id),
  raw_product_name TEXT NOT NULL, batch_number TEXT NOT NULL, expiry_date TEXT NOT NULL, quantity INTEGER NOT NULL, purchase_price REAL NOT NULL
);
`;

function initializeDatabase(db) { db.exec(SCHEMA); return db; }
function openDatabase(filename = path.join(process.cwd(), 'data', 'medical.db')) { fs.mkdirSync(path.dirname(filename), { recursive: true }); const db = new Database(filename); initializeDatabase(db); return db; }
module.exports = { initializeDatabase, openDatabase };
