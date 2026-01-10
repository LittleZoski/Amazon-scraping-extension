/**
 * Product Scraper
 * Handles scraping individual Amazon product pages
 */
import { DataExtractor } from '../extractors/DataExtractor.js';
import { DataSanitizer } from '../utils/DataSanitizer.js';
import { Validators } from '../utils/Validators.js';
import { StorageManager } from '../storage/StorageManager.js';
import { UIManager } from '../ui/UIManager.js';

export class ProductScraper {
  constructor() {
    this.scrapeButton = null;
    this.primeOnlyMode = false;
  }

  async init() {
    this.primeOnlyMode = await StorageManager.getPrimeOnlyMode();
    this.injectScrapeButton();
  }

  injectScrapeButton() {
    this.scrapeButton = document.createElement('button');
    this.scrapeButton.id = 'amazon-scraper-btn';
    this.scrapeButton.innerHTML = '📦 Scrape for eBay';
    this.scrapeButton.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 10000;
      padding: 12px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;
    `;

    this.scrapeButton.addEventListener('mouseenter', () => {
      this.scrapeButton.style.transform = 'scale(1.05)';
      this.scrapeButton.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
    });

    this.scrapeButton.addEventListener('mouseleave', () => {
      this.scrapeButton.style.transform = 'scale(1)';
      this.scrapeButton.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
    });

    this.scrapeButton.addEventListener('click', () => this.scrapeProduct());
    document.body.appendChild(this.scrapeButton);
  }

  async scrapeProduct() {
    try {
      this.scrapeButton.innerHTML = '⏳ Scraping...';
      this.scrapeButton.disabled = true;

      const productData = DataExtractor.extractProductData();

      if (!productData.title) {
        throw new Error('Could not extract product information');
      }

      const validation = Validators.validateProduct(
        productData,
        this.primeOnlyMode,
        () => DataExtractor.getDeliveryDate()
      );

      if (!validation.isValid) {
        const errorMessage = '❌ Cannot scrape this product:\n\n' + validation.errors.join('\n\n');
        alert(errorMessage);
        this.scrapeButton.innerHTML = '📦 Scrape for eBay';
        this.scrapeButton.disabled = false;
        return;
      }

      const sanitizedData = DataSanitizer.sanitizeProductData(productData);
      await StorageManager.saveProduct(sanitizedData);

      UIManager.showNotification('✅ Product scraped successfully!', 'success');
      this.scrapeButton.innerHTML = '✅ Scraped!';

      setTimeout(() => {
        this.scrapeButton.innerHTML = '📦 Scrape for eBay';
        this.scrapeButton.disabled = false;
      }, 2000);

    } catch (error) {
      console.error('Scraping error:', error);
      UIManager.showNotification('❌ Error scraping product: ' + error.message, 'error');
      this.scrapeButton.innerHTML = '📦 Scrape for eBay';
      this.scrapeButton.disabled = false;
    }
  }
}
