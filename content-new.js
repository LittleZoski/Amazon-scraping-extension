/**
 * Amazon Scraper Extension - Main Content Script
 * Orchestrates all modules for product scraping and address importing
 */

// Import all modules
import { DOMHelpers } from './src/utils/DOMHelpers.js';
import { UIManager } from './src/ui/UIManager.js';
import { ProductScraper } from './src/scrapers/ProductScraper.js';
import { BulkScraper } from './src/scrapers/BulkScraper.js';
import { AddressImporter } from './src/address/AddressImporter.js';

/**
 * Main Application Controller
 * Initializes and coordinates all extension functionality
 */
class AmazonScraperApp {
  constructor() {
    this.productScraper = null;
    this.bulkScraper = null;
    this.addressImporter = null;
    this.init();
  }

  async init() {
    // Wait for page to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initializeFeatures());
    } else {
      this.initializeFeatures();
    }

    // Inject global styles
    UIManager.injectStyles();
  }

  async initializeFeatures() {
    // Check what type of page we're on and initialize appropriate features

    if (DOMHelpers.isProductPage()) {
      // Single product page - initialize product scraper
      this.productScraper = new ProductScraper();
      await this.productScraper.init();
    }
    else if (DOMHelpers.isCategoryPage()) {
      // Category/listing page - initialize bulk scraper
      this.bulkScraper = new BulkScraper();
      await this.bulkScraper.init();
    }

    // Always check for address import functionality on address pages
    if (DOMHelpers.isAddressPage()) {
      this.addressImporter = new AddressImporter();
      this.addressImporter.init();
    }
  }
}

// Initialize the application
new AmazonScraperApp();
