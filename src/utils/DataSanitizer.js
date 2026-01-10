/**
 * Data Sanitizer
 * Removes Amazon branding and sanitizes product data for reselling
 */
export class DataSanitizer {
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
