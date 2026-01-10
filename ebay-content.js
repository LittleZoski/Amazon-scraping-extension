/**
 * eBay Content Script - Main entry point for eBay order scraping
 * Detects page type and initializes appropriate scraper
 *
 * Note: Using dynamic imports to work around Manifest V3 module limitations
 */

(async function() {
  'use strict';

  console.log('=== eBay Content Script Loaded ===');

  class EbayOrderScraperApp {
    constructor() {
      this.scraper = null;
      this.OrderScraper = null;
      this.BulkOrderScraper = null;
      this.init();
    }

    /**
     * Initialize the scraper based on page type
     */
    async init() {
      console.log('eBay Order Scraper initializing...');
      console.log('Current URL:', window.location.href);
      console.log('Document ready state:', document.readyState);

      // Load module classes
      try {
        console.log('Loading scraper modules...');
        const orderScraperModule = await import(chrome.runtime.getURL('src/scrapers/OrderScraper.js'));
        const bulkOrderScraperModule = await import(chrome.runtime.getURL('src/scrapers/BulkOrderScraper.js'));

        this.OrderScraper = orderScraperModule.OrderScraper;
        this.BulkOrderScraper = bulkOrderScraperModule.BulkOrderScraper;
        console.log('✓ Scraper modules loaded successfully');
      } catch (error) {
        console.error('❌ Failed to load scraper modules:', error);
        return;
      }

      // Wait for page to be ready
      if (document.readyState === 'loading') {
        console.log('Waiting for DOMContentLoaded...');
        document.addEventListener('DOMContentLoaded', () => this.initializeScraper());
      } else {
        console.log('DOM already loaded, initializing immediately');
        // Add a small delay to ensure eBay's dynamic content is loaded
        setTimeout(() => this.initializeScraper(), 500);
      }
    }

    /**
     * Initialize the appropriate scraper based on page type
     */
    async initializeScraper() {
      try {
        const pageType = this.detectPageType();
        console.log(`✓ Detected eBay page type: "${pageType}"`);

        switch (pageType) {
          case 'order-details':
            // Single order details page - use OrderScraper
            console.log('Creating OrderScraper instance...');
            this.scraper = new this.OrderScraper();
            console.log('Calling OrderScraper.init()...');
            await this.scraper.init();
            console.log('✓ OrderScraper initialized for order details page');
            break;

          case 'purchase-history':
            // Purchase history page with multiple orders - use BulkOrderScraper
            console.log('Creating BulkOrderScraper instance for purchase history...');
            this.scraper = new this.BulkOrderScraper();
            await this.scraper.init();
            console.log('✓ BulkOrderScraper initialized for purchase history page');
            break;

          case 'seller-hub':
            // Seller hub orders page - use BulkOrderScraper
            console.log('Creating BulkOrderScraper instance for seller hub...');
            this.scraper = new this.BulkOrderScraper();
            await this.scraper.init();
            console.log('✓ BulkOrderScraper initialized for seller hub page');
            break;

          default:
            console.warn(`⚠ No scraper needed for page type: "${pageType}"`);
            console.log('Supported page types: order-details, purchase-history, seller-hub');
            break;
        }
      } catch (error) {
        console.error('❌ Error initializing eBay scraper:', error);
        console.error('Error stack:', error.stack);
      }
    }

    /**
     * Detect the type of eBay page
     * @returns {string} Page type identifier
     */
    detectPageType() {
      const url = window.location.href;
      const pathname = window.location.pathname;

      console.log('Detecting page type for URL:', url);
      console.log('Pathname:', pathname);

      // Order details page - check for orderid parameter or /ord/details path
      if (
        url.includes('orderid=') ||
        url.includes('orderId=') ||
        pathname.includes('/ord/details') ||
        pathname.includes('/mesh/ord/details') ||
        pathname.includes('/orderdetails') ||
        url.includes('/ViewOrderDetails')
      ) {
        return 'order-details';
      }

      // Seller hub orders LIST page (not details)
      if (
        (pathname.includes('/sh/ord') && !pathname.includes('/details')) ||
        url.includes('/sellerhub/orders')
      ) {
        return 'seller-hub';
      }

      // Purchase history page (buyer side)
      if (
        url.includes('/myb/PurchaseHistory') ||
        pathname.includes('/PurchaseHistory') ||
        url.includes('/myb/orders')
      ) {
        return 'purchase-history';
      }

      // My eBay selling page
      if (
        url.includes('/myb/Selling') ||
        pathname.includes('/Selling') ||
        url.includes('/myb/ActiveListing')
      ) {
        return 'seller-hub';
      }

      console.log('No matching page type found');
      return 'unknown';
    }

    /**
     * Clean up and destroy the scraper
     */
    destroy() {
      if (this.scraper) {
        this.scraper.cleanup();
        this.scraper = null;
      }
    }
  }

  // Create and initialize the app
  let ebayScraperApp;
  try {
    ebayScraperApp = new EbayOrderScraperApp();
    console.log('✓ EbayOrderScraperApp instance created successfully');

    // Export for potential external access
    window.ebayScraperApp = ebayScraperApp;
  } catch (error) {
    console.error('❌ ERROR: Failed to create EbayOrderScraperApp:', error);
  }

  // Handle dynamic page navigation (if eBay uses SPA navigation)
  if (ebayScraperApp) {
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
      if (lastUrl !== window.location.href) {
        lastUrl = window.location.href;
        console.log('URL changed, reinitializing scraper...');

        // Clean up old scraper
        ebayScraperApp.destroy();

        // Initialize new scraper
        setTimeout(() => {
          ebayScraperApp.initializeScraper();
        }, 1000); // Wait for page to settle
      }
    });

    // Observe URL changes
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
})();
