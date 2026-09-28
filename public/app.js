/* ===== Apex MedSupply — Accessible, Simple & Robust Web App ===== */
const state = {
  token: localStorage.token || '',
  user: JSON.parse(localStorage.user || 'null'),
  page: 'dashboard',
  products: [],
  categories: [],
  manageProducts: {},
  selectedCategory: 'all',
  inStockOnly: false,
  searchQuery: '',
  toast: null,
  toastTimeout: null
};

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);
const esc = s => String(s ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));

// API Client
async function api(url, options = {}) {
  const isForm = options.body instanceof FormData;
  const res = await fetch('/api' + url, {
    ...options,
    headers: {
      ...(isForm ? {} : { 'content-type': 'application/json' }),
      ...(state.token ? { authorization: 'Bearer ' + state.token } : {}),
      ...(options.headers || {})
    }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Request failed');
  return body;
}

// Toast notification
function showToast(message, type = 'info') {
  if (state.toastTimeout) clearTimeout(state.toastTimeout);
  state.toast = { message, type };
  renderToast();
  state.toastTimeout = setTimeout(() => {
    state.toast = null;
    renderToast();
  }, 4500);
}
function hideToast() {
  state.toast = null;
  renderToast();
}
function renderToast() {
  const el = $('#toast-area');
  if (!el) return;
  if (!state.toast) {
    el.innerHTML = '';
    return;
  }
  const icons = { success: '✓', danger: '✕', warning: '⚠️', info: 'ℹ️' };
  el.innerHTML = `
    <div class="toast" role="alert" aria-live="assertive">
      <span><strong>${icons[state.toast.type] || 'ℹ️'}</strong> &nbsp; ${esc(state.toast.message)}</span>
      <button class="toast-btn-close" onclick="hideToast()" aria-label="Dismiss notification">✕</button>
    </div>
  `;
}

// Modal management
function openModal(title, bodyHtml, actionsHtml = '') {
  closeModal();
  const modalHtml = `
    <div class="modal-overlay" id="active-modal" onclick="if(event.target===this)closeModal()">
      <div class="modal-container" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
          <h2 id="modal-title">${esc(title)}</h2>
          <button class="modal-close" onclick="closeModal()" aria-label="Close dialog">✕</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        ${actionsHtml ? `<div class="modal-actions">${actionsHtml}</div>` : ''}
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}
function closeModal() {
  $('#active-modal')?.remove();
}

// Global keyboard listeners
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// App Layout Shell
function shell(content) {
  const isWholesaler = state.user && state.user.role === 'WHOLESALER';
  const navItems = isWholesaler
    ? [
        ['dashboard', '📊 Overview'],
        ['products', '💊 Catalogue'],
        ['inventory', '📦 Inventory & Batches'],
        ['orders', '🛒 Orders'],
        ['invoices', '🧾 Tax Invoices'],
        ['requirements', '📋 Supply Requests']
      ]
    : [
        ['marketplace', '💊 Order Medicines'],
        ['orders', '📦 My Orders'],
        ['invoices', '🧾 Invoices'],
        ['requirements', '📝 Request Medicine']
      ];

  return `
    <header class="topbar">
      <div class="brand">
        APEX <span>MEDSUPPLY</span>
        <span class="brand-badge">${isWholesaler ? 'Wholesaler Admin' : 'Pharmacy Store'}</span>
      </div>
      <nav class="nav" aria-label="Main Navigation">
        ${navItems
          .map(
            ([p, label]) => `
          <button class="${state.page === p ? 'active' : ''}" onclick="go('${p}')" aria-current="${state.page === p ? 'page' : 'false'}">
            ${label}
          </button>
        `
          )
          .join('')}
      </nav>
      <div class="user-area">
        <div class="user-info">
          <div class="user-name">${esc(state.user.name)}</div>
          <div class="user-role">${esc(state.user.email)}</div>
        </div>
        <button class="btn btn-sm btn-signout" onclick="logout()" title="Sign out of account">Sign out</button>
      </div>
    </header>

    <main class="layout" id="main-content">
      ${content}
    </main>

    <div class="mobile-nav" aria-label="Mobile Navigation">
      ${navItems
        .map(
          ([p, label]) => `
        <button class="${state.page === p ? 'active' : ''}" onclick="go('${p}')">
          ${label}
        </button>
      `
        )
        .join('')}
    </div>

    <div class="toast-container" id="toast-area"></div>
  `;
}

/* ==========================================================================
   VIEW: Login Screen
   ========================================================================== */
function loginView() {
  return `
    <div class="login-wrap">
      <div class="login-box">
        <div class="login-brand">APEX <span>MEDSUPPLY</span></div>
        <div class="login-tagline">Pharmaceutical Wholesale & Pharmacy Ordering Platform</div>
        
        <div class="demo-logins">
          <div class="demo-logins-title">⚡ 1-Click Fast Demo Login</div>
          <div class="demo-btns">
            <button class="btn btn-demo" onclick="quickLogin('admin@apexmed.example.test', 'DemoPass123!')">
              🏥 Wholesaler Admin
              <span>Full inventory & order control</span>
            </button>
            <button class="btn btn-demo" onclick="quickLogin('citycare@example.test', 'DemoPass123!')">
              💊 Pharmacy Store
              <span>Marketplace ordering & requests</span>
            </button>
          </div>
        </div>

        <form onsubmit="handleLoginSubmit(event)">
          <div class="form-group">
            <label for="login-email">Email Address</label>
            <input type="email" id="login-email" name="email" required value="admin@apexmed.example.test" autocomplete="username">
          </div>
          <div class="form-group">
            <label for="login-password">Password</label>
            <input type="password" id="login-password" name="password" required value="DemoPass123!" autocomplete="current-password">
          </div>
          <button type="submit" class="btn btn-primary btn-lg" style="width: 100%; margin-top: 10px;">
            Sign In to Account →
          </button>
        </form>
      </div>
    </div>
    <div class="toast-container" id="toast-area"></div>
  `;
}

async function quickLogin(email, password) {
  $('#login-email').value = email;
  $('#login-password').value = password;
  await doLogin(email, password);
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  await doLogin(f.get('email'), f.get('password'));
}

async function doLogin(email, password) {
  try {
    const d = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    state.token = d.token;
    state.user = d.user;
    state.page = d.user.role === 'WHOLESALER' ? 'dashboard' : 'marketplace';
    localStorage.token = d.token;
    localStorage.user = JSON.stringify(d.user);
    render();
    showToast(`Welcome back, ${d.user.name}!`, 'success');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function logout() {
  localStorage.clear();
  state.token = '';
  state.user = null;
  state.page = 'dashboard';
  render();
}

function go(page) {
  state.page = page;
  render();
}

/* ==========================================================================
   VIEW: Wholesaler Dashboard
   ========================================================================== */
async function dashboardView() {
  const d = await api('/dashboard');
  return shell(`
    <div class="page-header">
      <div class="page-header-text">
        <h1>Wholesale Operations Overview</h1>
        <p>Live inventory statistics, order flow, and batch expiry tracking.</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary" onclick="openInvoiceScanModal()">📷 Scan Invoice Photo</button>
        <button class="btn btn-secondary" onclick="openStockModal()">➕ Receive Stock</button>
      </div>
    </div>

    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Total Catalogued Medicines</div>
        <div class="metric-value">${d.totalProducts}</div>
        <div class="metric-note">Active product lines</div>
      </div>
      <div class="metric-card success">
        <div class="metric-label">In Stock Products</div>
        <div class="metric-value">${d.inStock}</div>
        <div class="metric-note">Available for pharmacies to order</div>
      </div>
      <div class="metric-card ${d.lowStock > 0 ? 'warning' : ''}">
        <div class="metric-label">Low Stock Alerts</div>
        <div class="metric-value">${d.lowStock}</div>
        <div class="metric-note">Below safety threshold</div>
      </div>
      <div class="metric-card ${d.expiringSoon > 0 ? 'alert' : ''}">
        <div class="metric-label">Expiring Soon (≤ 90 Days)</div>
        <div class="metric-value">${d.expiringSoon}</div>
        <div class="metric-note">FEFO prioritized disposal</div>
      </div>
      <div class="metric-card ${d.pendingOrders > 0 ? 'alert' : ''}">
        <div class="metric-label">Pending Orders</div>
        <div class="metric-value">${d.pendingOrders}</div>
        <div class="metric-note">Awaiting wholesaler confirmation</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total Stock Valuation</div>
        <div class="metric-value" style="font-size: 26px;">${money(d.stockValue)}</div>
        <div class="metric-note">Purchase cost valuation</div>
      </div>
    </div>

    <div class="page-header-text" style="margin: 32px 0 16px 0;">
      <h2 style="font-size: 20px; font-weight: 600; margin: 0;">Quick Operational Workflows</h2>
    </div>

    <div class="quick-actions-grid">
      <div class="action-card">
        <h3>📷 Invoice Picture Auto-Restock</h3>
        <p>Take or upload a photo of a vendor purchase invoice. OCR automatically identifies medicines, batches, quantities, and rates to update inventory.</p>
        <button class="btn btn-primary" onclick="openInvoiceScanModal()">Scan Invoice →</button>
      </div>
      <div class="action-card">
        <h3>📦 Inventory & Batch Batches</h3>
        <p>Inspect physical inventory batches, FEFO allocation sequences, and expiry timelines across warehouses.</p>
        <button class="btn btn-secondary" onclick="go('inventory')">View Batches →</button>
      </div>
      <div class="action-card">
        <h3>🛒 Customer Orders (${d.pendingOrders} pending)</h3>
        <p>Review incoming pharmacy orders. Confirming an order allocates and deducts reserved batch quantities.</p>
        <button class="btn btn-secondary" onclick="go('orders')">Manage Orders →</button>
      </div>
      <div class="action-card">
        <h3>💊 Manage Catalogue</h3>
        <p>Add new medicines, adjust wholesale rates, toggle customer visibility, or update availability statuses.</p>
        <button class="btn btn-secondary" onclick="go('products')">Manage Catalogue →</button>
      </div>
    </div>
  `);
}

/* ==========================================================================
   VIEW: Wholesaler Catalogue Management
   ========================================================================== */
async function productsView() {
  const [d, categoriesRes] = await Promise.all([api('/products'), api('/categories')]);
  state.manageProducts = Object.fromEntries(d.items.map(p => [p.id, p]));
  state.categories = categoriesRes.items;

  return shell(`
    <div class="page-header">
      <div class="page-header-text">
        <h1>Medicine Catalogue Management</h1>
        <p>Manage pricing, medical store marketplace visibility, and product records.</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary" onclick="openAddProductModal()">➕ Add New Medicine</button>
      </div>
    </div>

    <div class="card-table-wrap">
      <div class="table-toolbar">
        <h2>All Products (${d.items.length})</h2>
        <div class="table-search">
          <span style="color: var(--text-muted); margin-right: 8px;">🔍</span>
          <input type="text" placeholder="Filter medicines, brands, formulas..." oninput="filterAdminProducts(this.value)">
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table" id="admin-products-table">
          <thead>
            <tr>
              <th>Medicine & Brand</th>
              <th>Composition</th>
              <th>Category</th>
              <th>MRP</th>
              <th>Wholesale Rate</th>
              <th>Available Stock</th>
              <th>Marketplace Visibility</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${renderAdminProductRows(d.items)}
          </tbody>
        </table>
      </div>
    </div>
  `);
}

function renderAdminProductRows(items) {
  if (!items.length) {
    return `<tr><td colspan="9" style="text-align: center; padding: 32px; color: var(--text-muted);">No medicines found matching criteria.</td></tr>`;
  }
  return items
    .map(
      p => `
    <tr>
      <td>
        <strong>${esc(p.name)}</strong>
        <div style="font-size: 12px; color: var(--text-muted);">${esc(p.brand)} ${p.pack_size ? `· ${esc(p.pack_size)}` : ''}</div>
      </td>
      <td><span style="font-size: 13px;">${esc(p.composition)}</span></td>
      <td><span class="badge badge-neutral">${esc(p.category)}</span></td>
      <td style="color: var(--text-light); text-decoration: line-through;">${money(p.mrp)}</td>
      <td><strong style="color: var(--primary); font-family: var(--font-mono);">${money(p.wholesale_price)}</strong></td>
      <td>
        <strong style="font-size: 15px; color: ${p.available_quantity > 0 ? 'var(--success)' : 'var(--danger)'};">
          ${p.available_quantity} units
        </strong>
      </td>
      <td>
        <span class="badge ${p.marketplace_visible ? 'badge-success' : 'badge-neutral'}">
          ${p.marketplace_visible ? '✓ Visible to Stores' : '✕ Hidden'}
        </span>
      </td>
      <td>
        <span class="badge ${p.availability_status === 'AVAILABLE' && p.available_quantity > 0 ? 'badge-success' : p.availability_status === 'AVAILABLE' ? 'badge-warning' : 'badge-danger'}">
          ${p.availability_status === 'AVAILABLE' ? (p.available_quantity > 0 ? 'In Stock' : 'Out of Stock') : esc(p.availability_status)}
        </span>
      </td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="openEditMedicineModal('${p.id}')">✏️ Edit</button>
      </td>
    </tr>
  `
    )
    .join('');
}

function filterAdminProducts(query) {
  const q = query.toLowerCase().trim();
  const all = Object.values(state.manageProducts);
  const filtered = all.filter(p => [p.name, p.brand, p.composition, p.category].join(' ').toLowerCase().includes(q));
  const tbody = $('#admin-products-table tbody');
  if (tbody) tbody.innerHTML = renderAdminProductRows(filtered);
}

/* ==========================================================================
   VIEW: Wholesaler Inventory & Batches
   ========================================================================== */
async function inventoryView() {
  const [d, productsRes] = await Promise.all([api('/inventory/batches'), api('/products')]);
  state.products = productsRes.items;

  return shell(`
    <div class="page-header">
      <div class="page-header-text">
        <h1>Inventory & Batch Stock</h1>
        <p>FEFO (First-Expiry, First-Out) batch tracking, warehouse allocations, and safety stock.</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary" onclick="openInvoiceScanModal()">📷 Scan Invoice Photo</button>
        <button class="btn btn-secondary" onclick="openStockModal()">➕ Receive Stock</button>
      </div>
    </div>

    <div class="card-table-wrap">
      <div class="table-toolbar">
        <h2>Active Batches (${d.items.length})</h2>
        <div class="table-search">
          <span style="color: var(--text-muted); margin-right: 8px;">🔍</span>
          <input type="text" placeholder="Filter batch number, medicine..." oninput="filterBatches(this.value)">
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table" id="batches-table">
          <thead>
            <tr>
              <th>Medicine Name</th>
              <th>Batch Number</th>
              <th>Expiry Date</th>
              <th>Days Left</th>
              <th>On Hand</th>
              <th>Reserved (Orders)</th>
              <th>Sellable Available</th>
              <th>Warehouse</th>
            </tr>
          </thead>
          <tbody>
            ${renderBatchRows(d.items)}
          </tbody>
        </table>
      </div>
    </div>
  `);
}

function renderBatchRows(items) {
  if (!items.length) {
    return `<tr><td colspan="8" style="text-align: center; padding: 32px; color: var(--text-muted);">No inventory batches found.</td></tr>`;
  }
  return items
    .map(b => {
      const days = Math.ceil(b.days_remaining);
      const expiryBadge = days <= 0 ? 'badge-danger' : days <= 90 ? 'badge-warning' : 'badge-info';
      const expiryText = days <= 0 ? 'EXPIRED' : `${days} days left`;
      return `
      <tr>
        <td><strong>${esc(b.product_name)}</strong></td>
        <td><code style="background: #f4f5f7; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${esc(b.batch_number)}</code></td>
        <td><strong>${esc(b.expiry_date)}</strong></td>
        <td><span class="badge ${expiryBadge}">${expiryText}</span></td>
        <td>${b.quantity} units</td>
        <td style="color: var(--warning);">${b.reserved_quantity} units</td>
        <td><strong style="color: var(--success); font-size: 15px;">${b.available_quantity} units</strong></td>
        <td><span class="badge badge-neutral">${esc(b.warehouse || 'Main Hub')}</span></td>
      </tr>
    `;
    })
    .join('');
}

/* ==========================================================================
   VIEW: Customer Marketplace (Pharmacy Ordering)
   ========================================================================== */
async function marketplaceView() {
  const d = await api('/catalogue');
  state.products = d.items;

  // Extract unique categories
  const categories = ['all', ...new Set(d.items.map(p => p.category).filter(Boolean))];

  return shell(`
    <div class="page-header">
      <div class="page-header-text">
        <h1>Order Medicines</h1>
        <p>Direct wholesale catalogue with real-time stock availability and instant ordering.</p>
      </div>
    </div>

    <div class="marketplace-layout">
      <aside class="filters-sidebar" aria-label="Product filters">
        <h3>Filter Catalogue</h3>
        <div class="filter-group">
          <label class="filter-label" for="search-input">Search Medicine</label>
          <input type="text" id="search-input" class="filter-input" placeholder="e.g. Paracetamol, Cipla..." oninput="handleMarketSearch(this.value)" value="${esc(state.searchQuery)}">
        </div>

        <div class="filter-group">
          <label class="filter-label">Categories</label>
          <div class="category-chips">
            ${categories
              .map(
                cat => `
              <button class="chip-btn ${state.selectedCategory === cat ? 'active' : ''}" onclick="selectCategory('${esc(cat)}')">
                <span>${cat === 'all' ? 'All Medicines' : esc(cat)}</span>
                <span style="font-size: 11px; opacity: 0.7;">
                  ${cat === 'all' ? d.items.length : d.items.filter(p => p.category === cat).length}
                </span>
              </button>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="filter-group">
          <label class="form-check">
            <input type="checkbox" id="in-stock-filter" onchange="toggleInStockOnly(this.checked)" ${state.inStockOnly ? 'checked' : ''}>
            <span>In Stock Only</span>
          </label>
        </div>
      </aside>

      <section>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h2 style="font-size: 18px; font-weight: 600; margin: 0;">
            <span id="product-count">${filterProductsList().length}</span> medicines found
          </h2>
        </div>
        <div class="products-grid" id="market-products-grid">
          ${renderMarketCards(filterProductsList())}
        </div>
      </section>
    </div>
  `);
}

function filterProductsList() {
  let list = state.products;
  if (state.selectedCategory && state.selectedCategory !== 'all') {
    list = list.filter(p => p.category === state.selectedCategory);
  }
  if (state.inStockOnly) {
    list = list.filter(p => p.availableQuantity > 0);
  }
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase().trim();
    list = list.filter(p => [p.name, p.brand, p.composition, p.manufacturer].join(' ').toLowerCase().includes(q));
  }
  return list;
}

function renderMarketCards(items) {
  if (!items.length) {
    return `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🔍</div>
        <h3>No medicines found</h3>
        <p>Try clearing your search or category filter, or request an unlisted medicine.</p>
        <button class="btn btn-primary" onclick="openRequestModal()">Request This Medicine →</button>
      </div>
    `;
  }
  return items
    .map(
      p => `
    <article class="product-card">
      <div>
        <div class="product-card-head">
          <div class="product-icon">✚</div>
          <span class="badge ${p.availableQuantity > 0 ? 'badge-success' : 'badge-danger'}">
            ${p.availableQuantity > 0 ? `✓ In Stock (${p.availableQuantity})` : '✕ Out of Stock'}
          </span>
        </div>
        <h3 class="product-title">${esc(p.name)}</h3>
        <div class="product-meta">
          <strong>${esc(p.brand)}</strong><br>
          <span>Formula: ${esc(p.composition)}</span>
          ${p.pack_size ? `<br><span>Pack: ${esc(p.pack_size)}</span>` : ''}
        </div>
      </div>

      <div>
        <div class="product-pricing">
          <div class="price-tag">
            <span class="price-label">Wholesale Rate</span>
            <span class="price-val">${money(p.wholesale_price)}</span>
          </div>
          <div style="text-align: right;">
            <span class="price-label">MRP</span>
            <span class="mrp-val">${money(p.mrp)}</span>
          </div>
        </div>
        <button class="btn btn-primary" style="width: 100%;" onclick="openOrderModal('${p.id}', '${esc(p.name)}', ${p.wholesale_price}, ${p.availableQuantity})">
          🛒 Order Medicine
        </button>
      </div>
    </article>
  `
    )
    .join('');
}

function handleMarketSearch(q) {
  state.searchQuery = q;
  updateMarketGrid();
}
function selectCategory(cat) {
  state.selectedCategory = cat;
  marketplace();
  render();
}
function toggleInStockOnly(checked) {
  state.inStockOnly = checked;
  updateMarketGrid();
}
function updateMarketGrid() {
  const filtered = filterProductsList();
  const grid = $('#market-products-grid');
  const count = $('#product-count');
  if (grid) grid.innerHTML = renderMarketCards(filtered);
  if (count) count.textContent = filtered.length;
}

/* ==========================================================================
   VIEW: Orders (Customer & Wholesaler)
   ========================================================================== */
async function ordersView() {
  const d = await api('/orders');
  const isWholesaler = state.user.role === 'WHOLESALER';

  return shell(`
    <div class="page-header">
      <div class="page-header-text">
        <h1>${isWholesaler ? 'Customer Orders Pipeline' : 'Your Pharmacy Orders'}</h1>
        <p>${isWholesaler ? 'Review, confirm, and update shipping progress for incoming pharmacy orders.' : 'Track order status and reserved stock allocations.'}</p>
      </div>
      ${isWholesaler ? `
      <div class="page-header-actions">
        <button class="btn btn-secondary" onclick="go('invoices')">🧾 Invoices Register</button>
      </div>` : ''}
    </div>

    <div class="card-table-wrap">
      <div class="table-toolbar">
        <h2>${isWholesaler ? 'Incoming Orders' : 'Order History'} (${d.items.length})</h2>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Order Number</th>
              ${isWholesaler ? '<th>Pharmacy Customer</th>' : ''}
              <th>Placed Date</th>
              <th>Total Items</th>
              <th>Grand Total</th>
              <th>Payment Status</th>
              <th>Order Status</th>
              ${isWholesaler ? '<th>Actions</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${renderOrderRows(d.items, isWholesaler)}
          </tbody>
        </table>
      </div>
    </div>
  `);
}

function renderOrderRows(orders, isWholesaler) {
  if (!orders.length) {
    return `<tr><td colspan="${isWholesaler ? 8 : 6}" style="text-align: center; padding: 32px; color: var(--text-muted);">No orders found.</td></tr>`;
  }
  return orders
    .map(o => {
      const isPending = o.status === 'PENDING';
      const isConfirmedOrBeyond = ['CONFIRMED', 'PROCESSING', 'PACKED', 'DISPATCHED', 'DELIVERED'].includes(o.status);
      const statusBadge =
        o.status === 'CONFIRMED' || o.status === 'DELIVERED'
          ? 'badge-success'
          : o.status === 'PENDING'
          ? 'badge-warning'
          : o.status === 'REJECTED' || o.status === 'CANCELLED'
          ? 'badge-danger'
          : 'badge-info';

      const paymentBadge =
        o.payment_status === 'PAID'
          ? 'badge-success'
          : o.payment_status === 'PARTIAL'
          ? 'badge-info'
          : 'badge-warning';

      return `
      <tr>
        <td><strong>#${esc(o.number)}</strong></td>
        ${isWholesaler ? `<td><strong>${esc(o.customer_name || 'Pharmacy')}</strong></td>` : ''}
        <td>${new Date(o.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
        <td>${o.item_count} items</td>
        <td><strong style="font-family: var(--font-mono); color: var(--primary);">${money(o.grand_total)}</strong></td>
        <td><span class="badge ${paymentBadge}">${esc(o.payment_status || 'PENDING')}</span></td>
        <td><span class="badge ${statusBadge}">${esc(o.status)}</span></td>
        ${
          isWholesaler
            ? `
          <td>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
              ${
                isPending
                  ? `
                <button class="btn btn-sm btn-success" onclick="updateOrderStatus('${o.id}', 'CONFIRMED')">✓ Confirm</button>
                <button class="btn btn-sm btn-danger" onclick="updateOrderStatus('${o.id}', 'REJECTED')">✕ Reject</button>
              `
                  : `
                <select onchange="updateOrderStatus('${o.id}', this.value)" style="padding: 4px 8px; font-size: 12px; border-radius: 4px; max-width: 120px;">
                  <option value="" disabled selected>Status...</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="PACKED">Packed</option>
                  <option value="DISPATCHED">Dispatched</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              `
              }
              ${
                isConfirmedOrBeyond
                  ? `
                <button class="btn btn-sm btn-primary" onclick="handleGenerateOrViewInvoice('${o.id}')" title="Generate or View GST Tax Invoice">
                  🧾 Tax Invoice
                </button>
              `
                  : ''
              }
            </div>
          </td>
        `
            : ''
        }
      </tr>
    `;
    })
    .join('');
}

async function updateOrderStatus(orderId, status) {
  try {
    await api('/orders/' + orderId + '/status', {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    showToast(`Order status updated to ${status}.`, 'success');
    render();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function handleGenerateOrViewInvoice(orderId) {
  try {
    // Check if invoice already exists
    const invRes = await api('/invoices/by-order/' + orderId).catch(() => null);
    if (invRes && invRes.invoice) {
      openInvoiceModal(invRes.invoice.id);
      return;
    }

    // Generate new tax invoice
    const genRes = await api('/invoices/generate', {
      method: 'POST',
      body: JSON.stringify({ orderId })
    });
    showToast('GST Tax Invoice generated successfully!', 'success');
    openInvoiceModal(genRes.invoice.id);
    if (state.page === 'orders' || state.page === 'invoices') {
      render();
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

/* ==========================================================================
   VIEW: Invoices Register (Wholesaler & Pharmacy Customer)
   ========================================================================== */
async function invoicesView() {
  const d = await api('/invoices');
  const isWholesaler = state.user.role === 'WHOLESALER';
  const invoices = d.items || [];

  const totalBilled = invoices.reduce((s, i) => s + (Number(i.grand_total) || 0), 0);
  const totalPaid = invoices.filter(i => i.payment_status === 'PAID').reduce((s, i) => s + (Number(i.grand_total) || 0), 0);
  const totalPending = totalBilled - totalPaid;

  return shell(`
    <div class="page-header">
      <div class="page-header-text">
        <h1>${isWholesaler ? 'Pharmaceutical Tax Invoices Register' : 'Your Wholesale Invoices'}</h1>
        <p>${isWholesaler ? 'Issue GST-compliant B2B drug tax invoices, monitor payments, and export printable vouchers.' : 'View, verify batch allocations, and print tax invoices for your records.'}</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary" onclick="go('orders')">🛒 View Orders</button>
      </div>
    </div>

    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Total Invoiced Amount</div>
        <div class="metric-value" style="font-size: 26px;">${money(totalBilled)}</div>
        <div class="metric-note">${invoices.length} invoices issued</div>
      </div>
      <div class="metric-card success">
        <div class="metric-label">Settled / Paid Amount</div>
        <div class="metric-value" style="font-size: 26px;">${money(totalPaid)}</div>
        <div class="metric-note">Collected revenue</div>
      </div>
      <div class="metric-card ${totalPending > 0 ? 'warning' : ''}">
        <div class="metric-label">Outstanding Receivables</div>
        <div class="metric-value" style="font-size: 26px;">${money(totalPending)}</div>
        <div class="metric-note">Pending payment settlement</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total Invoices</div>
        <div class="metric-value">${invoices.length}</div>
        <div class="metric-note">GST compliant vouchers</div>
      </div>
    </div>

    <div class="card-table-wrap" style="margin-top: 24px;">
      <div class="table-toolbar">
        <h2>Invoices List (${invoices.length})</h2>
        <div class="table-search">
          <span style="color: var(--text-muted); margin-right: 8px;">🔍</span>
          <input type="text" placeholder="Filter by invoice #, customer..." oninput="filterInvoices(this.value)">
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table" id="invoices-table">
          <thead>
            <tr>
              <th>Invoice Number</th>
              <th>Issued Date</th>
              ${isWholesaler ? '<th>Billed To (Pharmacy)</th>' : ''}
              <th>Order Ref</th>
              <th>Taxable Subtotal</th>
              <th>GST (CGST+SGST)</th>
              <th>Grand Total</th>
              <th>Payment Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${renderInvoiceRows(invoices, isWholesaler)}
          </tbody>
        </table>
      </div>
    </div>
  `);
}

function renderInvoiceRows(invoices, isWholesaler) {
  if (!invoices.length) {
    return `<tr><td colspan="${isWholesaler ? 9 : 8}" style="text-align: center; padding: 32px; color: var(--text-muted);">No invoices generated yet.</td></tr>`;
  }
  return invoices
    .map(inv => {
      const paymentBadge =
        inv.payment_status === 'PAID'
          ? 'badge-success'
          : inv.payment_status === 'PARTIAL'
          ? 'badge-info'
          : 'badge-warning';

      return `
      <tr>
        <td>
          <button class="btn-link" onclick="openInvoiceModal('${inv.id}')" style="font-family: var(--font-mono); font-weight: 700; color: var(--primary); text-decoration: underline; background: none; border: none; cursor: pointer; padding: 0;">
            ${esc(inv.number)}
          </button>
        </td>
        <td>${new Date(inv.issued_at || inv.created_at || Date.now()).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
        ${isWholesaler ? `<td><strong>${esc(inv.customer_name || 'Pharmacy')}</strong></td>` : ''}
        <td><code style="background: #f4f5f7; padding: 2px 6px; border-radius: 4px;">#${esc(inv.order_number || inv.order_id?.slice(0, 8))}</code></td>
        <td>${money(inv.subtotal)}</td>
        <td><span style="color: var(--text-muted); font-size: 13px;">${money(inv.gst_total)}</span></td>
        <td><strong style="color: var(--primary); font-family: var(--font-mono); font-size: 15px;">${money(inv.grand_total)}</strong></td>
        <td><span class="badge ${paymentBadge}">${esc(inv.payment_status || 'PENDING')}</span></td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-primary" onclick="openInvoiceModal('${inv.id}')" title="View / Print Tax Invoice">
              👁️ View / Print
            </button>
            ${
              isWholesaler && inv.payment_status !== 'PAID'
                ? `
              <button class="btn btn-sm btn-success" onclick="openPaymentModal('${inv.id}', '${esc(inv.number)}', ${inv.grand_total})" title="Record Customer Payment">
                💳 Record Payment
              </button>
            `
                : ''
            }
          </div>
        </td>
      </tr>
    `;
    })
    .join('');
}

function filterInvoices(query) {
  const q = query.toLowerCase().trim();
  const rows = $$('#invoices-table tbody tr');
  rows.forEach(r => {
    const text = r.textContent.toLowerCase();
    r.style.display = text.includes(q) ? '' : 'none';
  });
}

/* ==========================================================================
   MODAL: Full-Page Printable Pharmaceutical Tax Invoice
   ========================================================================== */
async function openInvoiceModal(invoiceId) {
  try {
    const res = await api('/invoices/' + invoiceId);
    const inv = res.invoice;
    if (!inv) throw new Error('Invoice data not found');

    const seller = inv.seller || {};
    const buyer = inv.buyer || {};
    const totals = inv.totals || {};
    const isWholesaler = state.user && state.user.role === 'WHOLESALER';

    const invoiceContentHtml = `
      <div class="invoice-container" id="printable-invoice">
        <div class="invoice-header">
          <div>
            <h1 class="invoice-seller-title">${esc(seller.name || 'Apex MedSupply Wholesale Distributors Pvt. Ltd.')}</h1>
            <div class="invoice-seller-subtitle">${esc(seller.tagline || 'Authorized Pharmaceutical Wholesale Distribution')}</div>
            <div style="font-size: 13px; color: var(--text-muted); max-width: 480px; margin-bottom: 8px;">
              ${esc(seller.address)}
            </div>
            <table class="invoice-meta-table">
              <tr>
                <td><strong>GSTIN:</strong> <code>${esc(seller.gstin)}</code></td>
                <td><strong>PAN:</strong> ${esc(seller.pan)}</td>
              </tr>
              <tr>
                <td><strong>Drug Lic (DL):</strong> ${esc(seller.drugLicense)}</td>
                <td><strong>FSSAI:</strong> ${esc(seller.fssai)}</td>
              </tr>
              <tr>
                <td><strong>Phone:</strong> ${esc(seller.phone)}</td>
                <td><strong>Email:</strong> ${esc(seller.email)}</td>
              </tr>
            </table>
          </div>
          <div class="invoice-title-block">
            <h2 class="invoice-main-heading">TAX INVOICE</h2>
            <div class="invoice-badge-original">ORIGINAL FOR RECIPIENT</div>
            <table class="invoice-meta-table" style="margin-left: auto;">
              <tr>
                <td style="text-align: right; color: var(--text-muted);">Invoice No:</td>
                <td><strong style="font-family: var(--font-mono); font-size: 15px; color: #0052cc;">${esc(inv.number)}</strong></td>
              </tr>
              <tr>
                <td style="text-align: right; color: var(--text-muted);">Invoice Date:</td>
                <td><strong>${new Date(inv.issued_at || inv.created_at || Date.now()).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</strong></td>
              </tr>
              <tr>
                <td style="text-align: right; color: var(--text-muted);">Order Ref:</td>
                <td><code>#${esc(inv.order_number)}</code></td>
              </tr>
              <tr>
                <td style="text-align: right; color: var(--text-muted);">Payment Terms:</td>
                <td><strong>${esc(inv.payment_status || 'PENDING')} (30 Days)</strong></td>
              </tr>
              <tr>
                <td style="text-align: right; color: var(--text-muted);">Place of Supply:</td>
                <td><strong>Maharashtra (27)</strong></td>
              </tr>
            </table>
          </div>
        </div>

        <div class="invoice-parties-grid">
          <div class="party-block">
            <h4>Billed To / Buyer (Pharmacy)</h4>
            <div style="font-size: 15px; font-weight: 700; color: #091e42; margin-bottom: 2px;">
              ${esc(buyer.businessName || buyer.name)}
            </div>
            <div><strong>Contact:</strong> ${esc(buyer.name)} · ${esc(buyer.phone)}</div>
            <div><strong>Email:</strong> ${esc(buyer.email)}</div>
            <div><strong>Delivery Address:</strong> ${esc(buyer.address)}</div>
            <div><strong>GSTIN:</strong> <code>${esc(buyer.gstin || '27AABCP5678Q1Z2')}</code> &nbsp; <strong>DL No:</strong> ${esc(buyer.drugLicense || 'DL-20/21B-MH-2023')}</div>
          </div>
          <div class="party-block">
            <h4>Consignee / Shipped To</h4>
            <div style="font-size: 15px; font-weight: 700; color: #091e42; margin-bottom: 2px;">
              ${esc(buyer.businessName || buyer.name)}
            </div>
            <div><strong>Destination:</strong> ${esc(inv.shipping_address || buyer.address)}</div>
            <div><strong>Transport / Dispatch:</strong> Direct Wholesale Logistics Courier</div>
            <div><strong>Reverse Charge Applicable:</strong> No (Regular B2B Tax Invoice)</div>
          </div>
        </div>

        <div class="table-responsive">
          <table class="invoice-items-table">
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th>Medicine Description & Generic</th>
                <th>HSN</th>
                <th>Allocated Batch & Expiry</th>
                <th>Pack</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Rate (₹)</th>
                <th class="text-right">Taxable (₹)</th>
                <th class="text-right">CGST</th>
                <th class="text-right">SGST</th>
                <th class="text-right">Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${(inv.items || [])
                .map(
                  (it, idx) => `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td>
                    <strong>${esc(it.name)}</strong>
                    <div style="font-size: 11px; color: var(--text-muted);">${esc(it.composition || it.brand)}</div>
                  </td>
                  <td><code>${esc(it.hsnCode || '300490')}</code></td>
                  <td>
                    <div style="font-weight: 600; font-family: var(--font-mono); font-size: 11px;">
                      ${esc(it.batchNumber)}
                    </div>
                    <div style="font-size: 11px; color: var(--text-muted);">Exp: ${esc(it.expiryDate)}</div>
                  </td>
                  <td>${esc(it.packSize || '1 Strip')}</td>
                  <td class="text-right"><strong>${it.quantity}</strong></td>
                  <td class="text-right">${money(it.unitPrice)}</td>
                  <td class="text-right">${money(it.taxableValue)}</td>
                  <td class="text-right">${it.cgstRate}%<br><small style="color:var(--text-muted);">${money(it.cgstAmount)}</small></td>
                  <td class="text-right">${it.sgstRate}%<br><small style="color:var(--text-muted);">${money(it.sgstAmount)}</small></td>
                  <td class="text-right"><strong style="color: #0052cc;">${money(it.lineTotal)}</strong></td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>

        <div class="invoice-summary-grid">
          <div class="invoice-bank-card">
            <h5>Bank Remittance Details (NEFT / RTGS)</h5>
            <div><strong>Bank Name:</strong> ${esc(seller.bank?.name || 'HDFC Bank Ltd')}</div>
            <div><strong>Account Name:</strong> ${esc(seller.name)}</div>
            <div><strong>Account No:</strong> <code style="font-weight: 700; font-size: 13px;">${esc(seller.bank?.accountNumber || '50200088992211')}</code></div>
            <div><strong>IFSC Code:</strong> <code>${esc(seller.bank?.ifsc || 'HDFC0001234')}</code> (Branch: ${esc(seller.bank?.branch)})</div>
            <div style="margin-top: 8px; font-weight: 600; color: #091e42;">
              Amount in Words: <em>${esc(totals.amountInWords || '')}</em>
            </div>
          </div>

          <div>
            <table class="invoice-totals-table">
              <tr>
                <td>Total Taxable Value:</td>
                <td class="text-right"><strong>${money(totals.taxableAmount)}</strong></td>
              </tr>
              <tr>
                <td>Central GST (CGST 6%):</td>
                <td class="text-right">${money(totals.cgstAmount)}</td>
              </tr>
              <tr>
                <td>State GST (SGST 6%):</td>
                <td class="text-right">${money(totals.sgstAmount)}</td>
              </tr>
              <tr>
                <td>Total GST Tax:</td>
                <td class="text-right"><strong>${money(totals.totalGst)}</strong></td>
              </tr>
              <tr class="grand-total">
                <td>Invoice Grand Total:</td>
                <td class="text-right">${money(totals.grandTotal)}</td>
              </tr>
            </table>
          </div>
        </div>

        <div class="invoice-footer-terms">
          <div>
            <strong>Terms & Conditions:</strong>
            <ol class="invoice-terms-list">
              <li>Goods once sold will not be accepted back without prior written batch verification.</li>
              <li>Breakage/shortage must be notified within 48 hours of shipment delivery.</li>
              <li>Interest @18% p.a. charged on invoices unpaid past stipulated credit period.</li>
              <li>Subject to Mumbai Jurisdiction only.</li>
            </ol>
          </div>
          <div class="invoice-signatory">
            <div class="signatory-box"></div>
            <strong>For ${esc(seller.name || 'Apex MedSupply Wholesale Distributors')}</strong>
            <span style="font-size: 10px; color: var(--text-muted);">(Authorized Signatory / Digitally Generated)</span>
          </div>
        </div>
      </div>
    `;

    openModal(
      `Tax Invoice: ${inv.number}`,
      invoiceContentHtml,
      `
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>
      ${
        isWholesaler && inv.payment_status !== 'PAID'
          ? `
        <button type="button" class="btn btn-success" onclick="openPaymentModal('${inv.id}', '${esc(inv.number)}', ${totals.grandTotal})">💳 Record Payment</button>
      `
          : ''
      }
      <button type="button" class="btn btn-primary" onclick="window.print()">🖨️ Print / Save as PDF</button>
    `
    );
  } catch (err) {
    showToast('Failed to load invoice: ' + err.message, 'danger');
  }
}

/* ==========================================================================
   MODAL: Record Payment for Invoice
   ========================================================================== */
function openPaymentModal(invoiceId, invoiceNumber, grandTotal) {
  openModal(
    `Record Payment: ${invoiceNumber}`,
    `
    <form id="payment-form" onsubmit="handlePaymentSubmit(event, '${invoiceId}')">
      <div style="background: #f4f5f7; padding: 14px; border-radius: 6px; margin-bottom: 16px; font-size: 14px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Invoice Number:</span>
          <strong>${esc(invoiceNumber)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Total Invoiced Amount:</span>
          <strong style="color: var(--primary); font-family: var(--font-mono); font-size: 16px;">${money(grandTotal)}</strong>
        </div>
      </div>

      <div class="form-group">
        <label>Payment Settlement Status</label>
        <select name="paymentStatus" required>
          <option value="PAID" selected>PAID (Full Settlement)</option>
          <option value="PARTIAL">PARTIAL (Advance / Partial Payment)</option>
          <option value="PENDING">PENDING (Pending Cleared Funds)</option>
          <option value="OVERDUE">OVERDUE (Payment Delayed)</option>
        </select>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Received Amount (₹)</label>
          <input type="number" name="amount" min="0" step="0.01" value="${grandTotal}" required>
        </div>
        <div class="form-group">
          <label>Payment Mode</label>
          <select name="method" required>
            <option value="NEFT/RTGS" selected>Bank NEFT / RTGS</option>
            <option value="UPI/QR">UPI / QR Code</option>
            <option value="CHEQUE">Bank Cheque / Draft</option>
            <option value="CASH">Cash on Delivery</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>Transaction / UTR / Cheque Reference</label>
        <input type="text" name="referenceId" placeholder="e.g. UTR1234567890 or Cheque #098765" value="UTR-${Date.now().toString().slice(-8)}">
      </div>
    </form>
  `,
    `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button type="submit" form="payment-form" class="btn btn-success">Save Payment Receipt →</button>
  `
  );
}

async function handlePaymentSubmit(e, invoiceId) {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  try {
    await api('/invoices/' + invoiceId + '/payment', {
      method: 'PATCH',
      body: JSON.stringify({
        paymentStatus: f.paymentStatus,
        amount: Number(f.amount),
        method: f.method,
        referenceId: f.referenceId || undefined
      })
    });
    closeModal();
    showToast('Payment receipt recorded successfully!', 'success');
    render();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

/* ==========================================================================
   VIEW: Supply Requirements / Requests
   ========================================================================== */
async function requirementsView() {
  const d = await api('/requirements');
  const isWholesaler = state.user.role === 'WHOLESALER';

  return shell(`
    <div class="page-header">
      <div class="page-header-text">
        <h1>${isWholesaler ? 'Pharmacy Medicine Requests' : 'Special Medicine Requests'}</h1>
        <p>${isWholesaler ? 'Unlisted or out-of-stock medicines requested by pharmacy customers.' : 'Cannot find a medicine in the catalogue? Send a direct sourcing request.'}</p>
      </div>
      <div class="page-header-actions">
        ${!isWholesaler ? `<button class="btn btn-primary" onclick="openRequestModal()">📝 Request New Medicine</button>` : ''}
      </div>
    </div>

    <div class="card-table-wrap">
      <div class="table-toolbar">
        <h2>${isWholesaler ? 'Customer Demand' : 'Your Submitted Requests'} (${d.items.length})</h2>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Medicine Name</th>
              <th>Composition / Formula</th>
              ${isWholesaler ? '<th>Pharmacy Customer</th>' : ''}
              <th>Requested Qty</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${renderRequirementRows(d.items, isWholesaler)}
          </tbody>
        </table>
      </div>
    </div>
  `);
}

function renderRequirementRows(items, isWholesaler) {
  if (!items.length) {
    return `<tr><td colspan="${isWholesaler ? 6 : 5}" style="text-align: center; padding: 32px; color: var(--text-muted);">No requests recorded.</td></tr>`;
  }
  return items
    .map(
      r => `
    <tr>
      <td><strong>${esc(r.medicine_name)}</strong></td>
      <td>${esc(r.composition || '—')}</td>
      ${isWholesaler ? `<td><strong>${esc(r.customer_name || 'Pharmacy')}</strong></td>` : ''}
      <td>${r.quantity} units</td>
      <td><span class="badge ${r.priority === 'HIGH' ? 'badge-danger' : 'badge-info'}">${esc(r.priority)}</span></td>
      <td><span class="badge badge-warning">${esc(r.status)}</span></td>
    </tr>
  `
    )
    .join('');
}

/* ==========================================================================
   MODALS: Accessible One-Click Actions
   ========================================================================== */

// 1. Easy Order Modal (No browser prompt popup!)
function openOrderModal(productId, productName, wholesalePrice, availableStock) {
  openModal(
    `Order Medicine: ${productName}`,
    `
    <form id="order-form" onsubmit="submitOrder(event, '${productId}', ${wholesalePrice})">
      <div style="background: #f4f5f7; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: var(--text-muted);">Wholesale Rate per unit:</span>
          <strong>${money(wholesalePrice)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">Available in Stock:</span>
          <span class="badge badge-success">${availableStock} units</span>
        </div>
      </div>

      <div class="form-group">
        <label for="order-qty">Quantity to Order</label>
        <div class="qty-stepper">
          <button type="button" onclick="stepOrderQty(-10)">-10</button>
          <button type="button" onclick="stepOrderQty(-1)">-</button>
          <input type="number" id="order-qty" name="quantity" min="1" max="${availableStock}" value="1" oninput="updateOrderSubtotal(${wholesalePrice})" required>
          <button type="button" onclick="stepOrderQty(1)">+</button>
          <button type="button" onclick="stepOrderQty(10)">+10</button>
        </div>
      </div>

      <div style="border-top: 1.5px solid var(--border); padding-top: 16px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 16px; font-weight: 600;">Estimated Total:</span>
        <strong id="order-total-val" style="font-size: 22px; color: var(--primary); font-family: var(--font-mono);">${money(wholesalePrice)}</strong>
      </div>
    </form>
  `,
    `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button type="submit" form="order-form" class="btn btn-primary">Place Order Now →</button>
  `
  );
}

function stepOrderQty(delta) {
  const input = $('#order-qty');
  if (!input) return;
  const current = Number(input.value) || 1;
  const next = Math.max(1, current + delta);
  input.value = next;
  input.dispatchEvent(new Event('input'));
}

function updateOrderSubtotal(unitPrice) {
  const input = $('#order-qty');
  const totalEl = $('#order-total-val');
  if (!input || !totalEl) return;
  const qty = Number(input.value) || 0;
  totalEl.textContent = money(qty * unitPrice);
}

async function submitOrder(e, productId, wholesalePrice) {
  e.preventDefault();
  const qty = Number($('#order-qty').value);
  if (!Number.isInteger(qty) || qty < 1) {
    showToast('Please enter a valid quantity.', 'warning');
    return;
  }
  try {
    await api('/orders', {
      method: 'POST',
      body: JSON.stringify({ items: [{ productId, quantity: qty }] })
    });
    closeModal();
    showToast('Order successfully placed! Stock is reserved pending wholesaler confirmation.', 'success');
    go('orders');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// 2. Invoice OCR Picture Upload Modal
function openInvoiceScanModal() {
  openModal(
    '📷 Scan Vendor Invoice Photo',
    `
    <p style="color: var(--text-muted); margin-top: 0;">Upload or capture a photo of a vendor purchase invoice. The optical scanner will parse the medicines, batch numbers, expiry dates, quantities, and rates automatically.</p>

    <form id="invoice-form" onsubmit="handleInvoiceScanSubmit(event)">
      <div class="dropzone" onclick="$('#invoice-file-input').click()">
        <div class="dropzone-icon">📷</div>
        <div class="dropzone-title">Click to take photo or choose invoice file</div>
        <div class="dropzone-desc">PNG, JPG, or WEBP (up to 8 MB)</div>
        <div id="file-name-preview" style="margin-top: 10px; font-weight: 600; color: var(--primary);"></div>
      </div>
      <input type="file" id="invoice-file-input" name="invoice" accept="image/png,image/jpeg,image/webp" capture="environment" style="display: none;" onchange="handleInvoiceFileSelect(this)" required>
      <div id="scan-loading-indicator" style="display: none; margin-top: 16px; text-align: center; color: var(--primary); font-weight: 600;">
        ⏳ Scanning invoice text with OCR engine, please wait...
      </div>
    </form>
  `,
    `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button type="submit" form="invoice-form" id="btn-scan-submit" class="btn btn-primary">Scan & Apply Stock →</button>
  `
  );
}

function handleInvoiceFileSelect(input) {
  const file = input.files[0];
  const preview = $('#file-name-preview');
  if (file && preview) {
    preview.textContent = `Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`;
  }
}

async function handleInvoiceScanSubmit(e) {
  e.preventDefault();
  const input = $('#invoice-file-input');
  if (!input || !input.files[0]) {
    showToast('Please select or capture an invoice image first.', 'warning');
    return;
  }
  const file = input.files[0];
  const loading = $('#scan-loading-indicator');
  const btn = $('#btn-scan-submit');
  if (loading) loading.style.display = 'block';
  if (btn) btn.disabled = true;

  const formData = new FormData();
  formData.append('invoice', file);

  try {
    const res = await api('/restock/invoice-image', {
      method: 'POST',
      body: formData
    });
    closeModal();
    if (res.applied) {
      showToast(`Success! Auto-restocked ${res.applied_count} medicine items from invoice.`, 'success');
      go('inventory');
    } else if (res.unmatched && res.unmatched.length) {
      showToast(`Scanned, but unmatched medicines: ${res.unmatched.join(', ')}.`, 'warning');
    }
  } catch (err) {
    if (loading) loading.style.display = 'none';
    if (btn) btn.disabled = false;
    showToast(err.message, 'danger');
  }
}

// 3. Receive Manual Stock Modal
function openStockModal() {
  const productOptions = (state.products || [])
    .map(p => `<option value="${esc(p.id)}">${esc(p.name)} (${esc(p.brand)})</option>`)
    .join('');

  openModal(
    '➕ Receive Central Stock',
    `
    <form id="stock-form" onsubmit="handleStockSubmit(event)">
      <div class="form-group">
        <label for="stock-product-id">Select Medicine</label>
        <select id="stock-product-id" name="productId" required>
          ${productOptions || '<option value="product-1">Paracetamol 500mg (Crocin)</option>'}
        </select>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="stock-batch">Batch Number</label>
          <input type="text" id="stock-batch" name="batchNumber" placeholder="e.g. BATCH-2026-A" required>
        </div>
        <div class="form-group">
          <label for="stock-expiry">Expiry Date</label>
          <input type="date" id="stock-expiry" name="expiryDate" required>
          <div style="margin-top: 4px; display: flex; gap: 6px;">
            <button type="button" class="btn btn-sm btn-secondary" onclick="setQuickExpiry(1)">+1 Year</button>
            <button type="button" class="btn btn-sm btn-secondary" onclick="setQuickExpiry(2)">+2 Years</button>
          </div>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="stock-qty">Received Quantity (Units)</label>
          <input type="number" id="stock-qty" name="quantity" min="1" placeholder="e.g. 100" required>
        </div>
        <div class="form-group">
          <label for="stock-price">Purchase Price (₹)</label>
          <input type="number" id="stock-price" name="purchasePrice" min="0" step="0.01" placeholder="e.g. 18.50" required>
        </div>
      </div>

      <div class="form-group">
        <label for="stock-warehouse">Warehouse Location (Optional)</label>
        <input type="text" id="stock-warehouse" name="warehouse" value="Main Hub (A-1)">
      </div>
    </form>
  `,
    `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button type="submit" form="stock-form" class="btn btn-primary">Record Stock Receipt →</button>
  `
  );
  setQuickExpiry(2);
}

function setQuickExpiry(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  const iso = d.toISOString().split('T')[0];
  const input = $('#stock-expiry');
  if (input) input.value = iso;
}

async function handleStockSubmit(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    await api('/inventory/receive', {
      method: 'POST',
      body: JSON.stringify({
        productId: f.get('productId'),
        batchNumber: f.get('batchNumber'),
        expiryDate: f.get('expiryDate'),
        quantity: Number(f.get('quantity')),
        purchasePrice: Number(f.get('purchasePrice')),
        warehouse: f.get('warehouse') || undefined
      })
    });
    closeModal();
    showToast('Stock batch recorded successfully!', 'success');
    go('inventory');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// 4. Edit Medicine Modal
function openEditMedicineModal(id) {
  const p = state.manageProducts?.[id];
  if (!p) return showToast('Medicine details unavailable. Refresh and try again.', 'warning');

  const catOptions = (state.categories || [])
    .map(c => `<option value="${esc(c.id)}" ${c.id === p.category_id ? 'selected' : ''}>${esc(c.name)}</option>`)
    .join('');

  openModal(
    `Edit Medicine: ${p.name}`,
    `
    <form id="edit-product-form" onsubmit="handleEditMedicineSubmit(event, '${p.id}')">
      <div class="form-group">
        <label>Category</label>
        <select name="categoryId">${catOptions}</select>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Wholesale Price (₹)</label>
          <input type="number" name="wholesalePrice" min="0" step="0.01" value="${p.wholesale_price}" required>
        </div>
        <div class="form-group">
          <label>Availability Status</label>
          <select name="availabilityStatus">
            <option value="AVAILABLE" ${p.availability_status === 'AVAILABLE' ? 'selected' : ''}>AVAILABLE</option>
            <option value="UNAVAILABLE" ${p.availability_status === 'UNAVAILABLE' ? 'selected' : ''}>UNAVAILABLE</option>
            <option value="DISCONTINUED" ${p.availability_status === 'DISCONTINUED' ? 'selected' : ''}>DISCONTINUED</option>
          </select>
        </div>
      </div>

      <label class="form-check">
        <input type="checkbox" name="marketplaceVisible" ${p.marketplace_visible ? 'checked' : ''}>
        <span>Visible to Medical Store Customers</span>
      </label>
    </form>
  `,
    `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button type="submit" form="edit-product-form" class="btn btn-primary">Save Changes →</button>
  `
  );
}

async function handleEditMedicineSubmit(e, id) {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    await api('/products/' + id, {
      method: 'PATCH',
      body: JSON.stringify({
        categoryId: f.get('categoryId'),
        wholesalePrice: Number(f.get('wholesalePrice')),
        availabilityStatus: f.get('availabilityStatus'),
        marketplaceVisible: f.get('marketplaceVisible') === 'on'
      })
    });
    closeModal();
    showToast('Medicine settings updated successfully!', 'success');
    go('products');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// 5. Add New Medicine Modal
function openAddProductModal() {
  const catOptions = (state.categories || [])
    .map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`)
    .join('');

  openModal(
    '➕ Add Medicine to Catalogue',
    `
    <form id="add-product-form" onsubmit="handleAddProductSubmit(event)">
      <div class="form-row">
        <div class="form-group">
          <label>Medicine Name <small style="color: var(--text-muted);">(Start typing to see suggestions from 251K+ medicines)</small></label>
          <div style="position: relative;">
            <input 
              type="text" 
              id="medicine-name-input" 
              name="name" 
              placeholder="e.g. Amoxicillin 500mg" 
              autocomplete="off"
              oninput="handleMedicineNameInput(this, 'medicine-name-suggestions')"
              onfocus="handleMedicineNameInput(this, 'medicine-name-suggestions')"
              required>
            <div id="medicine-name-suggestions" class="autocomplete-dropdown"></div>
          </div>
        </div>
        <div class="form-group">
          <label>Brand / Manufacturer</label>
          <input type="text" name="brand" placeholder="e.g. Cipla, Sun Pharma" required>
        </div>
      </div>

      <div class="form-group">
        <label>Composition / Generic Formula</label>
        <input type="text" name="composition" placeholder="e.g. Amoxicillin Trihydrate IP" required>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Category</label>
          <select name="categoryId" required>
            ${catOptions || '<option value="cat-0">Antibiotics</option>'}
          </select>
        </div>
        <div class="form-group">
          <label>Pack Size (Optional)</label>
          <input type="text" name="packSize" placeholder="e.g. 10x10 Tablets">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Maximum Retail Price (MRP ₹)</label>
          <input type="number" name="mrp" min="0" step="0.01" placeholder="e.g. 120" required>
        </div>
        <div class="form-group">
          <label>Wholesale Price (₹)</label>
          <input type="number" name="wholesalePrice" min="0" step="0.01" placeholder="e.g. 85" required>
        </div>
      </div>
    </form>
  `,
    `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button type="submit" form="add-product-form" class="btn btn-primary">Create Medicine →</button>
  `
  );
}

async function handleAddProductSubmit(e) {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  try {
    await api('/products', {
      method: 'POST',
      body: JSON.stringify({
        name: f.name,
        brand: f.brand,
        composition: f.composition,
        categoryId: f.categoryId,
        packSize: f.packSize || undefined,
        mrp: Number(f.mrp),
        wholesalePrice: Number(f.wholesalePrice),
        gstRate: 12,
        minimumStock: 10,
        marketplaceVisible: true
      })
    });
    closeModal();
    showToast('New medicine created successfully in catalogue!', 'success');
    go('products');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// 6. Request Medicine Modal (Customer)
function openRequestModal() {
  openModal(
    '📝 Request Unlisted Medicine',
    `
    <form id="request-form" onsubmit="handleRequestSubmit(event)">
      <div class="form-group">
        <label>Medicine Name <small style="color: var(--text-muted);">(Start typing to see suggestions from 251K+ medicines)</small></label>
        <div style="position: relative;">
          <input 
            type="text" 
            id="request-medicine-name-input" 
            name="medicineName" 
            placeholder="e.g. Remdesivir 100mg" 
            autocomplete="off"
            oninput="handleMedicineNameInput(this, 'request-medicine-suggestions')"
            onfocus="handleMedicineNameInput(this, 'request-medicine-suggestions')"
            required>
          <div id="request-medicine-suggestions" class="autocomplete-dropdown"></div>
        </div>
      </div>
      <div class="form-group">
        <label>Composition / Formula (Optional)</label>
        <input type="text" name="composition" placeholder="e.g. Remdesivir Lyophilized">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Required Quantity</label>
          <input type="number" name="quantity" min="1" value="10" required>
        </div>
        <div class="form-group">
          <label>Priority</label>
          <select name="priority">
            <option value="NORMAL">Normal Demand</option>
            <option value="HIGH">Urgent Requirement</option>
            <option value="LOW">Low Priority</option>
          </select>
        </div>
      </div>
    </form>
  `,
    `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button type="submit" form="request-form" class="btn btn-primary">Submit Request →</button>
  `
  );
}

async function handleRequestSubmit(e) {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  try {
    await api('/requirements', {
      method: 'POST',
      body: JSON.stringify({
        medicineName: f.medicineName,
        composition: f.composition || undefined,
        quantity: Number(f.quantity),
        priority: f.priority
      })
    });
    closeModal();
    showToast('Your medicine requirement has been sent to the wholesaler!', 'success');
    go('requirements');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

/* ==========================================================================
   ROUTER & RENDER ENGINE
   ========================================================================== */
async function render() {
  const app = $('#app');
  if (!app) return;

  if (!state.user || !state.token) {
    app.innerHTML = loginView();
    return;
  }

  try {
    let viewHtml = '';
    if (state.page === 'dashboard') {
      viewHtml = await dashboardView();
    } else if (state.page === 'products') {
      viewHtml = await productsView();
    } else if (state.page === 'inventory') {
      viewHtml = await inventoryView();
    } else if (state.page === 'marketplace') {
      viewHtml = await marketplaceView();
    } else if (state.page === 'orders') {
      viewHtml = await ordersView();
    } else if (state.page === 'invoices') {
      viewHtml = await invoicesView();
    } else if (state.page === 'requirements') {
      viewHtml = await requirementsView();
    } else {
      state.page = state.user.role === 'WHOLESALER' ? 'dashboard' : 'marketplace';
      return render();
    }
    app.innerHTML = viewHtml;
  } catch (e) {
    app.innerHTML = shell(`
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Could not load this view</h3>
        <p>${esc(e.message)}</p>
        <button class="btn btn-primary" onclick="render()">Retry Loading</button>
      </div>
    `);
  }
}

// Initial render
render();

/* ==========================================================================
   MEDICINE NAME AUTOCOMPLETE
   ========================================================================== */
let medicineAutocompleteTimeout = null;

async function handleMedicineNameInput(inputEl, dropdownId) {
  const query = inputEl.value.trim();
  const dropdown = document.getElementById(dropdownId);
  
  if (!dropdown) return;
  
  // Clear previous timeout
  if (medicineAutocompleteTimeout) {
    clearTimeout(medicineAutocompleteTimeout);
  }
  
  // Hide dropdown if query is too short
  if (query.length < 2) {
    dropdown.style.display = 'none';
    return;
  }
  
  // Debounce API calls (300ms delay)
  medicineAutocompleteTimeout = setTimeout(async () => {
    try {
      const res = await fetch(`/api/medicines/autocomplete?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      const suggestions = data.suggestions || [];
      
      if (suggestions.length === 0) {
        dropdown.style.display = 'none';
        return;
      }
      
      // Render suggestions
      dropdown.innerHTML = suggestions
        .map(name => `<div class="autocomplete-item" onclick="selectMedicineSuggestion('${esc(name)}', '${dropdownId}')">${esc(name)}</div>`)
        .join('');
      
      dropdown.style.display = 'block';
    } catch (err) {
      console.error('Autocomplete error:', err);
      dropdown.style.display = 'none';
    }
  }, 300);
}

function selectMedicineSuggestion(medicineName, dropdownId) {
  // Find the input element associated with this dropdown
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;
  
  const inputEl = dropdown.previousElementSibling;
  if (inputEl && inputEl.tagName === 'INPUT') {
    inputEl.value = medicineName;
  }
  
  // Hide dropdown
  dropdown.style.display = 'none';
}

// Close autocomplete dropdowns when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.form-group')) {
    document.querySelectorAll('.autocomplete-dropdown').forEach(d => {
      d.style.display = 'none';
    });
  }
});
