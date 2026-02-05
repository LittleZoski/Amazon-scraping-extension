/**
 * CostcoDataSanitizer - Data sanitization for Costco.com products
 * Removes Costco branding and sanitizes product data for reselling
 * Follows the same pattern as YamiDataSanitizer.js and DataSanitizer.js
 */

class CostcoDataSanitizer {
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
      sanitized.title = this.removeCostcoBranding(sanitized.title);
    }

    if (sanitized.description) {
      sanitized.description = this.removeCostcoBranding(sanitized.description);
    }

    if (sanitized.bulletPoints && Array.isArray(sanitized.bulletPoints)) {
      sanitized.bulletPoints = sanitized.bulletPoints.map(bullet =>
        this.removeCostcoBranding(bullet)
      );
    }

    if (sanitized.specifications && typeof sanitized.specifications === 'object') {
      Object.keys(sanitized.specifications).forEach(key => {
        sanitized.specifications[key] = this.removeCostcoBranding(sanitized.specifications[key]);
      });
    }

    // Replace URL with product ID reference (keep original for tracking)
    if (sanitized.url) {
      sanitized.originalCostcoUrl = sanitized.url;
      // Use "Product ASIN" for compatibility with eBay backend
      sanitized.url = `Product ASIN: ${sanitized.asin || sanitized.productID}`;
    }

    return sanitized;
  }

  /**
   * Remove Costco branding from text strings
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  static removeCostcoBranding(text) {
    if (!text || typeof text !== 'string') return text;

    const patterns = [
      // Costco.com specific patterns
      { pattern: /\bCostco\.com\b/gi, replacement: '' },
      { pattern: /\bCostco Wholesale\b/gi, replacement: '' },
      { pattern: /\bCostco\b/gi, replacement: '' },

      // Kirkland Signature brand (Costco's store brand)
      // Note: Keep "Kirkland Signature" in product name for brand recognition
      // but remove promotional language about it
      { pattern: /Kirkland Signature Exclusive/gi, replacement: '' },
      { pattern: /Only at Costco/gi, replacement: '' },
      { pattern: /Costco Exclusive/gi, replacement: '' },

      // Membership and warehouse patterns
      { pattern: /Members only/gi, replacement: '' },
      { pattern: /Member price/gi, replacement: '' },
      { pattern: /Warehouse price/gi, replacement: '' },
      { pattern: /Warehouse deal/gi, replacement: '' },
      { pattern: /Available in warehouse/gi, replacement: '' },
      { pattern: /Also available in warehouse/gi, replacement: '' },

      // Fulfillment and shipping patterns
      { pattern: /Ships from Costco/gi, replacement: '' },
      { pattern: /Sold by Costco/gi, replacement: '' },
      { pattern: /Fulfilled by Costco/gi, replacement: '' },
      { pattern: /Costco fulfillment/gi, replacement: '' },

      // Marketing language
      { pattern: /Buyer's Pick/gi, replacement: '' },
      { pattern: /Costco's Choice/gi, replacement: '' },
      { pattern: /Best of Costco/gi, replacement: '' },

      // URLs
      { pattern: /https?:\/\/(www\.)?costco\.com\/[^\s]*/gi, replacement: '' },
      { pattern: /www\.costco\.com/gi, replacement: '' },

      // CDN and image URLs
      { pattern: /https?:\/\/images\.costco-static\.com\/[^\s]*/gi, replacement: '' },
      { pattern: /https?:\/\/richmedia\.ca-richcontent\.com\/[^\s]*/gi, replacement: '' },

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
        title: this.removeCostcoBranding(item.title || '')
      }));
    }

    return sanitized;
  }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CostcoDataSanitizer;
}
