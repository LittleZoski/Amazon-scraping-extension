/**
 * BulkOrderScraper - Bulk scraper for multiple eBay orders
 * Follows the same pattern as BulkScraper for consistency
 */
import { OrderScraper } from './OrderScraper.js';
import { OrderDataExtractor } from '../extractors/OrderDataExtractor.js';
import { OrderValidators } from '../utils/OrderValidators.js';
import { OrderDataSanitizer } from '../utils/OrderDataSanitizer.js';
import { OrderStorageManager } from '../storage/OrderStorageManager.js';
import { UIManager } from '../ui/UIManager.js';

export class BulkOrderScraper extends OrderScraper {
  constructor() {
    super();
    this.bulkScrapeButton = null;
    this.isScraping = false;
    this.shouldStop = false;
  }

  /**
   * Initialize bulk scraper and inject UI
   */
  async init() {
    if (this.isInitialized) {
      console.log('BulkOrderScraper already initialized');
      return;
    }

    console.log('Initializing BulkOrderScraper...');

    // Inject necessary styles
    UIManager.injectStyles();

    // Inject bulk scrape button
    this.injectBulkScrapeButton();

    this.isInitialized = true;
    console.log('BulkOrderScraper initialized successfully');
  }

  /**
   * Inject bulk scrape button on purchase history page
   */
  injectBulkScrapeButton() {
    // Check if button already exists
    if (document.getElementById('ebay-bulk-order-scrape-btn')) {
      console.log('Bulk scrape button already exists');
      return;
    }

    // Create button
    const button = document.createElement('button');
    button.id = 'ebay-bulk-order-scrape-btn';
    button.textContent = 'Scrape Multiple Orders';
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
    button.addEventListener('click', () => this.showBulkScrapeSettings());

    // Append to body
    document.body.appendChild(button);

    this.bulkScrapeButton = button;
    console.log('Bulk scrape button injected successfully');
  }

  /**
   * Show settings modal for bulk scraping
   */
  showBulkScrapeSettings() {
    // Count available order links on page
    const orderLinks = this.findOrderLinks();
    const orderCount = orderLinks.length;

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'bulk-order-scrape-modal';
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
      max-width: 500px;
      width: 90%;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    `;

    modalContent.innerHTML = `
      <h2 style="margin: 0 0 16px 0; color: #1a202c; font-size: 24px;">Bulk Order Scraping</h2>
      <p style="margin: 0 0 24px 0; color: #4a5568; font-size: 14px;">
        Found ${orderCount} orders on this page. Configure your scraping settings below.
      </p>

      <div style="margin-bottom: 24px;">
        <label style="display: block; margin-bottom: 8px; color: #2d3748; font-weight: 600; font-size: 14px;">
          Number of Orders to Scrape
        </label>
        <input type="range" id="order-count-slider" min="1" max="${orderCount}" value="${Math.min(5, orderCount)}"
          style="width: 100%; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; color: #718096; font-size: 12px;">
          <span>1</span>
          <span id="order-count-value">${Math.min(5, orderCount)}</span>
          <span>${orderCount}</span>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <label style="display: block; margin-bottom: 12px; color: #2d3748; font-weight: 600; font-size: 14px;">
          <input type="checkbox" id="earnings-filter-checkbox" style="margin-right: 8px;">
          Filter by Earnings
        </label>
        <div id="earnings-filter-options" style="padding-left: 24px; display: none;">
          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 4px; color: #4a5568; font-size: 13px;">
              Min Earnings: $<span id="min-earnings-value">0</span>
            </label>
            <input type="range" id="min-earnings-slider" min="0" max="500" value="0" step="5"
              style="width: 100%;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 4px; color: #4a5568; font-size: 13px;">
              Max Earnings: $<span id="max-earnings-value">1000</span>
            </label>
            <input type="range" id="max-earnings-slider" min="0" max="1000" value="1000" step="10"
              style="width: 100%;">
          </div>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <label style="display: block; margin-bottom: 12px; color: #2d3748; font-weight: 600; font-size: 14px;">
          <input type="checkbox" id="skip-duplicates-checkbox" checked style="margin-right: 8px;">
          Skip Already Scraped Orders
        </label>
      </div>

      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="cancel-bulk-scrape-btn" style="
          padding: 10px 20px;
          background: #e2e8f0;
          color: #2d3748;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        ">Cancel</button>
        <button id="start-bulk-scrape-btn" style="
          padding: 10px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        ">Start Scraping</button>
      </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Set up event listeners
    this.setupModalEventListeners(modal, modalContent, orderLinks);
  }

  /**
   * Set up event listeners for settings modal
   */
  setupModalEventListeners(modal, modalContent, orderLinks) {
    // Order count slider
    const countSlider = modalContent.querySelector('#order-count-slider');
    const countValue = modalContent.querySelector('#order-count-value');
    countSlider.addEventListener('input', (e) => {
      countValue.textContent = e.target.value;
    });

    // Earnings filter toggle
    const earningsCheckbox = modalContent.querySelector('#earnings-filter-checkbox');
    const earningsOptions = modalContent.querySelector('#earnings-filter-options');
    earningsCheckbox.addEventListener('change', (e) => {
      earningsOptions.style.display = e.target.checked ? 'block' : 'none';
    });

    // Min earnings slider
    const minEarningsSlider = modalContent.querySelector('#min-earnings-slider');
    const minEarningsValue = modalContent.querySelector('#min-earnings-value');
    minEarningsSlider.addEventListener('input', (e) => {
      minEarningsValue.textContent = e.target.value;
    });

    // Max earnings slider
    const maxEarningsSlider = modalContent.querySelector('#max-earnings-slider');
    const maxEarningsValue = modalContent.querySelector('#max-earnings-value');
    maxEarningsSlider.addEventListener('input', (e) => {
      maxEarningsValue.textContent = e.target.value;
    });

    // Cancel button
    const cancelBtn = modalContent.querySelector('#cancel-bulk-scrape-btn');
    cancelBtn.addEventListener('click', () => {
      modal.remove();
    });

    // Start scraping button
    const startBtn = modalContent.querySelector('#start-bulk-scrape-btn');
    startBtn.addEventListener('click', () => {
      const settings = {
        count: parseInt(countSlider.value),
        earningsFilter: earningsCheckbox.checked,
        minEarnings: parseInt(minEarningsSlider.value),
        maxEarnings: parseInt(maxEarningsSlider.value),
        skipDuplicates: modalContent.querySelector('#skip-duplicates-checkbox').checked,
      };

      modal.remove();
      this.bulkScrapeOrders(orderLinks, settings);
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // Close on Escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  /**
   * Find order links on the current page
   * @returns {Array} Array of order link objects with URL and order ID
   */
  findOrderLinks() {
    const links = [];

    // Try different selectors for eBay order links
    const selectors = [
      'a[href*="/orderdetails"]',
      'a[href*="/myb/PurchaseHistory"]',
      'a[href*="ViewOrderDetails"]',
      'a[href*="orderId"]',
      '[data-test-id="order-link"]',
      '.order-link',
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);

      elements.forEach(el => {
        const url = el.href;
        if (url && !links.some(link => link.url === url)) {
          // Try to extract order ID from URL or nearby elements
          const orderIdMatch = url.match(/orderid=([^&]+)/i);
          const orderId = orderIdMatch ? orderIdMatch[1] : null;

          links.push({
            url: url,
            orderId: orderId,
            element: el
          });
        }
      });

      if (links.length > 0) break;
    }

    console.log(`Found ${links.length} order links on page`);
    return links;
  }

  /**
   * Bulk scrape orders from links
   * @param {Array} orderLinks - Array of order link objects
   * @param {Object} settings - Scraping settings
   */
  async bulkScrapeOrders(orderLinks, settings) {
    this.isScraping = true;
    this.shouldStop = false;

    // Limit to requested count
    const linksToScrape = orderLinks.slice(0, settings.count);

    // Get existing orders if skip duplicates is enabled
    let existingOrders = [];
    if (settings.skipDuplicates) {
      existingOrders = await OrderStorageManager.getScrapedOrders();
    }

    // Create progress UI
    const progressUI = UIManager.createProgressIndicator(linksToScrape.length);
    document.body.appendChild(progressUI.container);

    // Add stop button event
    progressUI.stopButton.addEventListener('click', () => {
      this.shouldStop = true;
      UIManager.showNotification('Stopping bulk scrape...', 'info');
    });

    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // Process orders in batches
    const BATCH_SIZE = 3;
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < linksToScrape.length; i += BATCH_SIZE) {
      if (this.shouldStop) {
        console.log('Bulk scraping stopped by user');
        break;
      }

      const batch = linksToScrape.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (link, batchIndex) => {
        const currentIndex = i + batchIndex;

        try {
          // Update progress UI
          UIManager.updateProgressIndicator(
            progressUI,
            currentIndex + 1,
            linksToScrape.length,
            successCount,
            skippedCount,
            failedCount,
            `Scraping order ${currentIndex + 1}...`
          );

          // Fetch order page
          const orderData = await this.scrapeOrderFromLink(link.url);

          if (!orderData) {
            failedCount++;
            console.error(`Failed to scrape order from ${link.url}`);
            return;
          }

          // Check for duplicates
          if (settings.skipDuplicates && OrderValidators.isDuplicateOrder(orderData, existingOrders)) {
            skippedCount++;
            console.log(`Skipped duplicate order: ${orderData.orderId}`);
            return;
          }

          // Validate order
          const validationOptions = {
            minEarnings: settings.earningsFilter ? settings.minEarnings : undefined,
            maxEarnings: settings.earningsFilter ? settings.maxEarnings : undefined,
          };

          const validation = OrderValidators.validateOrder(orderData, validationOptions);

          if (!validation.isValid) {
            skippedCount++;
            console.log(`Skipped order ${orderData.orderId}: ${validation.errors.join(', ')}`);
            return;
          }

          // Sanitize and save
          const sanitizedOrder = OrderDataSanitizer.sanitizeOrderData(orderData);
          const saved = await OrderStorageManager.saveOrder(sanitizedOrder);

          if (saved) {
            successCount++;
            existingOrders.push(sanitizedOrder); // Add to existing orders for duplicate check
            console.log(`Saved order: ${sanitizedOrder.orderId}`);
          } else {
            failedCount++;
            console.error(`Failed to save order: ${orderData.orderId}`);
          }
        } catch (error) {
          failedCount++;
          console.error(`Error processing order:`, error);
        }
      });

      // Wait for batch to complete
      await Promise.allSettled(batchPromises);

      // Update progress after batch
      UIManager.updateProgressIndicator(
        progressUI,
        Math.min(i + BATCH_SIZE, linksToScrape.length),
        linksToScrape.length,
        successCount,
        skippedCount,
        failedCount,
        'Processing...'
      );

      // Delay between batches
      if (i + BATCH_SIZE < linksToScrape.length && !this.shouldStop) {
        await delay(500); // 500ms delay between batches
      }
    }

    // Final update
    UIManager.updateProgressIndicator(
      progressUI,
      linksToScrape.length,
      linksToScrape.length,
      successCount,
      skippedCount,
      failedCount,
      'Complete!'
    );

    // Show completion notification
    UIManager.showNotification(
      `Bulk scraping complete! Success: ${successCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`,
      'success'
    );

    // Remove progress UI after delay
    setTimeout(() => {
      progressUI.container.remove();
    }, 3000);

    this.isScraping = false;
  }

  /**
   * Scrape order from a link
   * @param {string} url - Order detail page URL
   * @returns {Promise<Object>} Scraped order data
   */
  async scrapeOrderFromLink(url) {
    try {
      console.log(`Fetching order from: ${url}`);

      // Fetch the order page
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch order page: ${response.status}`);
        return null;
      }

      const html = await response.text();

      // Parse HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Extract order data from parsed document
      const orderData = OrderDataExtractor.extractOrderDataFromDoc(doc, url);

      return orderData;
    } catch (error) {
      console.error(`Error scraping order from link:`, error);
      return null;
    }
  }

  /**
   * Clean up bulk scraper UI
   */
  cleanup() {
    super.cleanup();

    if (this.bulkScrapeButton) {
      this.bulkScrapeButton.remove();
      this.bulkScrapeButton = null;
    }

    // Remove any active modals
    const modal = document.getElementById('bulk-order-scrape-modal');
    if (modal) {
      modal.remove();
    }

    this.isScraping = false;
    this.shouldStop = false;

    console.log('BulkOrderScraper cleaned up');
  }
}
