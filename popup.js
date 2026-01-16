// Popup script for managing scraped products and orders

class PopupManager {
  constructor() {
    this.products = [];
    this.orders = [];
    this.currentTab = 'products';
    this.init();
  }

  init() {
    this.loadProducts();
    this.loadOrders();
    this.setupEventListeners();
    this.setupTabListeners();
    this.setupStorageListener();
  }

  setupEventListeners() {
    document.getElementById('exportBtn').addEventListener('click', () => this.exportProducts());
    document.getElementById('clearBtn').addEventListener('click', () => this.clearProducts());
    document.getElementById('exportOrdersBtn').addEventListener('click', () => this.exportOrders());
    document.getElementById('clearOrdersBtn').addEventListener('click', () => this.clearOrders());
  }

  setupTabListeners() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      });
    });
  }

  setupStorageListener() {
    // Listen for storage changes to auto-update the popup
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        if (changes.scrapedProducts) {
          this.products = changes.scrapedProducts.newValue || [];
          this.renderProducts();
          this.updateStats();
        }
        if (changes.scrapedOrders) {
          this.orders = changes.scrapedOrders.newValue || [];
          this.renderOrders();
          this.updateOrderStats();
        }
      }
    });
  }

  switchTab(tabName) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
      }
    });

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });

    const targetTab = document.getElementById(`${tabName}-tab`);
    if (targetTab) {
      targetTab.classList.remove('hidden');
    }

    this.currentTab = tabName;
  }

  async loadProducts() {
    chrome.storage.local.get(['scrapedProducts'], (result) => {
      this.products = result.scrapedProducts || [];
      this.renderProducts();
      this.updateStats();
    });
  }

  updateStats() {
    const totalProducts = this.products.length;
    const totalImages = this.products.reduce((sum, p) => sum + (p.images?.length || 0), 0);

    document.getElementById('totalProducts').textContent = totalProducts;
    document.getElementById('totalImages').textContent = totalImages;
  }

  renderProducts() {
    const container = document.getElementById('productsContainer');

    if (this.products.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🛍️</div>
          <div class="empty-state-text">No products scraped yet.<br>Visit an Amazon or Yami product page and click "Scrape for eBay"</div>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    this.products.forEach((product, index) => {
      const card = this.createProductCard(product, index);
      container.appendChild(card);
    });
  }

  createProductCard(product, index) {
    const card = document.createElement('div');
    card.className = 'product-card';

    const imageUrl = product.images && product.images.length > 0
      ? product.images[0]
      : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="60" height="60"%3E%3Crect fill="%23f3f4f6" width="60" height="60"/%3E%3C/svg%3E';

    card.innerHTML = `
      <div class="product-header">
        <img class="product-image" src="${imageUrl}" alt="Product">
        <div class="product-info">
          <div class="product-title">${product.title || 'No title'}</div>
          <div class="product-price">${product.price || 'No price'}</div>
          <div class="product-asin">ASIN: ${product.asin || 'N/A'}</div>
        </div>
      </div>
      <div class="product-actions">
        <button class="btn-small btn-view" data-index="${index}">View Details</button>
        <button class="btn-small btn-delete" data-index="${index}">Delete</button>
      </div>
    `;

    // Add event listeners
    card.querySelector('.btn-view').addEventListener('click', () => this.viewProduct(index));
    card.querySelector('.btn-delete').addEventListener('click', () => this.deleteProduct(index));

    return card;
  }

  viewProduct(index) {
    const product = this.products[index];
    this.showProductDetails(product);
  }

  showProductDetails(product) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'product-details-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Product Details</h2>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <pre class="json-display">${JSON.stringify(product, null, 2)}</pre>
        </div>
        <div class="modal-footer">
          <button class="btn-copy">Copy JSON</button>
          ${product.url ? `<button class="btn-visit">Visit Amazon Page</button>` : ''}
          <button class="btn-modal-close">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    const closeModal = () => {
      modal.remove();
    };

    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.btn-modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    modal.querySelector('.btn-copy').addEventListener('click', () => {
      navigator.clipboard.writeText(JSON.stringify(product, null, 2));
      alert('JSON copied to clipboard!');
    });

    if (product.url) {
      modal.querySelector('.btn-visit').addEventListener('click', () => {
        chrome.tabs.create({ url: product.url });
      });
    }
  }

  deleteProduct(index) {
    if (confirm('Are you sure you want to delete this product?')) {
      this.products.splice(index, 1);
      chrome.storage.local.set({ scrapedProducts: this.products }, () => {
        this.renderProducts();
        this.updateStats();
      });
    }
  }

  exportProducts() {
    if (this.products.length === 0) {
      alert('No products to export');
      return;
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      totalProducts: this.products.length,
      products: this.products
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `amazon-products-${timestamp}.json`;

    const productCount = this.products.length;

    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      URL.revokeObjectURL(url);

      // Auto-clear products after successful export
      this.products = [];
      chrome.storage.local.set({ scrapedProducts: [] }, () => {
        this.renderProducts();
        this.updateStats();
        alert(`✅ Exported ${productCount} products to ${filename}\n\nProducts have been cleared from the list.`);
      });
    });
  }

  clearProducts() {
    if (this.products.length === 0) {
      return;
    }

    if (confirm(`Are you sure you want to clear all ${this.products.length} products?`)) {
      this.products = [];
      chrome.storage.local.set({ scrapedProducts: [] }, () => {
        this.renderProducts();
        this.updateStats();
      });
    }
  }

  // Order Management Methods

  async loadOrders() {
    chrome.storage.local.get(['scrapedOrders'], (result) => {
      this.orders = result.scrapedOrders || [];
      this.renderOrders();
      this.updateOrderStats();
    });
  }

  updateOrderStats() {
    const totalOrders = this.orders.length;
    let totalEarnings = 0;

    this.orders.forEach(order => {
      if (order.financials?.yourEarnings) {
        const earnings = parseFloat(order.financials.yourEarnings.replace(/[^0-9.]/g, '')) || 0;
        totalEarnings += earnings;
      }
    });

    document.getElementById('totalOrders').textContent = totalOrders;
    document.getElementById('totalEarnings').textContent = `$${totalEarnings.toFixed(2)}`;
  }

  renderOrders() {
    const container = document.getElementById('ordersContainer');

    if (this.orders.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <div class="empty-state-text">No orders scraped yet.<br>Visit an eBay order page and click "Scrape Order for Export"</div>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    this.orders.forEach((order, index) => {
      const card = this.createOrderCard(order, index);
      container.appendChild(card);
    });
  }

  createOrderCard(order, index) {
    const card = document.createElement('div');
    card.className = 'product-card';

    const firstItem = order.items?.[0] || {};
    const itemCount = order.items?.length || 0;

    card.innerHTML = `
      <div class="product-header">
        <div class="product-info" style="width: 100%;">
          <div class="product-title">Order #${order.orderId}</div>
          <div class="product-price">${order.financials?.yourEarnings || 'N/A'}</div>
          <div class="product-asin">${itemCount} item(s) • ${order.orderDate || 'No date'}</div>
          ${firstItem.title ? `<div class="product-asin" style="margin-top: 4px; font-style: italic;">${firstItem.title.substring(0, 50)}...</div>` : ''}
        </div>
      </div>
      <div class="product-actions">
        <button class="btn-small btn-view" data-index="${index}">View Details</button>
        <button class="btn-small btn-delete" data-index="${index}">Delete</button>
      </div>
    `;

    // Add event listeners
    card.querySelector('.btn-view').addEventListener('click', () => this.viewOrder(index));
    card.querySelector('.btn-delete').addEventListener('click', () => this.deleteOrder(index));

    return card;
  }

  viewOrder(index) {
    const order = this.orders[index];
    this.showOrderDetails(order);
  }

  showOrderDetails(order) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'product-details-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Order Details</h2>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <pre class="json-display">${JSON.stringify(order, null, 2)}</pre>
        </div>
        <div class="modal-footer">
          <button class="btn-copy">Copy JSON</button>
          ${order.url ? `<button class="btn-visit">Visit eBay Order</button>` : ''}
          <button class="btn-modal-close">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    const closeModal = () => {
      modal.remove();
    };

    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.btn-modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    modal.querySelector('.btn-copy').addEventListener('click', () => {
      navigator.clipboard.writeText(JSON.stringify(order, null, 2));
      alert('Order JSON copied to clipboard!');
    });

    if (order.url) {
      modal.querySelector('.btn-visit').addEventListener('click', () => {
        chrome.tabs.create({ url: order.url });
      });
    }
  }

  deleteOrder(index) {
    if (confirm('Are you sure you want to delete this order?')) {
      this.orders.splice(index, 1);
      chrome.storage.local.set({ scrapedOrders: this.orders }, () => {
        this.renderOrders();
        this.updateOrderStats();
      });
    }
  }

  exportOrders() {
    if (this.orders.length === 0) {
      alert('No orders to export');
      return;
    }

    // Show export format options
    const format = confirm('Click OK for JSON export, or Cancel for CSV export') ? 'json' : 'csv';

    if (format === 'json') {
      this.exportOrdersJSON();
    } else {
      this.exportOrdersCSV();
    }
  }

  exportOrdersJSON() {
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalOrders: this.orders.length,
      orders: this.orders
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `ebay-orders-${timestamp}.json`;

    const orderCount = this.orders.length;

    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      URL.revokeObjectURL(url);

      // Auto-clear orders after successful export
      this.orders = [];
      chrome.storage.local.set({ scrapedOrders: [] }, () => {
        this.renderOrders();
        this.updateOrderStats();
        alert(`✅ Exported ${orderCount} orders to ${filename}\n\nOrders have been cleared from the list.`);
      });
    });
  }

  exportOrdersCSV() {
    if (this.orders.length === 0) {
      alert('No orders to export');
      return;
    }

    // Define CSV headers
    const headers = [
      'Order ID',
      'Order Date',
      'Status',
      'Buyer Username',
      'Shipping Name',
      'Shipping Address',
      'Total Sale',
      'Your Earnings',
      'eBay Fees',
      'Shipping Cost',
      'Item Count',
      'Item Title',
      'Item ID',
      'Tracking Number',
      'Carrier',
      'URL',
      'Scraped At'
    ];

    // Convert orders to CSV rows
    const rows = this.orders.map(order => {
      const item = order.items?.[0] || {};
      return [
        order.orderId,
        order.orderDate,
        order.orderStatus,
        order.buyerInfo?.username || '',
        order.shippingAddress?.name || '',
        order.shippingAddress?.fullAddress || '',
        order.financials?.totalSale || '',
        order.financials?.yourEarnings || '',
        order.financials?.ebayFees || '',
        order.financials?.shippingCost || '',
        order.items?.length || 0,
        item.title || '',
        item.itemId || '',
        order.tracking?.trackingNumber || '',
        order.tracking?.carrier || '',
        order.url,
        order.scrapedAt
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });

    // Combine headers and rows
    const csvContent = [headers.join(','), ...rows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `ebay-orders-${timestamp}.csv`;

    const orderCount = this.orders.length;

    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      URL.revokeObjectURL(url);

      // Auto-clear orders after successful export
      this.orders = [];
      chrome.storage.local.set({ scrapedOrders: [] }, () => {
        this.renderOrders();
        this.updateOrderStats();
        alert(`✅ Exported ${orderCount} orders to ${filename}\n\nOrders have been cleared from the list.`);
      });
    });
  }

  clearOrders() {
    if (this.orders.length === 0) {
      return;
    }

    if (confirm(`Are you sure you want to clear all ${this.orders.length} orders?`)) {
      this.orders = [];
      chrome.storage.local.set({ scrapedOrders: [] }, () => {
        this.renderOrders();
        this.updateOrderStats();
      });
    }
  }
}

// Initialize popup manager
new PopupManager();
