/**
 * Data Extractor
 * Extracts product information from Amazon product pages (live DOM and parsed HTML documents)
 */
import { DOMHelpers } from '../utils/DOMHelpers.js';

export class DataExtractor {
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
    // CRITICAL: Only look for prices within the core price display container
    // This prevents picking up incorrect prices from other parts of the page
    // Use querySelector to get the FIRST occurrence (in case of duplicates)
    const corePriceDisplay = document.querySelector('#corePriceDisplay_desktop_feature_div');

    if (corePriceDisplay) {
      // Strategy 0: Look for .aok-offscreen (Amazon's accessibility class for screen readers)
      const aokOffscreen = corePriceDisplay.querySelector('.aok-offscreen');
      if (aokOffscreen) {
        const priceText = aokOffscreen.textContent.trim();
        // Validate it's a proper price format
        if (priceText && /^\$\d+(\,\d{3})*\.\d{2}$/.test(priceText)) {
          return priceText;
        }
      }

      // Strategy 1: Look for .priceToPay with .a-price-whole (most reliable for current price)
      const priceToPayWhole = corePriceDisplay.querySelector('.priceToPay .a-price-whole');
      if (priceToPayWhole) {
        const wholePart = priceToPayWhole.textContent.replace(/[^0-9]/g, '');
        const fractionPart = corePriceDisplay.querySelector('.priceToPay .a-price-fraction');
        if (wholePart) {
          const fraction = fractionPart ? fractionPart.textContent.trim() : '00';
          return `$${wholePart}.${fraction}`;
        }
      }

      // Strategy 2: Look for .priceToPay .a-offscreen (current/deal price) within core display
      const priceToPay = corePriceDisplay.querySelector('.priceToPay .a-offscreen');
      if (priceToPay && priceToPay.textContent.trim()) {
        const priceText = priceToPay.textContent.trim();
        if (priceText && /^\$\d+(\,\d{3})*\.\d{2}$/.test(priceText)) {
          return priceText;
        }
      }

      // Strategy 3: Look for .basisPrice (typical/list price) within core display
      const basisPrice = corePriceDisplay.querySelector('.basisPrice .a-offscreen');
      if (basisPrice && basisPrice.textContent.trim()) {
        const priceText = basisPrice.textContent.trim();
        if (priceText && /^\$\d+(\,\d{3})*\.\d{2}$/.test(priceText)) {
          return priceText;
        }
      }

      // Strategy 4: Look for any .a-offscreen within core display that has a valid price
      const offscreenPrices = corePriceDisplay.querySelectorAll('.a-offscreen');
      for (const offscreen of offscreenPrices) {
        const priceText = offscreen.textContent.trim();
        // Match valid price format like $10.49 or $1,234.56
        if (priceText && /^\$\d+(\,\d{3})*\.\d{2}$/.test(priceText)) {
          return priceText;
        }
      }

      // Strategy 5: Build price from .a-price-whole and .a-price-fraction within core display
      const priceWhole = corePriceDisplay.querySelector('.a-price-whole');
      if (priceWhole) {
        const wholePart = priceWhole.textContent.replace(/[^0-9]/g, '');
        const fractionElement = priceWhole.parentElement?.querySelector('.a-price-fraction');
        if (wholePart) {
          const fraction = fractionElement ? fractionElement.textContent.trim() : '00';
          return `$${wholePart}.${fraction}`;
        }
      }
    }

    // Fallback: Legacy selectors (only if core price display not found)
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
    // Check within a-box-inner containers near pricing first
    const boxInnerElements = document.querySelectorAll('.a-box-inner');
    for (const box of boxInnerElements) {
      const boxText = box.textContent || '';
      if (boxText.match(/prime/i)) {
        // Verify it's near price information
        const hasPriceInfo = boxText.match(/\$[\d,]+\.?\d*/);
        if (hasPriceInfo) {
          return true;
        }
      }
    }

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
    // CRITICAL: Only look for prices within the core price display container
    // This prevents picking up incorrect prices from other parts of the page
    // Use querySelector to get the FIRST occurrence (in case of duplicates)
    const corePriceDisplay = doc.querySelector('#corePriceDisplay_desktop_feature_div');

    if (corePriceDisplay) {
      // Strategy 0: Look for .aok-offscreen (Amazon's accessibility class for screen readers)
      const aokOffscreen = corePriceDisplay.querySelector('.aok-offscreen');
      if (aokOffscreen) {
        const priceText = aokOffscreen.textContent.trim();
        // Validate it's a proper price format
        if (priceText && /^\$\d+(\,\d{3})*\.\d{2}$/.test(priceText)) {
          return priceText;
        }
      }

      // Strategy 1: Look for .priceToPay with .a-price-whole (most reliable for current price)
      const priceToPayWhole = corePriceDisplay.querySelector('.priceToPay .a-price-whole');
      if (priceToPayWhole) {
        const wholePart = priceToPayWhole.textContent.replace(/[^0-9]/g, '');
        const fractionPart = corePriceDisplay.querySelector('.priceToPay .a-price-fraction');
        if (wholePart) {
          const fraction = fractionPart ? fractionPart.textContent.trim() : '00';
          return `$${wholePart}.${fraction}`;
        }
      }

      // Strategy 2: Look for .priceToPay .a-offscreen (current/deal price) within core display
      const priceToPay = corePriceDisplay.querySelector('.priceToPay .a-offscreen');
      if (priceToPay && priceToPay.textContent.trim()) {
        const priceText = priceToPay.textContent.trim();
        if (priceText && /^\$\d+(\,\d{3})*\.\d{2}$/.test(priceText)) {
          return priceText;
        }
      }

      // Strategy 3: Look for .basisPrice (typical/list price) within core display
      const basisPrice = corePriceDisplay.querySelector('.basisPrice .a-offscreen');
      if (basisPrice && basisPrice.textContent.trim()) {
        const priceText = basisPrice.textContent.trim();
        if (priceText && /^\$\d+(\,\d{3})*\.\d{2}$/.test(priceText)) {
          return priceText;
        }
      }

      // Strategy 4: Look for any .a-offscreen within core display that has a valid price
      const offscreenPrices = corePriceDisplay.querySelectorAll('.a-offscreen');
      for (const offscreen of offscreenPrices) {
        const priceText = offscreen.textContent.trim();
        // Match valid price format like $10.49 or $1,234.56
        if (priceText && /^\$\d+(\,\d{3})*\.\d{2}$/.test(priceText)) {
          return priceText;
        }
      }

      // Strategy 5: Build price from .a-price-whole and .a-price-fraction within core display
      const priceWhole = corePriceDisplay.querySelector('.a-price-whole');
      if (priceWhole) {
        const wholePart = priceWhole.textContent.replace(/[^0-9]/g, '');
        const fractionElement = priceWhole.parentElement?.querySelector('.a-price-fraction');
        if (wholePart) {
          const fraction = fractionElement ? fractionElement.textContent.trim() : '00';
          return `$${wholePart}.${fraction}`;
        }
      }
    }

    // Fallback: Legacy selectors (only if core price display not found)
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
    // Check within a-box-inner containers near pricing first
    const boxInnerElements = doc.querySelectorAll('.a-box-inner');
    for (const box of boxInnerElements) {
      const boxText = box.textContent || '';
      if (boxText.match(/prime/i)) {
        // Verify it's near price information
        const hasPriceInfo = boxText.match(/\$[\d,]+\.?\d*/);
        if (hasPriceInfo) {
          return true;
        }
      }
    }

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
