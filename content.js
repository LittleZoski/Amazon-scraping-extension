// Content script that runs on Amazon product pages
// Injects a scrape button and handles product data extraction

class AmazonScraper {
  constructor() {
    this.scrapeButton = null;
    this.init();
  }

  init() {
    // Wait for page to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.injectScrapeButton());
    } else {
      this.injectScrapeButton();
    }
  }

  injectScrapeButton() {
    // Only inject if we're on a product page
    if (!this.isProductPage()) {
      return;
    }

    // Create floating scrape button
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

    // Add hover effect
    this.scrapeButton.addEventListener('mouseenter', () => {
      this.scrapeButton.style.transform = 'scale(1.05)';
      this.scrapeButton.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
    });

    this.scrapeButton.addEventListener('mouseleave', () => {
      this.scrapeButton.style.transform = 'scale(1)';
      this.scrapeButton.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
    });

    // Add click handler
    this.scrapeButton.addEventListener('click', () => this.scrapeProduct());

    document.body.appendChild(this.scrapeButton);
  }

  isProductPage() {
    // Check if URL matches Amazon product page pattern
    const url = window.location.href;
    return url.includes('/dp/') || url.includes('/gp/product/');
  }

  async scrapeProduct() {
    try {
      // Change button state
      this.scrapeButton.innerHTML = '⏳ Scraping...';
      this.scrapeButton.disabled = true;

      const productData = this.extractProductData();

      if (!productData.title) {
        throw new Error('Could not extract product information');
      }

      // Save to storage
      await this.saveProduct(productData);

      // Show success
      this.showNotification('✅ Product scraped successfully!', 'success');
      this.scrapeButton.innerHTML = '✅ Scraped!';

      setTimeout(() => {
        this.scrapeButton.innerHTML = '📦 Scrape for eBay';
        this.scrapeButton.disabled = false;
      }, 2000);

    } catch (error) {
      console.error('Scraping error:', error);
      this.showNotification('❌ Error scraping product: ' + error.message, 'error');
      this.scrapeButton.innerHTML = '📦 Scrape for eBay';
      this.scrapeButton.disabled = false;
    }
  }

  extractProductData() {
    const data = {
      asin: this.getASIN(),
      title: this.getTitle(),
      price: this.getPrice(),
      images: this.getImages(),
      description: this.getDescription(),
      bulletPoints: this.getBulletPoints(),
      specifications: this.getSpecifications(),
      url: window.location.href,
      scrapedAt: new Date().toISOString()
    };

    return data;
  }

  getASIN() {
    // Extract ASIN from URL or page
    const urlMatch = window.location.href.match(/\/dp\/([A-Z0-9]{10})/);
    if (urlMatch) return urlMatch[1];

    const asinInput = document.querySelector('input[name="ASIN"]');
    if (asinInput) return asinInput.value;

    return null;
  }

  getTitle() {
    const selectors = [
      '#productTitle',
      '#title',
      'h1.a-size-large'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  getPrice() {
    const selectors = [
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price-whole'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  getImages() {
    const images = [];

    // Main image
    const mainImage = document.querySelector('#landingImage, #imgBlkFront');
    if (mainImage) {
      const src = mainImage.getAttribute('data-old-hires') ||
                  mainImage.getAttribute('src');
      if (src) images.push(src);
    }

    // Thumbnail images
    const thumbnails = document.querySelectorAll('#altImages img, .imageThumbnail img');
    thumbnails.forEach(img => {
      const src = img.getAttribute('src');
      if (src && !images.includes(src)) {
        // Try to get higher resolution version
        const highRes = src.replace(/\._.*_\./, '.');
        images.push(highRes);
      }
    });

    return images.slice(0, 10); // Limit to 10 images
  }

  getDescription() {
    const selectors = [
      '#productDescription p',
      '#feature-bullets',
      '.a-section.a-spacing-medium'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return '';
  }

  getBulletPoints() {
    const bullets = [];
    const bulletElements = document.querySelectorAll('#feature-bullets li, #featurebullets_feature_div li');

    bulletElements.forEach(li => {
      const text = li.textContent.trim();
      if (text && text.length > 0) {
        bullets.push(text);
      }
    });

    return bullets;
  }

  getSpecifications() {
    const specs = {};

    // Try to find specification table
    const specTables = document.querySelectorAll('#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr');

    specTables.forEach(row => {
      const th = row.querySelector('th');
      const td = row.querySelector('td');

      if (th && td) {
        const key = th.textContent.trim();
        const value = td.textContent.trim();
        specs[key] = value;
      }
    });

    return specs;
  }

  async saveProduct(productData) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['scrapedProducts'], (result) => {
        const products = result.scrapedProducts || [];

        // Check if product already exists (by ASIN)
        const existingIndex = products.findIndex(p => p.asin === productData.asin);

        if (existingIndex >= 0) {
          // Update existing product
          products[existingIndex] = productData;
        } else {
          // Add new product
          products.push(productData);
        }

        chrome.storage.local.set({ scrapedProducts: products }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    });
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10001;
      padding: 15px 25px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Initialize scraper
new AmazonScraper();
