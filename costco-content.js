/**
 * Costco Content Script - Main entry point for Costco.com scraping
 * Follows the same pattern as yami-content.js
 * Detects page type and initializes appropriate scraper
 */

/**
 * Main Costco Scraper Application
 */
class CostcoScraperApp {
  constructor() {
    this.init();
  }

  /**
   * Initialize the scraper
   */
  async init() {
    console.log('Costco scraper initialized');

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
   * Detect page type and inject appropriate scraper
   */
  injectScraper() {
    try {
      if (this.isProductPage()) {
        console.log('Costco product page detected - initializing single product scraper');
        const scraper = new CostcoProductScraper();
        scraper.init();
      } else if (this.isCategoryPage()) {
        console.log('Costco category page detected - initializing bulk scraper');
        const bulkScraper = new CostcoBulkScraper();
        bulkScraper.init();
      } else {
        console.log('Not a Costco product or category page - scraper not activated');
      }
    } catch (error) {
      console.error('Error initializing Costco scraper:', error);
    }
  }

  /**
   * Check if current page is a Costco product page
   * @returns {boolean}
   */
  isProductPage() {
    return CostcoDOMHelpers.isProductPage();
  }

  /**
   * Check if current page is a Costco category/search page
   * @returns {boolean}
   */
  isCategoryPage() {
    return CostcoDOMHelpers.isCategoryPage();
  }
}

// Message listener for programmatic scraping (used by bulk scraper with background tabs)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SCRAPE_PRODUCT_IN_TAB') {
    // This is a product page opened by the bulk scraper
    // Wait for page to fully load, then scrape and send data back
    const scrapeAndRespond = async () => {
      try {
        // Wait a bit for lazy loading and JavaScript to complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Extract product data using the same method as single product scraping
        const productData = CostcoDataExtractor.extractProductData();

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
  if (window.location.href.includes('costco.com')) {
    new CostcoScraperApp();
  }
}, 500);
