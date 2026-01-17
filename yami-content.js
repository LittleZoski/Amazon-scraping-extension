/**
 * Yami Content Script - Main entry point for Yami.com scraping
 * Follows the same pattern as content.js for Amazon
 * Detects page type and initializes appropriate scraper
 */

// Load Yami-specific modules
// Note: In production, these would be bundled together

/**
 * Main Yami Scraper Application
 */
class YamiScraperApp {
  constructor() {
    this.primeOnlyMode = false; // For Yami: "Fulfilled by Yami" filter
    this.init();
  }

  /**
   * Initialize the scraper
   */
  async init() {
    console.log('Yami scraper initialized');

    // Load settings
    this.primeOnlyMode = await this.getPrimeOnlyMode();

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.injectScraper();
      });
    } else {
      this.injectScraper();
    }
  }

  /**
   * Get Prime-only mode setting from storage
   * @returns {Promise<boolean>}
   */
  async getPrimeOnlyMode() {
    return new Promise((resolve) => {
      if (!chrome.runtime?.id) {
        const stored = localStorage.getItem('primeOnlyMode');
        resolve(stored === 'true');
        return;
      }

      try {
        chrome.storage.local.get(['primeOnlyMode'], (result) => {
          resolve(result.primeOnlyMode || false);
        });
      } catch (error) {
        resolve(false);
      }
    });
  }

  /**
   * Detect page type and inject appropriate scraper
   */
  injectScraper() {
    try {
      if (this.isProductPage()) {
        console.log('Yami product page detected - initializing single product scraper');
        const scraper = new YamiProductScraper();
        scraper.init();
      } else if (this.isCategoryPage()) {
        console.log('Yami category page detected - initializing bulk scraper');
        const bulkScraper = new YamiBulkScraper();
        bulkScraper.init();
      } else {
        console.log('Not a Yami product or category page - scraper not activated');
      }
    } catch (error) {
      console.error('Error initializing Yami scraper:', error);
    }
  }

  /**
   * Check if current page is a Yami product page
   * @returns {boolean}
   */
  isProductPage() {
    return YamiDOMHelpers.isProductPage();
  }

  /**
   * Check if current page is a Yami category/search page
   * @returns {boolean}
   */
  isCategoryPage() {
    return YamiDOMHelpers.isCategoryPage();
  }
}

// Message listener for programmatic scraping (used by bulk scraper with background tabs)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SCRAPE_PRODUCT_IN_TAB') {
    // This is a product page opened by the bulk scraper
    // Wait for page to fully load, then scrape and send data back
    const scrapeAndRespond = async () => {
      try {
        // Wait a bit for lazy loading to complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Extract product data using the same method as single product scraping
        const productData = YamiDataExtractor.extractProductData();

        // Send data back to the bulk scraper
        sendResponse({ success: true, data: productData });
      } catch (error) {
        console.error('Error scraping product in tab:', error);
        sendResponse({ success: false, error: error.message });
      }
    };

    scrapeAndRespond();
    return true; // Keep message channel open for async response
  }
});

// Bootstrap the application
// Wait a bit to ensure page is loaded
setTimeout(() => {
  if (window.location.href.includes('yami.com')) {
    new YamiScraperApp();
  }
}, 500);
