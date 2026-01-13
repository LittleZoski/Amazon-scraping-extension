/**
 * Amazon Scraper Extension - Bundled Refactored Version
 * All modules combined into a single file for Chrome extension compatibility
 *
 * Original structure:
 * - src/utils/        (DOMHelpers, DataSanitizer, Validators)
 * - src/extractors/   (DataExtractor)
 * - src/scrapers/     (ProductScraper, BulkScraper)
 * - src/address/      (AddressImporter)
 * - src/ui/           (UIManager)
 * - src/storage/      (StorageManager)
 */

"use strict";



// ========================================
// DOMHELPERS MODULE
// ========================================

/**
 * DOM Helper Utilities
 * Provides reusable DOM manipulation and query methods
 */
class DOMHelpers {
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static isProductPage() {
    const url = window.location.href;
    return url.includes('/dp/') || url.includes('/gp/product/');
  }

  static isCategoryPage() {
    const url = window.location.href;
    return url.includes('/s?') ||
           url.includes('/s/') ||
           url.includes('/b/') ||
           url.includes('node=') ||
           url.includes('/gp/bestsellers') ||
           url.includes('/zgbs/') ||
           url.includes('/Best-Sellers') ||
           url.includes('/gp/new-releases') ||
           url.includes('/gp/movers-and-shakers') ||
           url.includes('/gp/most-wished-for');
  }

  static isAddressPage() {
    return window.location.href.includes('/a/addresses');
  }

  static isAddAddressPage() {
    return window.location.href.includes('/a/addresses/add');
  }

  static isAddressSuccessPage() {
    return window.location.href.includes('alertId=yaab-enterAddressSucceed');
  }

  static getVisibleProductCount() {
    const productSelectors = [
      '[data-asin]:not([data-asin=""])',
      '.s-result-item[data-asin]',
      '.zg-grid-general-faceout',
      '.a-carousel-card'
    ];

    const products = new Set();
    productSelectors.forEach(selector => {
      const items = document.querySelectorAll(selector);
      items.forEach(item => {
        const asin = item.getAttribute('data-asin');
        if (asin && asin.length === 10) {
          products.add(asin);
        }
      });
    });

    return products.size || 0;
  }

  static extractASIN() {
    const urlMatch = window.location.href.match(/\/dp\/([A-Z0-9]{10})/);
    if (urlMatch) return urlMatch[1];

    const asinInput = document.querySelector('input[name="ASIN"]');
    if (asinInput) return asinInput.value;

    return null;
  }

  static parsePrice(priceText) {
    if (!priceText) return 0;
    const cleaned = priceText.replace(/[^0-9.]/g, '');
    const price = parseFloat(cleaned);
    return isNaN(price) ? 0 : price;
  }

  static formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return '';

    const digitsOnly = phoneNumber.replace(/\D/g, '');

    if (digitsOnly.length === 10) {
      return `+1 ${digitsOnly.substring(0, 3)}-${digitsOnly.substring(3, 6)}-${digitsOnly.substring(6)}`;
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      return `+1 ${digitsOnly.substring(1, 4)}-${digitsOnly.substring(4, 7)}-${digitsOnly.substring(7)}`;
    } else if (digitsOnly.length === 11) {
      return `+1 ${digitsOnly.substring(1, 4)}-${digitsOnly.substring(4, 7)}-${digitsOnly.substring(7)}`;
    } else {
      return phoneNumber;
    }
  }
}



// ========================================
// DATASANITIZER MODULE
// ========================================

/**
 * Data Sanitizer
 * Removes Amazon branding and sanitizes product data for reselling
 */
class DataSanitizer {
  static sanitizeProductData(productData) {
    const sanitized = JSON.parse(JSON.stringify(productData));

    if (sanitized.title) {
      sanitized.title = this.removeAmazonBranding(sanitized.title);
    }

    if (sanitized.description) {
      sanitized.description = this.removeAmazonBranding(sanitized.description);
    }

    if (sanitized.bulletPoints && Array.isArray(sanitized.bulletPoints)) {
      sanitized.bulletPoints = sanitized.bulletPoints.map(bullet =>
        this.removeAmazonBranding(bullet)
      );
    }

    if (sanitized.specifications && typeof sanitized.specifications === 'object') {
      Object.keys(sanitized.specifications).forEach(key => {
        sanitized.specifications[key] = this.removeAmazonBranding(sanitized.specifications[key]);
      });
    }

    if (sanitized.url) {
      sanitized.originalAmazonUrl = sanitized.url;
      sanitized.url = `Product ASIN: ${sanitized.asin}`;
    }

    return sanitized;
  }

  static removeAmazonBranding(text) {
    if (!text || typeof text !== 'string') return text;

    const patterns = [
      { pattern: /\bAmazon\.com\b/gi, replacement: '' },
      { pattern: /\bAmazon\b/gi, replacement: '' },
      { pattern: /\bAMZ\b/gi, replacement: '' },
      { pattern: /\bamzn\b/gi, replacement: '' },
      { pattern: /Amazon Prime/gi, replacement: '' },
      { pattern: /Prime eligible/gi, replacement: '' },
      { pattern: /Amazon's Choice/gi, replacement: '' },
      { pattern: /Amazon Basics/gi, replacement: 'Basic' },
      { pattern: /Amazon\.com Gift Card/gi, replacement: 'Gift Card' },
      { pattern: /Ships from Amazon/gi, replacement: '' },
      { pattern: /Sold by Amazon/gi, replacement: '' },
      { pattern: /Fulfilled by Amazon/gi, replacement: '' },
      { pattern: /\bFBA\b/gi, replacement: '' },
      { pattern: /https?:\/\/(www\.)?amazon\.[a-z.]+\/[^\s]*/gi, replacement: '' },
      { pattern: /www\.amazon\.[a-z]+/gi, replacement: '' },
      { pattern: /\s+/g, replacement: ' ' },
      { pattern: /\s,/g, replacement: ',' },
      { pattern: /\s\./g, replacement: '.' },
      { pattern: /^\s+|\s+$/g, replacement: '' },
    ];

    let sanitized = text;
    patterns.forEach(({ pattern, replacement }) => {
      sanitized = sanitized.replace(pattern, replacement);
    });

    return sanitized;
  }
}



// ========================================
// VALIDATORS MODULE
// ========================================

/**
 * Product Validators
 * Validates products based on various criteria
 */
class Validators {
  static validateProduct(productData, primeOnly = false, getDeliveryDateFn = null) {
    const errors = [];

    if (!productData.price || productData.price === null || productData.price === '') {
      errors.push('No price available - item may be out of stock');
    }

    if (getDeliveryDateFn) {
      const deliveryDate = getDeliveryDateFn();
      if (deliveryDate) {
        const daysUntilDelivery = this.calculateDaysUntilDelivery(deliveryDate);
        if (daysUntilDelivery !== null && daysUntilDelivery > 10) {
          errors.push(`Delivery time too long (${daysUntilDelivery} days) - ships after ${deliveryDate}`);
        }
      }
    }

    if (primeOnly && productData.isPrime === false) {
      errors.push('Not eligible for Amazon Prime shipping');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  static validateProductFromDoc(productData, primeOnly = false) {
    const errors = [];

    if (!productData.price || productData.price === null || productData.price === '') {
      errors.push('No price available');
    }

    if (primeOnly && productData.isPrime === false) {
      errors.push('Not Prime eligible');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  static calculateDaysUntilDelivery(deliveryDateStr) {
    if (!deliveryDateStr) return null;

    try {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();

      const cleanDate = deliveryDateStr.replace(/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/i, '').trim();
      const deliveryDate = new Date(`${cleanDate}, ${currentYear}`);

      if (deliveryDate.getMonth() < currentMonth) {
        deliveryDate.setFullYear(currentYear + 1);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      deliveryDate.setHours(0, 0, 0, 0);

      const diffTime = deliveryDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays;
    } catch (error) {
      console.error('Error parsing delivery date:', error);
      return null;
    }
  }
}



// ========================================
// STORAGEMANAGER MODULE
// ========================================

/**
 * Storage Manager
 * Handles all data persistence using Chrome storage and localStorage fallback
 */
class StorageManager {
  static async saveProduct(productData) {
    return new Promise((resolve, reject) => {
      if (!chrome.runtime?.id) {
        console.warn('Extension context invalidated, using localStorage');
        this.saveToLocalStorage(productData);
        resolve();
        return;
      }

      try {
        chrome.storage.local.get(['scrapedProducts'], (result) => {
          if (chrome.runtime.lastError) {
            console.warn('chrome.storage failed, using localStorage:', chrome.runtime.lastError);
            this.saveToLocalStorage(productData);
            resolve();
            return;
          }

          const products = result.scrapedProducts || [];
          const existingIndex = products.findIndex(p => p.asin === productData.asin);

          if (existingIndex >= 0) {
            products[existingIndex] = productData;
          } else {
            products.push(productData);
          }

          chrome.storage.local.set({ scrapedProducts: products }, () => {
            if (chrome.runtime.lastError) {
              console.warn('chrome.storage.set failed, using localStorage:', chrome.runtime.lastError);
              this.saveToLocalStorage(productData);
              resolve();
            } else {
              resolve();
            }
          });
        });
      } catch (error) {
        console.warn('Extension context invalidated, using localStorage');
        this.saveToLocalStorage(productData);
        resolve();
      }
    });
  }

  static saveToLocalStorage(productData) {
    try {
      const stored = localStorage.getItem('scrapedProducts');
      const products = stored ? JSON.parse(stored) : [];
      const existingIndex = products.findIndex(p => p.asin === productData.asin);

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

  static async getPrimeOnlyMode() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['primeOnlyMode'], (result) => {
        resolve(result.primeOnlyMode || false);
      });
    });
  }

  static async setPrimeOnlyMode(value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ primeOnlyMode: value }, () => {
        resolve();
      });
    });
  }
}



// ========================================
// UIMANAGER MODULE
// ========================================

/**
 * UI Manager
 * Handles all UI components: buttons, modals, notifications, progress indicators
 */

class UIManager {
  static showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10001;
      padding: 15px 25px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
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

  static createProgressIndicator(total) {
    const progressContainer = document.createElement('div');
    progressContainer.id = 'amazon-scraper-progress';
    progressContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10002;
      background: white;
      border-radius: 12px;
      padding: 25px 30px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      min-width: 350px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    progressContainer.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 24px; margin-bottom: 10px;">📦</div>
        <div style="font-size: 18px; font-weight: 600; color: #333;">Scraping Products</div>
      </div>

      <div style="margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; color: #666;">
          <span id="progress-text">0 / ${total}</span>
          <span id="progress-percent">0%</span>
        </div>
        <div style="background: #e0e0e0; border-radius: 10px; height: 20px; overflow: hidden;">
          <div id="progress-bar" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 100%; width: 0%; transition: width 0.3s ease;"></div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-around; font-size: 13px; color: #666;">
        <div>
          <span style="color: #10b981; font-weight: 600;" id="success-count">0</span> Success
        </div>
        <div>
          <span style="color: #f59e0b; font-weight: 600;" id="skipped-count">0</span> Skipped
        </div>
        <div>
          <span style="color: #ef4444; font-weight: 600;" id="fail-count">0</span> Failed
        </div>
      </div>

      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
        <div style="font-size: 12px; color: #999; text-align: center; margin-bottom: 15px;">
          Currently scraping: <span id="current-item" style="color: #667eea; font-weight: 500;">Product 0</span>
        </div>
        <button id="stop-scraping-btn" style="width: 100%; padding: 10px; background: #ef4444; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px; transition: all 0.2s;">
          ⏸ Stop Scraping
        </button>
      </div>
    `;

    const stopBtn = progressContainer.querySelector('#stop-scraping-btn');
    stopBtn.addEventListener('mouseenter', () => {
      stopBtn.style.background = '#dc2626';
      stopBtn.style.transform = 'scale(1.02)';
    });
    stopBtn.addEventListener('mouseleave', () => {
      stopBtn.style.background = '#ef4444';
      stopBtn.style.transform = 'scale(1)';
    });

    return progressContainer;
  }

  static updateProgressIndicator(progressUI, current, total, successCount, failCount, skippedCount = 0) {
    const percent = Math.round((current / total) * 100);
    progressUI.querySelector('#progress-text').textContent = `${current} / ${total}`;
    progressUI.querySelector('#progress-percent').textContent = `${percent}%`;
    progressUI.querySelector('#progress-bar').style.width = `${percent}%`;
    progressUI.querySelector('#success-count').textContent = successCount;
    progressUI.querySelector('#skipped-count').textContent = skippedCount;
    progressUI.querySelector('#fail-count').textContent = failCount;
    progressUI.querySelector('#current-item').textContent = `Product ${current}`;
  }

  static injectStyles() {
    if (document.getElementById('amazon-scraper-styles')) return;

    const style = document.createElement('style');
    style.id = 'amazon-scraper-styles';
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
  }
}



// ========================================
// DATAEXTRACTOR MODULE
// ========================================

/**
 * Data Extractor
 * Extracts product information from Amazon product pages (live DOM and parsed HTML documents)
 */

class DataExtractor {
  // ===== Current Page Extraction =====

  static extractProductData() {
    return {
      asin: DOMHelpers.extractASIN(),
      title: this.getTitle(),
      price: this.getPrice(),
      deliveryFee: this.getDeliveryFee(),
      isPrime: this.isPrimeEligible(),
      images: this.getImages(),
      description: this.getDescription(),
      bulletPoints: this.getBulletPoints(),
      specifications: this.getSpecifications(),
      url: window.location.href,
      scrapedAt: new Date().toISOString()
    };
  }

  static getTitle() {
    const selectors = ['#productTitle', '#title', 'h1.a-size-large'];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element.textContent.trim();
    }
    return null;
  }

  static getPrice() {
    const typicalPriceSelectors = [
      'span.a-price[data-a-color="secondary"] .a-offscreen',
      '.a-price.a-text-price .a-offscreen',
      'span:contains("Typical price") + .a-price .a-offscreen',
      'span:contains("List Price") + .a-price .a-offscreen',
      '.a-text-price .a-offscreen'
    ];

    for (const selector of typicalPriceSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const priceText = element.textContent.trim();
        if (priceText.includes('$') && /\$\d+\.\d{2}/.test(priceText)) {
          if (!this.isUnitPriceText(priceText, element)) {
            return priceText;
          }
        }
      }
    }

    const pageText = document.body.textContent;
    const typicalMatch = pageText.match(/Typical\s*price:\s*\$(\d+\.\d{2})/i);
    if (typicalMatch) return '$' + typicalMatch[1];

    const listMatch = pageText.match(/List\s*Price:\s*\$(\d+\.\d{2})/i);
    if (listMatch) return '$' + listMatch[1];

    const selectors = [
      '.a-price[data-a-size="xl"]',
      '.a-price[data-a-size="large"]',
      '.a-price'
    ];

    for (const selector of selectors) {
      const priceContainers = document.querySelectorAll(selector);
      for (const container of priceContainers) {
        if (this.isUnitPriceContainer(container)) continue;

        const offscreenPrice = container.querySelector('.a-offscreen');
        if (offscreenPrice && offscreenPrice.textContent.trim()) {
          const priceText = offscreenPrice.textContent.trim();
          if ((priceText.includes('$') || /\d/.test(priceText)) && !this.isUnitPriceText(priceText, offscreenPrice)) {
            return priceText;
          }
        }

        const wholePrice = container.querySelector('.a-price-whole');
        if (wholePrice && wholePrice.textContent.trim()) {
          const priceText = wholePrice.textContent.trim();
          if (/\d/.test(priceText) && !this.isUnitPriceText('$' + priceText, wholePrice)) {
            return '$' + priceText;
          }
        }
      }
    }

    const legacySelectors = ['#priceblock_ourprice', '#priceblock_dealprice', '#price_inside_buybox'];
    for (const selector of legacySelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  static isUnitPriceText(priceText, element) {
    const unitPricePatterns = [
      /\$[\d.,]+\s*(per|\/)\s*(fl\.?\s*oz|fluid\s*ounce|ounce|oz|count|each|lb|pound|kg|gram|item|piece)/i,
      /\(\$[\d.,]+\s*\/\s*(fl\.?\s*oz|fluid\s*ounce|ounce|oz|count|each|lb|pound|kg|gram|item|piece)\)/i
    ];

    if (unitPricePatterns.some(pattern => pattern.test(priceText))) {
      return true;
    }

    if (element) {
      const parent = element.parentElement;
      const grandparent = parent?.parentElement;
      const contextTexts = [
        element.textContent || '',
        parent?.textContent || '',
        grandparent?.textContent || '',
        grandparent?.parentElement?.textContent || ''
      ];

      for (const context of contextTexts) {
        if (/per\s+(fl\.?\s*oz|fluid\s*ounce|ounce|oz|count|each|lb|pound|kg|gram|item|piece)/i.test(context)) {
          if (context.includes(priceText)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  static isUnitPriceContainer(priceContainer) {
    const containerText = priceContainer.textContent || '';
    const parentText = priceContainer.parentElement?.textContent || '';
    const unitPatterns = [
      /\$[\d.]+\s*\/\s*(fl\.?\s*oz|fluid\s*ounce|ounce|oz|count|each|lb|pound|kg|gram|item|piece)/i,
      /\(\$[\d.]+\s*\/\s*(fl\.?\s*oz|fluid\s*ounce|ounce|oz|count|each|lb|pound|kg|gram|item|piece)\)/i,
      /per\s+(fl\.?\s*oz|fluid\s*ounce|ounce|oz|count|each|lb|pound|kg|gram|item|piece)/i
    ];
    const textToCheck = containerText + ' ' + parentText;
    return unitPatterns.some(pattern => pattern.test(textToCheck));
  }

  static isPrimeEligible() {
    const primeSelectors = [
      '#priceBadging_feature_div [aria-label*="Prime"]',
      '.prime-logo',
      'i.a-icon-prime',
      '[data-testid*="prime"]',
      'span:contains("Prime")',
      '#deliveryMessageMirId [aria-label*="Prime"]',
      '#mir-layout-DELIVERY_BLOCK [aria-label*="Prime"]'
    ];

    for (const selector of primeSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent || element.getAttribute('aria-label') || '';
        if (text.match(/prime/i)) {
          return true;
        }
      }
    }

    const deliverySelectors = [
      '#deliveryMessageMirId',
      '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE'
    ];

    for (const selector of deliverySelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.match(/prime/i)) {
        return true;
      }
    }

    return false;
  }

  static checkPrimeEligibilityFromElement(element) {
    if (!element) return false;

    const primeSelectors = [
      'i.a-icon-prime',
      '.a-icon-prime',
      '[aria-label*="Prime"]',
      '.s-prime',
      'i[aria-label*="Prime"]',
      'span.a-icon-prime-logo'
    ];

    for (const selector of primeSelectors) {
      const primeElement = element.querySelector(selector);
      if (primeElement) {
        const text = primeElement.textContent || primeElement.getAttribute('aria-label') || '';
        if (text.match(/prime/i) || primeElement.className.includes('prime')) {
          return true;
        }
      }
    }

    const deliveryText = element.textContent || '';
    if (deliveryText.match(/FREE.*delivery/i) || deliveryText.match(/FREE.*shipping/i)) {
      if (!deliveryText.match(/FREE.*returns/i) || deliveryText.match(/Prime/i)) {
        return true;
      }
    }

    return false;
  }

  static getDeliveryFee() {
    const selectors = [
      '#deliveryMessageMirId span[data-csa-c-delivery-price]',
      '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE .a-color-success',
      '#mir-layout-DELIVERY_BLOCK-slot-SECONDARY_DELIVERY_MESSAGE_LARGE',
      '#ourprice_shippingmessage',
      '#price-shipping-message',
      '#price_shipping_message',
      '#delivery-message',
      '#ddmDeliveryMessage',
      '#fulfillerInfoFeature_feature_div .a-color-success',
      '#deliveryBlockMessage',
      '[data-feature-name="delivery"] .a-color-price',
      '#buybox-see-all-buying-choices span.a-color-secondary'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();
        if (text.match(/free\s+(delivery|shipping)/i)) {
          return 'FREE';
        }
        const priceMatch = text.match(/[\+]?\s*\$[\d.]+/);
        if (priceMatch) {
          return priceMatch[0].trim();
        }
      }
    }

    const primeElement = document.querySelector('#priceBadging_feature_div, .prime-logo, [aria-label*="Prime"]');
    if (primeElement) {
      const primeText = primeElement.textContent || primeElement.getAttribute('aria-label') || '';
      if (primeText.match(/prime/i)) {
        return 'FREE (Prime)';
      }
    }

    return null;
  }

  static getDeliveryDate() {
    const selectors = [
      '#deliveryMessageMirId',
      '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE',
      '#mir-layout-DELIVERY_BLOCK-slot-SECONDARY_DELIVERY_MESSAGE_LARGE',
      '#delivery-message',
      '#ddmDeliveryMessage'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();
        const dateMatch = text.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/i);
        if (dateMatch) {
          return dateMatch[0];
        }
      }
    }

    return null;
  }

  static getImages() {
    const images = [];
    const mainImage = document.querySelector('#landingImage, #imgBlkFront');
    if (mainImage) {
      const src = mainImage.getAttribute('data-old-hires') || mainImage.getAttribute('src');
      if (src) images.push(src);
    }

    const thumbnails = document.querySelectorAll('#altImages img, .imageThumbnail img');
    thumbnails.forEach(img => {
      const src = img.getAttribute('src');
      if (src && !images.includes(src)) {
        const highRes = src.replace(/\._.*_\./, '.');
        images.push(highRes);
      }
    });

    return images.slice(0, 10);
  }

  static getDescription() {
    const selectors = ['#productDescription p', '#feature-bullets', '.a-section.a-spacing-medium'];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element.textContent.trim();
    }
    return '';
  }

  static getBulletPoints() {
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

  static getSpecifications() {
    const specs = {};
    const specTables = document.querySelectorAll('#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr');
    specTables.forEach(row => {
      const th = row.querySelector('th');
      const td = row.querySelector('td');
      if (th && td) {
        specs[th.textContent.trim()] = td.textContent.trim();
      }
    });
    return specs;
  }

  // ===== Parsed Document Extraction =====

  static extractTitleFromDoc(doc) {
    const selectors = ['#productTitle', '#title', 'h1.a-size-large'];
    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) return element.textContent.trim();
    }
    return null;
  }

  static extractPriceFromDoc(doc) {
    const typicalPriceSelectors = [
      'span.a-price[data-a-color="secondary"] .a-offscreen',
      '.a-price.a-text-price .a-offscreen',
      'span:contains("Typical price") + .a-price .a-offscreen',
      'span:contains("List Price") + .a-price .a-offscreen',
      '.a-text-price .a-offscreen'
    ];

    for (const selector of typicalPriceSelectors) {
      const elements = doc.querySelectorAll(selector);
      for (const element of elements) {
        const priceText = element.textContent.trim();
        if (priceText.includes('$') && /\$\d+\.\d{2}/.test(priceText)) {
          if (!this.isUnitPriceText(priceText, element)) {
            return priceText;
          }
        }
      }
    }

    const textContent = doc.body.textContent;
    const typicalMatch = textContent.match(/Typical\s*price:\s*\$(\d+\.\d{2})/i);
    if (typicalMatch) return '$' + typicalMatch[1];

    const listMatch = textContent.match(/List\s*Price:\s*\$(\d+\.\d{2})/i);
    if (listMatch) return '$' + listMatch[1];

    const selectors = [
      '.a-price[data-a-size="xl"]',
      '.a-price[data-a-size="large"]',
      '.a-price'
    ];

    for (const selector of selectors) {
      const priceContainers = doc.querySelectorAll(selector);
      for (const container of priceContainers) {
        if (this.isUnitPriceContainerFromDoc(container)) continue;

        const offscreenPrice = container.querySelector('.a-offscreen');
        if (offscreenPrice && offscreenPrice.textContent.trim()) {
          const priceText = offscreenPrice.textContent.trim();
          if ((priceText.includes('$') || /\d/.test(priceText)) && !this.isUnitPriceText(priceText, offscreenPrice)) {
            return priceText;
          }
        }

        const wholePrice = container.querySelector('.a-price-whole');
        if (wholePrice && wholePrice.textContent.trim()) {
          const priceText = wholePrice.textContent.trim();
          if (/\d/.test(priceText) && !this.isUnitPriceText('$' + priceText, wholePrice)) {
            return '$' + priceText;
          }
        }
      }
    }

    const legacySelectors = ['#priceblock_ourprice', '#priceblock_dealprice', '#price_inside_buybox'];
    for (const selector of legacySelectors) {
      const element = doc.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  static isUnitPriceContainerFromDoc(priceContainer) {
    const containerText = priceContainer.textContent || '';
    const parentText = priceContainer.parentElement?.textContent || '';
    const unitPatterns = [
      /\$[\d.]+\s*\/\s*(fl\.?\s*oz|fluid\s*ounce|ounce|oz|count|each|lb|pound|kg|gram|item|piece)/i,
      /\(\$[\d.]+\s*\/\s*(fl\.?\s*oz|fluid\s*ounce|ounce|oz|count|each|lb|pound|kg|gram|item|piece)\)/i,
      /per\s+(fl\.?\s*oz|fluid\s*ounce|ounce|oz|count|each|lb|pound|kg|gram|item|piece)/i
    ];
    const textToCheck = containerText + ' ' + parentText;
    return unitPatterns.some(pattern => pattern.test(textToCheck));
  }

  static extractDeliveryFeeFromDoc(doc) {
    const selectors = [
      '#deliveryMessageMirId span[data-csa-c-delivery-price]',
      '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE .a-color-success',
      '#mir-layout-DELIVERY_BLOCK-slot-SECONDARY_DELIVERY_MESSAGE_LARGE',
      '#ourprice_shippingmessage',
      '#price-shipping-message',
      '#price_shipping_message',
      '#delivery-message',
      '#ddmDeliveryMessage',
      '#fulfillerInfoFeature_feature_div .a-color-success',
      '#deliveryBlockMessage',
      '[data-feature-name="delivery"] .a-color-price',
      '#buybox-see-all-buying-choices span.a-color-secondary'
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();
        if (text.match(/free\s+(delivery|shipping)/i)) {
          return 'FREE';
        }
        const priceMatch = text.match(/[\+]?\s*\$[\d.]+/);
        if (priceMatch) {
          return priceMatch[0].trim();
        }
      }
    }

    const primeElement = doc.querySelector('#priceBadging_feature_div, .prime-logo, [aria-label*="Prime"]');
    if (primeElement) {
      const primeText = primeElement.textContent || primeElement.getAttribute('aria-label') || '';
      if (primeText.match(/prime/i)) {
        return 'FREE (Prime)';
      }
    }

    return null;
  }

  static extractPrimeEligibilityFromDoc(doc) {
    const primeSelectors = [
      '#priceBadging_feature_div [aria-label*="Prime"]',
      '.prime-logo',
      'i.a-icon-prime',
      '[data-testid*="prime"]',
      '#deliveryMessageMirId [aria-label*="Prime"]',
      '#mir-layout-DELIVERY_BLOCK [aria-label*="Prime"]'
    ];

    for (const selector of primeSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const text = element.textContent || element.getAttribute('aria-label') || '';
        if (text.match(/prime/i)) {
          return true;
        }
      }
    }

    const deliverySelectors = [
      '#deliveryMessageMirId',
      '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE'
    ];

    for (const selector of deliverySelectors) {
      const element = doc.querySelector(selector);
      if (element && element.textContent.match(/prime/i)) {
        return true;
      }
    }

    return false;
  }

  static extractImagesFromDoc(doc) {
    const images = [];
    const mainImage = doc.querySelector('#landingImage, #imgBlkFront');
    if (mainImage) {
      const src = mainImage.getAttribute('data-old-hires') || mainImage.getAttribute('src');
      if (src) images.push(src);
    }

    const thumbnails = doc.querySelectorAll('#altImages img, .imageThumbnail img');
    thumbnails.forEach(img => {
      const src = img.getAttribute('src');
      if (src && !images.includes(src)) {
        const highRes = src.replace(/\._.*_\./, '.');
        images.push(highRes);
      }
    });

    return images.slice(0, 10);
  }

  static extractDescriptionFromDoc(doc) {
    const selectors = ['#productDescription p', '#feature-bullets', '.a-section.a-spacing-medium'];
    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) return element.textContent.trim();
    }
    return '';
  }

  static extractBulletPointsFromDoc(doc) {
    const bullets = [];
    const bulletElements = doc.querySelectorAll('#feature-bullets li, #featurebullets_feature_div li');
    bulletElements.forEach(li => {
      const text = li.textContent.trim();
      if (text && text.length > 0) {
        bullets.push(text);
      }
    });
    return bullets;
  }

  static extractSpecificationsFromDoc(doc) {
    const specs = {};
    const specTables = doc.querySelectorAll('#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr');
    specTables.forEach(row => {
      const th = row.querySelector('th');
      const td = row.querySelector('td');
      if (th && td) {
        specs[th.textContent.trim()] = td.textContent.trim();
      }
    });
    return specs;
  }

  static extractProductLinksFromPage() {
    const productLinks = [];
    const seenAsins = new Set();

    const selectors = [
      '[data-asin]:not([data-asin=""]) h2 a',
      '[data-asin]:not([data-asin=""]) .a-link-normal[href*="/dp/"]',
      '.zg-grid-general-faceout a[href*="/dp/"]',
      '.zg-item-immersion a[href*="/dp/"]',
      'a[href*="/dp/"]'
    ];

    selectors.forEach(selector => {
      const links = document.querySelectorAll(selector);
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;

        const asinMatch = href.match(/\/dp\/([A-Z0-9]{10})/);
        if (asinMatch && !seenAsins.has(asinMatch[1])) {
          seenAsins.add(asinMatch[1]);
          const listingElement = link.closest('[data-asin]') || link.closest('.s-result-item') || link.closest('.zg-grid-general-faceout');

          productLinks.push({
            asin: asinMatch[1],
            url: href.startsWith('http') ? href : `https://www.amazon.com${href}`,
            element: listingElement
          });
        }
      });
    });

    return productLinks;
  }
}



// ========================================
// PRODUCTSCRAPER MODULE
// ========================================

/**
 * Product Scraper
 * Handles scraping individual Amazon product pages
 */





class ProductScraper {
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



// ========================================
// BULKSCRAPER MODULE
// ========================================

/**
 * Bulk Scraper
 * Handles bulk scraping from Amazon category/listing pages
 */






class BulkScraper {
  constructor() {
    this.scrapeButton = null;
    this.primeOnlyMode = false;
  }

  async init() {
    this.primeOnlyMode = await StorageManager.getPrimeOnlyMode();
    this.injectBulkScrapeButton();
  }

  injectBulkScrapeButton() {
    const itemCount = DOMHelpers.getVisibleProductCount();
    this.scrapeButton = document.createElement('button');
    this.scrapeButton.id = 'amazon-scraper-btn';
    this.scrapeButton.innerHTML = `📦 Scrape ${itemCount} Items`;
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

    this.scrapeButton.addEventListener('click', () => this.showBulkScrapeSettings());
    document.body.appendChild(this.scrapeButton);
  }

  showBulkScrapeSettings() {
    const allProducts = DataExtractor.extractProductLinksFromPage();

    if (allProducts.length === 0) {
      UIManager.showNotification('❌ No products found on this page', 'error');
      return;
    }

    const settingsModal = this.createSettingsModal(allProducts);
    document.body.appendChild(settingsModal);
  }

  createSettingsModal(allProducts) {
    const productsWithMetadata = allProducts.map(p => {
      const priceText = p.element?.querySelector('.a-price .a-offscreen, .a-price-whole, ._cDEzb_p13n-sc-price_3mJ9Z')?.textContent?.trim();
      const price = DOMHelpers.parsePrice(priceText);
      const isPrime = DataExtractor.checkPrimeEligibilityFromElement(p.element);
      return { ...p, price, priceText, isPrime };
    });

    const productsWithPrices = productsWithMetadata.filter(p => p.price > 0);
    const primeProducts = productsWithMetadata.filter(p => p.isPrime);
    const prices = productsWithPrices.map(p => p.price);
    const minPrice = prices.length > 0 ? Math.floor(Math.min(...prices)) : 0;
    const maxPrice = prices.length > 0 ? Math.ceil(Math.max(...prices)) : 100;

    const modal = document.createElement('div');
    modal.id = 'scraper-settings-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10003;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    modal.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 30px; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <h2 style="margin: 0 0 20px 0; color: #333; font-size: 24px;">📦 Bulk Scrape Settings</h2>

        <div style="margin-bottom: 25px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="color: #666; font-size: 14px;">Products Found:</span>
            <span style="color: #667eea; font-weight: 600; font-size: 16px;">${allProducts.length}</span>
          </div>

          <div style="margin: 20px 0;">
            <label style="display: block; color: #666; font-size: 14px; margin-bottom: 10px;">
              Number to Scrape: <span id="count-value" style="color: #667eea; font-weight: 600;">${allProducts.length}</span>
            </label>
            <input type="range" id="scrape-count-slider" min="1" max="${allProducts.length}" value="${allProducts.length}"
              style="width: 100%; height: 6px; border-radius: 3px; background: #e0e0e0; outline: none; -webkit-appearance: none;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #999; margin-top: 5px;">
              <span>1</span>
              <span>${allProducts.length}</span>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 25px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
          <label style="display: flex; align-items: center; margin-bottom: 15px; cursor: pointer;">
            <input type="checkbox" id="enable-price-filter" style="margin-right: 10px; width: 18px; height: 18px; cursor: pointer;">
            <span style="color: #333; font-weight: 500;">Enable Price Filter</span>
          </label>

          <div id="price-filter-controls" style="opacity: 0.5; pointer-events: none; transition: opacity 0.3s;">
            <div style="margin-bottom: 15px;">
              <label style="display: block; color: #666; font-size: 13px; margin-bottom: 8px;">
                Min Price: $<span id="min-price-value">${minPrice}</span>
              </label>
              <input type="range" id="min-price-slider" min="${minPrice}" max="${maxPrice}" value="${minPrice}"
                style="width: 100%; height: 6px; border-radius: 3px; background: #e0e0e0; outline: none; -webkit-appearance: none;">
            </div>

            <div style="margin-bottom: 15px;">
              <label style="display: block; color: #666; font-size: 13px; margin-bottom: 8px;">
                Max Price: $<span id="max-price-value">${maxPrice}</span>
              </label>
              <input type="range" id="max-price-slider" min="${minPrice}" max="${maxPrice}" value="${maxPrice}"
                style="width: 100%; height: 6px; border-radius: 3px; background: #e0e0e0; outline: none; -webkit-appearance: none;">
            </div>

            <div style="font-size: 13px; color: #666; padding: 10px; background: white; border-radius: 6px;">
              <span id="filtered-count">${allProducts.length}</span> products match filters
            </div>
          </div>
        </div>

        <div style="margin-bottom: 25px; padding: 20px; background: #e8f4fd; border-radius: 8px; border: 2px solid #3b82f6;">
          <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="checkbox" id="prime-only-filter" style="margin-right: 10px; width: 18px; height: 18px; cursor: pointer;">
            <span style="color: #1e40af; font-weight: 600; display: flex; align-items: center;">
              <span style="font-size: 18px; margin-right: 5px;">📦</span>
              Prime Only (Skip non-Prime items)
            </span>
          </label>
          <p style="margin: 10px 0 0 28px; font-size: 12px; color: #666;">
            Only scrape products eligible for Amazon Prime shipping
          </p>
          <div id="prime-filter-info" style="margin: 10px 0 0 28px; font-size: 13px; color: #1e40af; padding: 10px; background: white; border-radius: 6px; display: none;">
            <span id="prime-count">${primeProducts.length}</span> Prime products found
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 25px;">
          <button id="start-scrape-btn" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 15px;">
            Start Scraping
          </button>
          <button id="cancel-scrape-btn" style="flex: 1; padding: 12px; background: #e0e0e0; color: #666; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 15px;">
            Cancel
          </button>
        </div>
      </div>
    `;

    this.attachModalEventListeners(modal, allProducts, productsWithMetadata);
    return modal;
  }

  attachModalEventListeners(modal, allProducts, productsWithMetadata) {
    const countSlider = modal.querySelector('#scrape-count-slider');
    const countValue = modal.querySelector('#count-value');
    const enablePriceFilter = modal.querySelector('#enable-price-filter');
    const priceFilterControls = modal.querySelector('#price-filter-controls');
    const minPriceSlider = modal.querySelector('#min-price-slider');
    const maxPriceSlider = modal.querySelector('#max-price-slider');
    const minPriceValue = modal.querySelector('#min-price-value');
    const maxPriceValue = modal.querySelector('#max-price-value');
    const filteredCount = modal.querySelector('#filtered-count');
    const primeOnlyFilter = modal.querySelector('#prime-only-filter');
    const primeFilterInfo = modal.querySelector('#prime-filter-info');
    const startBtn = modal.querySelector('#start-scrape-btn');
    const cancelBtn = modal.querySelector('#cancel-scrape-btn');

    countSlider.addEventListener('input', (e) => {
      countValue.textContent = e.target.value;
    });

    const updateFilteredCount = () => {
      const minPrice = parseInt(minPriceSlider.value);
      const maxPrice = parseInt(maxPriceSlider.value);
      const primeOnly = primeOnlyFilter.checked;

      let filtered = productsWithMetadata;

      if (enablePriceFilter.checked) {
        filtered = filtered.filter(p => p.price >= minPrice && p.price <= maxPrice);
      }

      if (primeOnly) {
        filtered = filtered.filter(p => p.isPrime);
      }

      filteredCount.textContent = filtered.length;
    };

    enablePriceFilter.addEventListener('change', (e) => {
      if (e.target.checked) {
        priceFilterControls.style.opacity = '1';
        priceFilterControls.style.pointerEvents = 'auto';
      } else {
        priceFilterControls.style.opacity = '0.5';
        priceFilterControls.style.pointerEvents = 'none';
      }
      updateFilteredCount();
    });

    minPriceSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      minPriceValue.textContent = value;
      if (value > parseInt(maxPriceSlider.value)) {
        maxPriceSlider.value = value;
        maxPriceValue.textContent = value;
      }
      updateFilteredCount();
    });

    maxPriceSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      maxPriceValue.textContent = value;
      if (value < parseInt(minPriceSlider.value)) {
        minPriceSlider.value = value;
        minPriceValue.textContent = value;
      }
      updateFilteredCount();
    });

    primeOnlyFilter.addEventListener('change', (e) => {
      primeFilterInfo.style.display = e.target.checked ? 'block' : 'none';
      updateFilteredCount();
    });

    startBtn.addEventListener('click', () => {
      const count = parseInt(countSlider.value);
      const usePriceFilter = enablePriceFilter.checked;
      const minPrice = parseInt(minPriceSlider.value);
      const maxPrice = parseInt(maxPriceSlider.value);
      const primeOnly = primeOnlyFilter.checked;

      modal.remove();
      this.bulkScrapeFromPage(allProducts, count, usePriceFilter, minPrice, maxPrice, primeOnly);
    });

    cancelBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  async bulkScrapeFromPage(allProducts, maxCount, usePriceFilter, minPrice, maxPrice, primeOnly = false) {
    try {
      this.scrapeButton.innerHTML = '⏳ Filtering...';
      this.scrapeButton.disabled = true;
      this.primeOnlyMode = primeOnly;

      let productLinks = allProducts;

      if (usePriceFilter) {
        productLinks = productLinks.filter(p => {
          const priceElement = p.element?.querySelector('.a-price .a-offscreen, .a-price-whole, ._cDEzb_p13n-sc-price_3mJ9Z');
          const priceText = priceElement?.textContent?.trim();
          const price = DOMHelpers.parsePrice(priceText);
          return price >= minPrice && price <= maxPrice;
        });
      }

      productLinks = productLinks.slice(0, maxCount);

      if (productLinks.length === 0) {
        throw new Error('No products found matching the filter criteria');
      }

      const progressUI = UIManager.createProgressIndicator(productLinks.length);
      document.body.appendChild(progressUI);

      let stopRequested = false;
      const stopBtn = progressUI.querySelector('#stop-scraping-btn');
      stopBtn.addEventListener('click', () => {
        stopRequested = true;
        stopBtn.textContent = '⏹ Stopping...';
        stopBtn.disabled = true;
        stopBtn.style.background = '#9ca3af';
      });

      let successCount = 0;
      let failCount = 0;
      let skippedCount = 0;
      let processedCount = 0;

      const BATCH_SIZE = 3;

      for (let batchStart = 0; batchStart < productLinks.length; batchStart += BATCH_SIZE) {
        if (stopRequested) {
          console.log('Scraping stopped by user');
          break;
        }

        const batchEnd = Math.min(batchStart + BATCH_SIZE, productLinks.length);
        const batch = productLinks.slice(batchStart, batchEnd);

        const batchPromises = batch.map(link => this.scrapeProductFromLink(link));
        const batchResults = await Promise.allSettled(batchPromises);

        for (let i = 0; i < batchResults.length; i++) {
          processedCount++;
          UIManager.updateProgressIndicator(progressUI, processedCount, productLinks.length, successCount, failCount, skippedCount);

          const result = batchResults[i];

          if (result.status === 'fulfilled' && result.value && result.value.title) {
            const productData = result.value;
            const validation = Validators.validateProductFromDoc(productData, this.primeOnlyMode);

            if (validation.isValid) {
              const sanitizedData = DataSanitizer.sanitizeProductData(productData);

              try {
                await StorageManager.saveProduct(sanitizedData);
                successCount++;
              } catch (error) {
                console.warn('chrome.storage failed, using localStorage:', error);
                StorageManager.saveToLocalStorage(sanitizedData);
                successCount++;
              }
            } else {
              skippedCount++;
              console.log(`Skipped product ${productData.asin}:`, validation.errors.join(', '));
            }
          } else {
            failCount++;
            if (result.status === 'rejected') {
              console.error('Error scraping product:', result.reason);
            }
          }
        }

        if (batchEnd < productLinks.length && !stopRequested) {
          await DOMHelpers.sleep(100);
        }
      }

      progressUI.remove();

      const resultParts = [];
      if (stopRequested) {
        resultParts.push(`⏸ Stopped: ${successCount} products scraped`);
      } else {
        resultParts.push(`✅ Scraped ${successCount} products successfully!`);
      }

      if (skippedCount > 0) {
        resultParts.push(`${skippedCount} skipped (no price/unavailable/non-Prime)`);
      }
      if (failCount > 0) {
        resultParts.push(`${failCount} failed`);
      }

      UIManager.showNotification(resultParts.join(' | '), stopRequested ? 'warning' : 'success');
      this.scrapeButton.innerHTML = `✅ Scraped ${successCount}!`;

      setTimeout(() => {
        const newCount = DOMHelpers.getVisibleProductCount();
        this.scrapeButton.innerHTML = `📦 Scrape ${newCount} Items`;
        this.scrapeButton.disabled = false;
      }, 3000);

    } catch (error) {
      console.error('Bulk scraping error:', error);
      UIManager.showNotification('❌ Error: ' + error.message, 'error');
      const count = DOMHelpers.getVisibleProductCount();
      this.scrapeButton.innerHTML = `📦 Scrape ${count} Items`;
      this.scrapeButton.disabled = false;
    }
  }

  async scrapeProductFromLink(linkData) {
    const { asin, url } = linkData;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const productData = {
        asin: asin,
        url: url,
        scrapedAt: new Date().toISOString(),
        title: DataExtractor.extractTitleFromDoc(doc),
        price: DataExtractor.extractPriceFromDoc(doc),
        deliveryFee: DataExtractor.extractDeliveryFeeFromDoc(doc),
        isPrime: DataExtractor.extractPrimeEligibilityFromDoc(doc),
        images: DataExtractor.extractImagesFromDoc(doc),
        description: DataExtractor.extractDescriptionFromDoc(doc),
        bulletPoints: DataExtractor.extractBulletPointsFromDoc(doc),
        specifications: DataExtractor.extractSpecificationsFromDoc(doc)
      };

      return productData;

    } catch (error) {
      console.error(`Error fetching product ${asin}:`, error);
      return {
        asin: asin,
        url: url,
        scrapedAt: new Date().toISOString(),
        title: `Product ${asin}`,
        price: null,
        deliveryFee: null,
        isPrime: false,
        images: [],
        description: `Error loading details: ${error.message}`,
        bulletPoints: [],
        specifications: {}
      };
    }
  }
}



// ========================================
// ADDRESSIMPORTER MODULE
// ========================================

/**
 * Address Importer
 * Handles importing eBay order addresses into Amazon
 */


class AddressImporter {
  constructor() {
    this.importButton = null;
  }

  init() {
    if (DOMHelpers.isAddressPage()) {
      if (DOMHelpers.isAddAddressPage()) {
        this.checkAndFillAddress();
      } else if (DOMHelpers.isAddressSuccessPage()) {
        this.continueImportAfterSuccess();
      } else {
        this.injectAddressImportButton();
      }
    }
  }

  injectAddressImportButton() {
    if (document.getElementById('ebay-address-import-btn')) return;

    this.importButton = document.createElement('button');
    this.importButton.id = 'ebay-address-import-btn';
    this.importButton.innerHTML = '📦 Import eBay Addresses';
    this.importButton.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 10000;
      padding: 12px 20px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;
    `;

    this.importButton.addEventListener('mouseenter', () => {
      this.importButton.style.transform = 'scale(1.05)';
      this.importButton.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
    });

    this.importButton.addEventListener('mouseleave', () => {
      this.importButton.style.transform = 'scale(1)';
      this.importButton.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
    });

    this.importButton.addEventListener('click', () => this.showAddressImportModal());
    document.body.appendChild(this.importButton);
  }

  showAddressImportModal() {
    const modal = document.createElement('div');
    modal.id = 'address-import-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10003;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    modal.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 30px; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <h2 style="margin: 0 0 20px 0; color: #333; font-size: 24px;">📦 Import eBay Order Addresses</h2>

        <div style="margin-bottom: 20px; padding: 15px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 1.5;">
            Upload your eBay orders JSON file from the <code style="background: white; padding: 2px 6px; border-radius: 3px;">ebay_orders</code> folder.
            This will automatically add shipping addresses to your Amazon account.
          </p>
        </div>

        <div style="margin-bottom: 25px;">
          <label style="display: block; margin-bottom: 10px; font-weight: 600; color: #333;">
            Select eBay Orders JSON File:
          </label>
          <input type="file" id="ebay-orders-file-input" accept=".json,application/json"
            style="width: 100%; padding: 10px; border: 2px dashed #d1d5db; border-radius: 8px; cursor: pointer; font-size: 13px;">
        </div>

        <div id="address-preview" style="display: none; margin-bottom: 20px; max-height: 200px; overflow-y: auto; background: #f9fafb; padding: 15px; border-radius: 8px;">
          <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Addresses to Import:</h3>
          <div id="address-list" style="font-size: 12px; color: #333;"></div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 25px;">
          <button id="start-import-btn" disabled style="flex: 1; padding: 12px; background: #d1d5db; color: #6b7280; border: none; border-radius: 8px; font-weight: 600; cursor: not-allowed; font-size: 15px;">
            Start Import
          </button>
          <button id="cancel-import-btn" style="flex: 1; padding: 12px; background: #e0e0e0; color: #666; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 15px;">
            Cancel
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const fileInput = modal.querySelector('#ebay-orders-file-input');
    const startBtn = modal.querySelector('#start-import-btn');
    const cancelBtn = modal.querySelector('#cancel-import-btn');
    const addressPreview = modal.querySelector('#address-preview');
    const addressList = modal.querySelector('#address-list');

    let ordersData = null;

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        ordersData = JSON.parse(text);

        const addresses = this.extractAddressesFromOrders(ordersData);

        if (addresses.length === 0) {
          alert('No addresses found in the file.');
          return;
        }

        addressPreview.style.display = 'block';
        addressList.innerHTML = addresses.map((addr, i) => `
          <div style="padding: 8px; margin-bottom: 5px; background: white; border-radius: 4px;">
            ${i + 1}. ${addr.name} - ${addr.city}, ${addr.stateOrProvince} ${addr.postalCode}
          </div>
        `).join('');

        startBtn.disabled = false;
        startBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        startBtn.style.color = 'white';
        startBtn.style.cursor = 'pointer';

      } catch (error) {
        alert('Error reading file: ' + error.message);
        console.error('File read error:', error);
      }
    });

    startBtn.addEventListener('click', () => {
      if (!ordersData) return;
      modal.remove();
      this.startAddressImport(ordersData);
    });

    cancelBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  extractAddressesFromOrders(ordersData) {
    const addresses = [];
    const seen = new Set();

    if (!ordersData.orders || !Array.isArray(ordersData.orders)) {
      return addresses;
    }

    ordersData.orders.forEach(order => {
      if (order.shippingAddress) {
        const addr = order.shippingAddress;
        const key = `${addr.name}|${addr.addressLine1}|${addr.city}|${addr.postalCode}`;

        if (!seen.has(key)) {
          seen.add(key);
          addresses.push(addr);
        }
      }
    });

    return addresses;
  }

  async startAddressImport(ordersData) {
    const addresses = this.extractAddressesFromOrders(ordersData);

    if (addresses.length === 0) {
      UIManager.showNotification('No addresses to import', 'error');
      return;
    }

    sessionStorage.setItem('ebayAddressesToImport', JSON.stringify(addresses));
    sessionStorage.setItem('currentAddressIndex', '0');

    UIManager.showNotification(`Starting import of ${addresses.length} addresses...`, 'info');

    setTimeout(() => {
      window.location.href = 'https://www.amazon.com/a/addresses/add?ref=ebay_import';
    }, 1000);
  }

  continueImportAfterSuccess() {
    const addressesJSON = sessionStorage.getItem('ebayAddressesToImport');
    const currentIndex = parseInt(sessionStorage.getItem('currentAddressIndex') || '0');

    if (!addressesJSON) return;

    const addresses = JSON.parse(addressesJSON);

    if (currentIndex >= addresses.length) {
      sessionStorage.removeItem('ebayAddressesToImport');
      sessionStorage.removeItem('currentAddressIndex');
      UIManager.showNotification('✅ All addresses imported successfully!', 'success');
      return;
    }

    UIManager.showNotification(`Address saved! Loading next address...`, 'success');
    setTimeout(() => {
      window.location.href = 'https://www.amazon.com/a/addresses/add?ref=ebay_import';
    }, 1000);
  }

  checkAndFillAddress() {
    const addressesJSON = sessionStorage.getItem('ebayAddressesToImport');
    const currentIndex = parseInt(sessionStorage.getItem('currentAddressIndex') || '0');

    if (!addressesJSON) return;

    const addresses = JSON.parse(addressesJSON);

    if (currentIndex >= addresses.length) {
      sessionStorage.removeItem('ebayAddressesToImport');
      sessionStorage.removeItem('currentAddressIndex');
      UIManager.showNotification('✅ All addresses imported successfully!', 'success');

      setTimeout(() => {
        window.location.href = 'https://www.amazon.com/a/addresses';
      }, 2000);
      return;
    }

    const address = addresses[currentIndex];
    setTimeout(() => {
      this.fillAddressForm(address, currentIndex + 1, addresses.length);
    }, 1000);
  }

  fillAddressForm(address, current, total) {
    try {
      const fieldMappings = {
        fullName: ['address-ui-widgets-enterAddressFullName', 'address-ui-widgets-enterAddressFormContainer-fullName'],
        phoneNumber: ['address-ui-widgets-enterAddressPhoneNumber', 'address-ui-widgets-enterAddressFormContainer-phoneNumber'],
        addressLine1: ['address-ui-widgets-enterAddressLine1', 'address-ui-widgets-enterAddressFormContainer-addressLine1'],
        addressLine2: ['address-ui-widgets-enterAddressLine2', 'address-ui-widgets-enterAddressFormContainer-addressLine2'],
        city: ['address-ui-widgets-enterAddressCity', 'address-ui-widgets-enterAddressFormContainer-city'],
        state: ['address-ui-widgets-enterAddressStateOrRegion', 'address-ui-widgets-enterAddressFormContainer-stateOrRegion'],
        postalCode: ['address-ui-widgets-enterAddressPostalCode', 'address-ui-widgets-enterAddressFormContainer-postalCode']
      };

      const setValue = (fieldIds, value) => {
        for (const id of fieldIds) {
          const field = document.getElementById(id);
          if (field) {
            field.value = value;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;
      };

      const formattedPhone = DOMHelpers.formatPhoneNumber(address.phoneNumber || '');

      setValue(fieldMappings.fullName, address.name || '');
      setValue(fieldMappings.phoneNumber, formattedPhone);
      setValue(fieldMappings.addressLine1, address.addressLine1 || '');
      setValue(fieldMappings.addressLine2, address.addressLine2 || '');
      setValue(fieldMappings.city, address.city || '');
      setValue(fieldMappings.postalCode, address.postalCode || '');

      const countrySelect = document.getElementById('address-ui-widgets-enterAddressFormContainer-country-dropdown-nativeId');
      if (countrySelect && address.countryCode) {
        countrySelect.value = address.countryCode;
        countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      setTimeout(() => {
        this.setStateDropdown(address.stateOrProvince);
      }, 300);

      UIManager.showNotification(`Importing address ${current} of ${total}...`, 'info');

      setTimeout(() => {
        this.submitAddressAndNext();
      }, 1500);

    } catch (error) {
      console.error('Error filling form:', error);
      UIManager.showNotification('Error filling form. Please check the fields.', 'error');
    }
  }

  setStateDropdown(stateValue) {
    if (!stateValue) return;

    const stateSelectors = [
      '#address-ui-widgets-enterAddressStateOrRegion-dropdown-nativeId',
      'select[name="address-ui-widgets-enterAddressStateOrRegion"]',
      '[aria-labelledby*="State"] select',
      'select.a-native-dropdown'
    ];

    for (const selector of stateSelectors) {
      const dropdown = document.querySelector(selector);
      if (dropdown) {
        const options = Array.from(dropdown.options);
        const matchingOption = options.find(opt =>
          opt.value === stateValue ||
          opt.text === stateValue ||
          opt.value.toLowerCase() === stateValue.toLowerCase() ||
          opt.text.toLowerCase() === stateValue.toLowerCase()
        );

        if (matchingOption) {
          dropdown.value = matchingOption.value;
          dropdown.dispatchEvent(new Event('change', { bubbles: true }));
          dropdown.dispatchEvent(new Event('input', { bubbles: true }));

          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
          nativeInputValueSetter.call(dropdown, matchingOption.value);
          dropdown.dispatchEvent(new Event('change', { bubbles: true }));

          console.log('State set to:', matchingOption.value);
          return true;
        }
      }
    }

    console.warn('Could not set state dropdown for:', stateValue);
    return false;
  }

  submitAddressAndNext() {
    const submitSelectors = [
      '#address-ui-widgets-form-submit-button',
      'input[name="address-ui-widgets-form-submit-button"]',
      '#address-ui-widgets-form-submit-button-announce',
      'span.a-button-inner input[aria-labelledby*="submit"]',
      'span.a-button-inner input[type="submit"]',
      'button[type="submit"]',
      'input[type="submit"]',
      '.a-button-primary input',
      '.a-button-primary span input',
      'span.a-button-text'
    ];

    let submitBtn = null;
    let foundSelector = null;

    for (const selector of submitSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        if (element.tagName === 'SPAN') {
          const text = element.textContent.trim().toLowerCase();
          if (text.includes('add address') || text.includes('submit')) {
            const input = element.closest('.a-button-primary')?.querySelector('input[type="submit"]');
            if (input) {
              submitBtn = input;
              foundSelector = selector + ' -> input';
              break;
            }
          }
        } else {
          submitBtn = element;
          foundSelector = selector;
          break;
        }
      }
    }

    if (submitBtn) {
      console.log('Found submit button with selector:', foundSelector);

      const currentIndex = parseInt(sessionStorage.getItem('currentAddressIndex') || '0');
      sessionStorage.setItem('currentAddressIndex', (currentIndex + 1).toString());

      UIManager.showNotification('Submitting address...', 'info');

      submitBtn.click();
      submitBtn.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      }));

      return;
    }

    console.warn('Could not find submit button. Available buttons:');
    document.querySelectorAll('button, input[type="submit"]').forEach(btn => {
      console.log('Button found:', {
        tag: btn.tagName,
        type: btn.type,
        id: btn.id,
        name: btn.name,
        className: btn.className,
        text: btn.textContent?.substring(0, 50)
      });
    });

    UIManager.showNotification('Could not find submit button. Please submit manually and click "Skip".', 'warning');
  }
}



// ========================================
// MAIN APPLICATION
// ========================================

class AmazonScraperApp {
  constructor() {
    this.productScraper = null;
    this.bulkScraper = null;
    this.addressImporter = null;
    this.init();
  }

  async init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initializeFeatures());
    } else {
      this.initializeFeatures();
    }

    UIManager.injectStyles();
  }

  async initializeFeatures() {
    if (DOMHelpers.isProductPage()) {
      this.productScraper = new ProductScraper();
      await this.productScraper.init();
    }
    else if (DOMHelpers.isCategoryPage()) {
      this.bulkScraper = new BulkScraper();
      await this.bulkScraper.init();
    }

    if (DOMHelpers.isAddressPage()) {
      this.addressImporter = new AddressImporter();
      this.addressImporter.init();
    }
  }
}

// Initialize the application
new AmazonScraperApp();
