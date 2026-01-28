/**
 * YamiDOMHelpers - DOM utility functions for Yami.com scraping
 * Follows the same pattern as DOMHelpers.js for Amazon
 */

class YamiDOMHelpers {
  /**
   * Check if the current page is a Yami category/search page
   * @returns {boolean}
   */
  static isCategoryPage() {
    const url = window.location.href;
    return url.includes('yami.com') && (
      url.includes('/c/') ||           // Category pages like /c/personal-care/350
      url.includes('/search?') ||      // Search results
      url.includes('/category/') ||    // Alternative category format
      url.includes('/collection/') ||  // Collection pages
      url.includes('/brand/') ||       // Brand pages
      url.includes('/new-arrivals?') || // New arrivals pages
      url.includes('/best-sellers?') || // Best sellers pages
      url.includes('/deals?') ||        // Deals pages
      url.includes('/clearance?') ||    // Clearance pages
      (url.includes('?page=') && !url.includes('/p/')) // Any paginated listing that's not a product page
    );
  }

  /**
   * Check if the current page is a Yami product page
   * @returns {boolean}
   */
  static isProductPage() {
    const url = window.location.href;
    return url.includes('yami.com') && url.includes('/p/');
  }

  /**
   * Extract product ID from Yami URL
   * Pattern: /p/{product-slug}/{product-id}
   * @returns {string|null} Product ID or null if not found
   */
  static extractProductID() {
    const url = window.location.href;
    const match = url.match(/\/p\/[^\/]+\/(\d+)/);
    return match ? match[1] : null;
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
      return 'https://www.yami.com' + url;
    }

    return 'https://www.yami.com/' + url;
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

          if (data['@type'] === 'Product' || data.itemListElement) {
            return data;
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
   * Yami uses patterns like _640x640.webp, upgrade to higher res if available
   * @param {string} url - Image URL
   * @returns {string} High-res image URL
   */
  static getHighResImageURL(url) {
    if (!url) return '';

    // Replace low-res patterns with high-res
    // Pattern: _640x640.webp -> _1000x1000.webp or remove size constraint
    return url
      .replace(/_\d+x\d+\.webp/, '_1000x1000.webp')
      .replace(/_\d+x\d+\.jpg/, '_1000x1000.jpg')
      .replace(/_\d+x\d+\.png/, '_1000x1000.png');
  }

  /**
   * Parse price string to float
   * @param {string} priceStr - Price string (e.g., "$35.99")
   * @returns {number|null} Parsed price or null
   */
  static parsePrice(priceStr) {
    if (!priceStr) return null;

    // Remove currency symbols and commas
    const cleanPrice = priceStr.replace(/[$,]/g, '').trim();
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
  module.exports = YamiDOMHelpers;
}
