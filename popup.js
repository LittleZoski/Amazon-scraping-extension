// Popup script for managing scraped products

class PopupManager {
  constructor() {
    this.products = [];
    this.init();
  }

  init() {
    this.loadProducts();
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('exportBtn').addEventListener('click', () => this.exportProducts());
    document.getElementById('clearBtn').addEventListener('click', () => this.clearProducts());
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
          <div class="empty-state-text">No products scraped yet.<br>Visit an Amazon product page and click "Scrape for eBay"</div>
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
}

// Initialize popup manager
new PopupManager();
