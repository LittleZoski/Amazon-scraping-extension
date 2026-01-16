/**
 * YamiDataSanitizer - Data sanitization for Yami.com products
 * Removes Yami branding and sanitizes product data for reselling
 * Follows the same pattern as DataSanitizer.js for Amazon
 */

class YamiDataSanitizer {
  /**
   * Sanitize complete product data object
   * @param {Object} productData - Raw product data
   * @returns {Object} Sanitized product data
   */
  static sanitizeProductData(productData) {
    // Deep clone to avoid mutating original
    const sanitized = JSON.parse(JSON.stringify(productData));

    // Sanitize text fields
    if (sanitized.title) {
      sanitized.title = this.removeYamiBranding(sanitized.title);
    }

    if (sanitized.description) {
      sanitized.description = this.removeYamiBranding(sanitized.description);
    }

    if (sanitized.bulletPoints && Array.isArray(sanitized.bulletPoints)) {
      sanitized.bulletPoints = sanitized.bulletPoints.map(bullet =>
        this.removeYamiBranding(bullet)
      );
    }

    if (sanitized.specifications && typeof sanitized.specifications === 'object') {
      Object.keys(sanitized.specifications).forEach(key => {
        sanitized.specifications[key] = this.removeYamiBranding(sanitized.specifications[key]);
      });
    }

    // Replace URL with product ID reference (keep original for tracking)
    if (sanitized.url) {
      sanitized.originalYamiUrl = sanitized.url;
      // Use "Product ASIN" for compatibility with eBay backend
      sanitized.url = `Product ASIN: ${sanitized.asin || sanitized.productID}`;
    }

    return sanitized;
  }

  /**
   * Remove Yami branding from text strings
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  static removeYamiBranding(text) {
    if (!text || typeof text !== 'string') return text;

    const patterns = [
      // Yami.com specific patterns
      { pattern: /\bYami\.com\b/gi, replacement: '' },
      { pattern: /\bYamibuy\.com\b/gi, replacement: '' },
      { pattern: /\bYami\b/gi, replacement: '' },
      { pattern: /\bYamibuy\b/gi, replacement: '' },

      // Fulfillment and shipping patterns
      { pattern: /Fulfilled by Yami/gi, replacement: '' },
      { pattern: /Ships from Yami/gi, replacement: '' },
      { pattern: /Sold by Yami/gi, replacement: '' },
      { pattern: /Shipped by Yami/gi, replacement: '' },

      // Marketing language
      { pattern: /Yami's Choice/gi, replacement: '' },
      { pattern: /Yami Exclusive/gi, replacement: '' },
      { pattern: /Only at Yami/gi, replacement: '' },

      // URLs
      { pattern: /https?:\/\/(www\.)?yami\.com\/[^\s]*/gi, replacement: '' },
      { pattern: /https?:\/\/(www\.)?yamibuy\.com\/[^\s]*/gi, replacement: '' },
      { pattern: /www\.yami\.com/gi, replacement: '' },
      { pattern: /www\.yamibuy\.com/gi, replacement: '' },

      // CDN URLs
      { pattern: /https?:\/\/cdn\.yamibuy\.net\/[^\s]*/gi, replacement: '' },

      // Clean up whitespace and punctuation
      { pattern: /\s+/g, replacement: ' ' },           // Multiple spaces to single space
      { pattern: /\s,/g, replacement: ',' },           // Space before comma
      { pattern: /\s\./g, replacement: '.' },          // Space before period
      { pattern: /\s:/g, replacement: ':' },           // Space before colon
      { pattern: /^\s+|\s+$/g, replacement: '' },      // Trim leading/trailing spaces
      { pattern: /^[,.\-:;]\s*/g, replacement: '' },   // Remove leading punctuation
      { pattern: /\s*[,.\-:;]$/g, replacement: '' }    // Remove trailing punctuation
    ];

    let sanitized = text;
    patterns.forEach(({ pattern, replacement }) => {
      sanitized = sanitized.replace(pattern, replacement);
    });

    return sanitized;
  }

  /**
   * Sanitize order data (if needed in the future)
   * @param {Object} orderData - Raw order data
   * @returns {Object} Sanitized order data
   */
  static sanitizeOrderData(orderData) {
    const sanitized = JSON.parse(JSON.stringify(orderData));

    // Sanitize item titles in order
    if (sanitized.items && Array.isArray(sanitized.items)) {
      sanitized.items = sanitized.items.map(item => ({
        ...item,
        title: this.removeYamiBranding(item.title || '')
      }));
    }

    return sanitized;
  }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = YamiDataSanitizer;
}
