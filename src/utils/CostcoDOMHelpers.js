/**
 * CostcoDOMHelpers - DOM utility functions for Costco.com scraping
 * Follows the same pattern as YamiDOMHelpers.js and DOMHelpers.js
 */

class CostcoDOMHelpers {
  /**
   * Check if the current page is a Costco category/listing page
   * Examples:
   * - https://www.costco.com/premium-cleansers.html
   * - https://www.costco.com/serums-skin-treatments.html
   * - https://www.costco.com/CatalogSearch?keyword=...
   * @returns {boolean}
   */
  static isCategoryPage() {
    const url = window.location.href;
    const pathname = window.location.pathname;

    return url.includes('costco.com') && (
      // Category pages ending in .html (but not product pages)
      (pathname.endsWith('.html') && !pathname.includes('/p/')) ||
      // Search results
      pathname.includes('/CatalogSearch') ||
      url.includes('keyword=') ||
      // Department/category paths
      pathname.includes('/c/') ||
      pathname.includes('/category/') ||
      // Deals and special pages
      pathname.includes('/deals') ||
      pathname.includes('/warehouse-savings') ||
      pathname.includes('/new-arrivals') ||
      pathname.includes('/best-sellers')
    );
  }

  /**
   * Check if the current page is a Costco product page
   * Examples:
   * - https://www.costco.com/p/-/skin1004-madagascar-centella-light-cleansing-oil/4000385873
   * - https://www.costco.com/.product.123456.html (legacy format)
   * @returns {boolean}
   */
  static isProductPage() {
    const url = window.location.href;
    const pathname = window.location.pathname;

    return url.includes('costco.com') && (
      // New URL format: /p/-/{product-slug}/{product-id}
      pathname.includes('/p/') ||
      // Legacy format with .product. in URL
      pathname.includes('.product.')
    );
  }

  /**
   * Extract product ID from Costco URL
   * Patterns:
   * - /p/-/{slug}/{id} -> id
   * - /p/{slug}/{id} -> id
   * - .product.{id}.html -> id
   * @returns {string|null} Product ID or null if not found
   */
  static extractProductID() {
    const url = window.location.href;
    const pathname = window.location.pathname;

    // Pattern 1: /p/-/{slug}/{id} or /p/{slug}/{id}
    // Example: /p/-/skin1004-madagascar-centella-light-cleansing-oil/4000385873
    const newFormatMatch = pathname.match(/\/p\/(?:-\/)?[^\/]+\/(\d+)/);
    if (newFormatMatch) {
      return newFormatMatch[1];
    }

    // Pattern 2: .product.{id}.html
    const legacyMatch = pathname.match(/\.product\.(\d+)\.html/);
    if (legacyMatch) {
      return legacyMatch[1];
    }

    // Pattern 3: Check for ID in query params
    const urlParams = new URLSearchParams(window.location.search);
    const itemId = urlParams.get('itemId') || urlParams.get('productId');
    if (itemId) {
      return itemId;
    }

    // Pattern 4: Just look for a long number at the end of the URL
    const genericMatch = url.match(/\/(\d{6,})(?:\?|$)/);
    if (genericMatch) {
      return genericMatch[1];
    }

    return null;
  }

  /**
   * Sleep utility for delays between requests
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise}
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get element text content safely
   * @param {Element} element - DOM element
   * @returns {string} Trimmed text content or empty string
   */
  static getTextContent(element) {
    return element ? element.textContent.trim() : '';
  }

  /**
   * Query selector with optional context
   * @param {string} selector - CSS selector
   * @param {Element} context - Context element (defaults to document)
   * @returns {Element|null}
   */
  static querySelector(selector, context = document) {
    try {
      return context.querySelector(selector);
    } catch (error) {
      console.warn(`Invalid selector: ${selector}`, error);
      return null;
    }
  }

  /**
   * Query all selectors with optional context
   * @param {string} selector - CSS selector
   * @param {Element} context - Context element (defaults to document)
   * @returns {NodeList}
   */
  static querySelectorAll(selector, context = document) {
    try {
      return context.querySelectorAll(selector);
    } catch (error) {
      console.warn(`Invalid selector: ${selector}`, error);
      return [];
    }
  }

  /**
   * Normalize relative URLs to absolute URLs
   * @param {string} url - URL to normalize
   * @returns {string} Absolute URL
   */
  static normalizeURL(url) {
    if (!url) return '';

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    if (url.startsWith('//')) {
      return 'https:' + url;
    }

    if (url.startsWith('/')) {
      return 'https://www.costco.com' + url;
    }

    return 'https://www.costco.com/' + url;
  }

  /**
   * Extract JSON-LD product data from page
   * @param {Document} doc - Document to search (defaults to current document)
   * @returns {Object|null} Parsed JSON-LD product data
   */
  static extractJSONLD(doc = document) {
    try {
      const scripts = doc.querySelectorAll('script[type="application/ld+json"]');

      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);

          // Only return if it's specifically a Product type
          // (avoid returning BreadcrumbList or other schemas)
          if (data['@type'] === 'Product') {
            return data;
          }

          // Check for @graph array containing Product
          if (data['@graph'] && Array.isArray(data['@graph'])) {
            for (const item of data['@graph']) {
              if (item['@type'] === 'Product') {
                return item;
              }
            }
          }
        } catch (e) {
          continue;
        }
      }

      return null;
    } catch (error) {
      console.warn('Error extracting JSON-LD:', error);
      return null;
    }
  }

  /**
   * Convert image URL to high-resolution version
   * Costco uses patterns like ?w=400&h=400, upgrade to higher res
   * @param {string} url - Image URL
   * @returns {string} High-res image URL
   */
  static getHighResImageURL(url) {
    if (!url) return '';

    // For bfasset.costco-static.com URLs, strip all size/crop params
    // and request the full uncropped image by keeping only auto & format
    if (url.includes('bfasset.costco-static.com')) {
      try {
        const urlObj = new URL(url);
        const keepParams = ['auto', 'format'];
        const paramsToRemove = [];
        for (const key of urlObj.searchParams.keys()) {
          if (!keepParams.includes(key)) {
            paramsToRemove.push(key);
          }
        }
        paramsToRemove.forEach(key => urlObj.searchParams.delete(key));
        return urlObj.toString();
      } catch (e) {
        // Fall through to regex approach if URL parsing fails
      }
    }

    // For content.syndigo.com URLs, upgrade to highest resolution available
    // Path pattern: /asset/{id}/480.webp - try 960 first, then 1920
    // Use an <img> onerror fallback chain at runtime to pick the best one
    if (url.includes('content.syndigo.com')) {
      // Replace the size in the path with 960 (reliably available from srcset)
      return url.replace(/\/\d+\.(webp|png|jpg|jpeg)/, '/960.$1');
    }

    // Generic fallback: remove size constraints from image URLs
    // Pattern: ?w=XXX&h=XXX or ?width=XXX&height=XXX
    return url
      .replace(/[?&]w=\d+/gi, '')
      .replace(/[?&]h=\d+/gi, '')
      .replace(/[?&]width=\d+/gi, '')
      .replace(/[?&]height=\d+/gi, '')
      .replace(/[?&]quality=\d+/gi, '')
      .replace(/[?&]fit=[^&]*/gi, '')
      .replace(/[?&]canvas=[^&]*/gi, '')
      .replace(/\?$/, '') // Remove trailing ? if no params left
      .replace(/&$/, ''); // Remove trailing & if present
  }

  /**
   * Parse price string to float
   * @param {string} priceStr - Price string (e.g., "$35.99")
   * @returns {number|null} Parsed price or null
   */
  static parsePrice(priceStr) {
    if (!priceStr) return null;

    // Remove currency symbols, commas, and whitespace
    const cleanPrice = priceStr.replace(/[$,\s]/g, '').trim();
    const price = parseFloat(cleanPrice);

    return isNaN(price) ? null : price;
  }

  /**
   * Format price as string with currency symbol
   * @param {number} price - Price number
   * @returns {string} Formatted price (e.g., "$35.99")
   */
  static formatPrice(price) {
    if (price === null || price === undefined) return '';
    return `$${price.toFixed(2)}`;
  }

  /**
   * Check if element or its parents match a selector
   * @param {Element} element - Starting element
   * @param {string} selector - CSS selector to match
   * @returns {Element|null} Matching element or null
   */
  static closest(element, selector) {
    try {
      return element ? element.closest(selector) : null;
    } catch (error) {
      console.warn(`Error with closest selector: ${selector}`, error);
      return null;
    }
  }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CostcoDOMHelpers;
}
