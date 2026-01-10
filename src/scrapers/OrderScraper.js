/**
 * OrderScraper - Main scraper class for eBay order detail pages
 * Follows the same pattern as ProductScraper for consistency
 */
import { OrderDataExtractor } from '../extractors/OrderDataExtractor.js';
import { OrderValidators } from '../utils/OrderValidators.js';
import { OrderDataSanitizer } from '../utils/OrderDataSanitizer.js';
import { OrderStorageManager } from '../storage/OrderStorageManager.js';
import { UIManager } from '../ui/UIManager.js';

export class OrderScraper {
  constructor() {
    this.scrapeButton = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the scraper and inject UI
   */
  async init() {
    if (this.isInitialized) {
      console.log('OrderScraper already initialized');
      return;
    }

    console.log('Initializing OrderScraper...');

    // Inject necessary styles
    UIManager.injectStyles();

    // Inject scrape button
    this.injectScrapeButton();

    this.isInitialized = true;
    console.log('OrderScraper initialized successfully');
  }

  /**
   * Inject the "Scrape Order" button on the page
   */
  injectScrapeButton() {
    // Check if button already exists
    if (document.getElementById('ebay-order-scrape-btn')) {
      console.log('Scrape button already exists');
      return;
    }

    // Create button
    const button = document.createElement('button');
    button.id = 'ebay-order-scrape-btn';
    button.textContent = 'Scrape Order for Export';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
      padding: 12px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
      transition: all 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    `;

    // Add hover effect
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
      button.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.15), 0 3px 6px rgba(0, 0, 0, 0.1)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)';
    });

    // Add click handler
    button.addEventListener('click', () => this.scrapeOrder());

    // Append to body
    document.body.appendChild(button);

    this.scrapeButton = button;
    console.log('Scrape button injected successfully');
  }

  /**
   * Main scraping function - extracts and saves order data
   */
  async scrapeOrder() {
    try {
      // Disable button during scraping
      this.scrapeButton.disabled = true;
      this.scrapeButton.textContent = 'Scraping...';
      this.scrapeButton.style.opacity = '0.7';

      console.log('Starting order scraping...');

      // Extract order data
      const orderData = OrderDataExtractor.extractOrderData();
      console.log('Extracted order data:', orderData);

      // Validate order data
      const validation = OrderValidators.validateOrder(orderData);
      if (!validation.isValid) {
        console.error('Order validation failed:', validation.errors);
        UIManager.showNotification(
          `Validation failed: ${validation.errors.join(', ')}`,
          'error'
        );
        return;
      }

      console.log('Order data validated successfully');

      // Sanitize order data
      const sanitizedOrder = OrderDataSanitizer.sanitizeOrderData(orderData);
      console.log('Sanitized order data:', sanitizedOrder);

      // Save to storage
      const saved = await OrderStorageManager.saveOrder(sanitizedOrder);

      if (saved) {
        UIManager.showNotification(
          `Order ${sanitizedOrder.orderId} scraped successfully!`,
          'success'
        );
        console.log('Order saved successfully');

        // Show order count
        const count = await OrderStorageManager.getOrderCount();
        console.log(`Total scraped orders: ${count}`);
      } else {
        UIManager.showNotification(
          'Failed to save order data',
          'error'
        );
        console.error('Failed to save order');
      }
    } catch (error) {
      console.error('Error scraping order:', error);
      UIManager.showNotification(
        `Error: ${error.message}`,
        'error'
      );
    } finally {
      // Re-enable button
      this.scrapeButton.disabled = false;
      this.scrapeButton.textContent = 'Scrape Order for Export';
      this.scrapeButton.style.opacity = '1';
    }
  }

  /**
   * Remove the scraper UI and clean up
   */
  cleanup() {
    if (this.scrapeButton) {
      this.scrapeButton.remove();
      this.scrapeButton = null;
    }

    this.isInitialized = false;
    console.log('OrderScraper cleaned up');
  }

  /**
   * Update button position or style
   * @param {Object} styles - Style object to apply
   */
  updateButtonStyle(styles) {
    if (this.scrapeButton) {
      Object.assign(this.scrapeButton.style, styles);
    }
  }

  /**
   * Show order preview modal before scraping
   * @param {Object} orderData - Order data to preview
   * @returns {Promise<boolean>} True if user confirms, false if cancelled
   */
  async showOrderPreview(orderData) {
    return new Promise((resolve) => {
      // Create modal
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10003;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      `;

      // Create modal content
      const modalContent = document.createElement('div');
      modalContent.style.cssText = `
        background: white;
        padding: 24px;
        border-radius: 12px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      `;

      // Build preview content
      const items = orderData.items || [];
      const itemsHtml = items.map(item => `
        <div style="margin: 8px 0; padding: 8px; background: #f7fafc; border-radius: 4px;">
          <strong>${item.title || 'Unknown Item'}</strong><br>
          <small>ID: ${item.itemId || 'N/A'} | Price: ${item.soldPrice || 'N/A'} | Qty: ${item.quantity || 1}</small>
        </div>
      `).join('');

      modalContent.innerHTML = `
        <h2 style="margin: 0 0 16px 0; color: #1a202c; font-size: 24px;">Order Preview</h2>

        <div style="margin-bottom: 16px;">
          <p style="margin: 4px 0;"><strong>Order ID:</strong> ${orderData.orderId}</p>
          <p style="margin: 4px 0;"><strong>Date:</strong> ${orderData.orderDate || 'N/A'}</p>
          <p style="margin: 4px 0;"><strong>Status:</strong> ${orderData.orderStatus || 'N/A'}</p>
        </div>

        <div style="margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #2d3748; font-size: 18px;">Shipping Address</h3>
          <p style="margin: 4px 0;"><strong>Name:</strong> ${orderData.shippingAddress?.name || 'N/A'}</p>
          <p style="margin: 4px 0;"><strong>Address:</strong> ${orderData.shippingAddress?.fullAddress || 'N/A'}</p>
        </div>

        <div style="margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #2d3748; font-size: 18px;">Items (${items.length})</h3>
          ${itemsHtml}
        </div>

        <div style="margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #2d3748; font-size: 18px;">Financials</h3>
          <p style="margin: 4px 0;"><strong>Total Sale:</strong> ${orderData.financials?.totalSale || 'N/A'}</p>
          <p style="margin: 4px 0;"><strong>Your Earnings:</strong> ${orderData.financials?.yourEarnings || 'N/A'}</p>
          <p style="margin: 4px 0;"><strong>eBay Fees:</strong> ${orderData.financials?.ebayFees || 'N/A'}</p>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <button id="preview-cancel-btn" style="
            padding: 10px 20px;
            background: #e2e8f0;
            color: #2d3748;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          ">Cancel</button>
          <button id="preview-confirm-btn" style="
            padding: 10px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          ">Confirm & Save</button>
        </div>
      `;

      modal.appendChild(modalContent);
      document.body.appendChild(modal);

      // Handle buttons
      const confirmBtn = modalContent.querySelector('#preview-confirm-btn');
      const cancelBtn = modalContent.querySelector('#preview-cancel-btn');

      confirmBtn.addEventListener('click', () => {
        modal.remove();
        resolve(true);
      });

      cancelBtn.addEventListener('click', () => {
        modal.remove();
        resolve(false);
      });

      // Close on background click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
          resolve(false);
        }
      });

      // Close on Escape key
      const escapeHandler = (e) => {
        if (e.key === 'Escape') {
          modal.remove();
          document.removeEventListener('keydown', escapeHandler);
          resolve(false);
        }
      };
      document.addEventListener('keydown', escapeHandler);
    });
  }

  /**
   * Scrape order with preview
   */
  async scrapeOrderWithPreview() {
    try {
      // Extract order data
      const orderData = OrderDataExtractor.extractOrderData();
      console.log('Extracted order data:', orderData);

      // Show preview and wait for confirmation
      const confirmed = await this.showOrderPreview(orderData);

      if (!confirmed) {
        UIManager.showNotification('Order scraping cancelled', 'info');
        return;
      }

      // Validate order data
      const validation = OrderValidators.validateOrder(orderData);
      if (!validation.isValid) {
        console.error('Order validation failed:', validation.errors);
        UIManager.showNotification(
          `Validation failed: ${validation.errors.join(', ')}`,
          'error'
        );
        return;
      }

      // Sanitize order data
      const sanitizedOrder = OrderDataSanitizer.sanitizeOrderData(orderData);

      // Save to storage
      const saved = await OrderStorageManager.saveOrder(sanitizedOrder);

      if (saved) {
        UIManager.showNotification(
          `Order ${sanitizedOrder.orderId} saved successfully!`,
          'success'
        );
      } else {
        UIManager.showNotification('Failed to save order data', 'error');
      }
    } catch (error) {
      console.error('Error scraping order:', error);
      UIManager.showNotification(`Error: ${error.message}`, 'error');
    }
  }
}
