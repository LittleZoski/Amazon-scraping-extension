/**
 * YamiProductScraper - Single product scraping for Yami.com
 * Follows the same pattern as ProductScraper.js for Amazon
 */

class YamiProductScraper {
  constructor() {
    this.scrapeButton = null;
  }

  async init() {
    this.injectScrapeButton();
  }

  /**
   * Inject scrape button into page
   */
  injectScrapeButton() {
    // Check if button already exists
    if (document.getElementById('yami-scraper-btn')) {
      return;
    }

    this.scrapeButton = document.createElement('button');
    this.scrapeButton.id = 'yami-scraper-btn';
    this.scrapeButton.innerHTML = '📦 Scrape for eBay';
    this.scrapeButton.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 10000;
      padding: 12px 20px;
      background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
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

  /**
   * Main scraping function
   */
  async scrapeProduct() {
    try {
      this.scrapeButton.innerHTML = '⏳ Scraping...';
      this.scrapeButton.disabled = true;

      // Extract product data (images now extracted from JSON-LD - much faster!)
      const productData = YamiDataExtractor.extractProductData();

      if (!productData.title) {
        throw new Error('Could not extract product information. Please make sure you are on a Yami product page.');
      }

      // Validate product
      const validation = this.validateProduct(productData);

      if (!validation.isValid) {
        const errorMessage = '❌ Cannot scrape this product:\n\n' + validation.errors.join('\n\n');
        alert(errorMessage);
        this.scrapeButton.innerHTML = '📦 Scrape for eBay';
        this.scrapeButton.disabled = false;
        return;
      }

      // Sanitize data (remove Yami branding)
      const sanitizedData = YamiDataSanitizer.sanitizeProductData(productData);

      // Save to storage
      await this.saveProduct(sanitizedData);

      // Show success notification
      this.showNotification('✅ Product scraped successfully!', 'success');
      this.scrapeButton.innerHTML = '✅ Scraped!';

      setTimeout(() => {
        this.scrapeButton.innerHTML = '📦 Scrape for eBay';
        this.scrapeButton.disabled = false;
      }, 2000);

    } catch (error) {
      console.error('Yami scraping error:', error);
      this.showNotification('❌ Error scraping product: ' + error.message, 'error');
      this.scrapeButton.innerHTML = '📦 Scrape for eBay';
      this.scrapeButton.disabled = false;
    }
  }

  /**
   * Validate product data
   * @param {Object} productData - Product data to validate
   * @returns {Object} Validation result with isValid and errors array
   */
  validateProduct(productData) {
    const errors = [];

    if (!productData.asin) {
      errors.push('Could not extract product ID from URL');
    }

    if (!productData.price) {
      errors.push('No price available - item may be out of stock');
    }

    if (!productData.images || productData.images.length === 0) {
      errors.push('No product images found');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Save product to storage
   * @param {Object} productData - Product data to save
   * @returns {Promise}
   */
  async saveProduct(productData) {
    return new Promise((resolve, reject) => {
      if (!chrome.runtime?.id) {
        this.saveToLocalStorage(productData);
        resolve();
        return;
      }

      try {
        chrome.storage.local.get(['scrapedProducts'], (result) => {
          const products = result.scrapedProducts || [];

          // Check if product already exists (update instead of duplicate)
          const existingIndex = products.findIndex(p =>
            p.asin === productData.asin
          );

          if (existingIndex >= 0) {
            products[existingIndex] = productData;
          } else {
            products.push(productData);
          }

          chrome.storage.local.set({ scrapedProducts: products }, () => {
            if (chrome.runtime.lastError) {
              console.warn('Chrome storage failed, using localStorage:', chrome.runtime.lastError);
              this.saveToLocalStorage(productData);
            }
            resolve();
          });
        });
      } catch (error) {
        console.warn('Chrome storage not available, using localStorage:', error);
        this.saveToLocalStorage(productData);
        resolve();
      }
    });
  }

  /**
   * Fallback: Save to localStorage
   * @param {Object} productData - Product data to save
   */
  saveToLocalStorage(productData) {
    try {
      const stored = localStorage.getItem('scrapedProducts');
      const products = stored ? JSON.parse(stored) : [];

      const existingIndex = products.findIndex(p =>
        p.asin === productData.asin
      );

      if (existingIndex >= 0) {
        products[existingIndex] = productData;
      } else {
        products.push(productData);
      }

      localStorage.setItem('scrapedProducts', JSON.stringify(products));
    } catch (error) {
      console.error('localStorage save failed:', error);
    }
  }

  /**
   * Show notification to user
   * @param {string} message - Notification message
   * @param {string} type - Notification type ('success' or 'error')
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10001;
      padding: 16px 24px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = YamiProductScraper;
}
