/**
 * OrderDataSanitizer - Cleans and sanitizes eBay order data
 * Removes sensitive information while preserving essential data
 * Follows the same pattern as DataSanitizer for consistency
 */
export class OrderDataSanitizer {
  /**
   * Sanitize order data before saving or exporting
   * @param {Object} orderData - Raw order data to sanitize
   * @param {Object} options - Sanitization options
   * @returns {Object} Sanitized order data
   */
  static sanitizeOrderData(orderData, options = {}) {
    // Deep copy to avoid modifying original
    const sanitized = this.deepCopy(orderData);

    // Sanitize shipping address
    if (sanitized.shippingAddress) {
      sanitized.shippingAddress = this.sanitizeShippingAddress(sanitized.shippingAddress, options);
    }

    // Sanitize buyer info
    if (sanitized.buyerInfo) {
      sanitized.buyerInfo = this.sanitizeBuyerInfo(sanitized.buyerInfo, options);
    }

    // Sanitize items
    if (sanitized.items && Array.isArray(sanitized.items)) {
      sanitized.items = sanitized.items.map(item => this.sanitizeItem(item, options));
    }

    // Sanitize URL (preserve original)
    if (sanitized.url) {
      sanitized.originalEbayUrl = sanitized.url;
      sanitized.url = this.sanitizeUrl(sanitized.url);
    }

    // Remove any eBay tracking pixels or sensitive URLs
    if (sanitized.tracking && sanitized.tracking.trackingUrl) {
      sanitized.tracking.trackingUrl = this.sanitizeTrackingUrl(sanitized.tracking.trackingUrl);
    }

    // Clean up financial data (remove currency symbols for easier processing)
    if (sanitized.financials) {
      sanitized.financials = this.sanitizeFinancials(sanitized.financials, options);
    }

    return sanitized;
  }

  /**
   * Sanitize shipping address
   * @param {Object} address - Shipping address object
   * @param {Object} options - Sanitization options
   * @returns {Object} Sanitized address
   */
  static sanitizeShippingAddress(address, options = {}) {
    const sanitized = { ...address };

    // Option to anonymize personal information
    if (options.anonymize) {
      if (sanitized.name) {
        sanitized.name = this.anonymizeName(sanitized.name);
      }
      if (sanitized.phoneNumber) {
        sanitized.phoneNumber = this.anonymizePhone(sanitized.phoneNumber);
      }
    }

    // Clean up address strings (remove extra whitespace, normalize)
    if (sanitized.fullAddress) {
      sanitized.fullAddress = this.cleanString(sanitized.fullAddress);
    }

    if (sanitized.addressLine1) {
      sanitized.addressLine1 = this.cleanString(sanitized.addressLine1);
    }

    if (sanitized.addressLine2) {
      sanitized.addressLine2 = this.cleanString(sanitized.addressLine2);
    }

    return sanitized;
  }

  /**
   * Sanitize buyer information
   * @param {Object} buyerInfo - Buyer info object
   * @param {Object} options - Sanitization options
   * @returns {Object} Sanitized buyer info
   */
  static sanitizeBuyerInfo(buyerInfo, options = {}) {
    const sanitized = { ...buyerInfo };

    // Option to remove buyer email (privacy)
    if (options.removeBuyerEmail) {
      delete sanitized.email;
    }

    // Option to anonymize username
    if (options.anonymize && sanitized.username) {
      sanitized.username = this.anonymizeUsername(sanitized.username);
    }

    return sanitized;
  }

  /**
   * Sanitize item data
   * @param {Object} item - Item object
   * @param {Object} options - Sanitization options
   * @returns {Object} Sanitized item
   */
  static sanitizeItem(item, options = {}) {
    const sanitized = { ...item };

    // Clean title (remove eBay branding if needed)
    if (sanitized.title) {
      sanitized.title = this.cleanString(sanitized.title);

      // Option to remove eBay-specific text
      if (options.removeEbayBranding) {
        sanitized.title = this.removeEbayBranding(sanitized.title);
      }
    }

    // Normalize price format
    if (sanitized.soldPrice) {
      sanitized.soldPrice = this.normalizePrice(sanitized.soldPrice);
    }

    // Clean image URL (remove tracking parameters)
    if (sanitized.imageUrl) {
      sanitized.imageUrl = this.cleanImageUrl(sanitized.imageUrl);
    }

    return sanitized;
  }

  /**
   * Sanitize URL
   * @param {string} url - URL to sanitize
   * @returns {string} Sanitized URL
   */
  static sanitizeUrl(url) {
    if (!url) return url;

    try {
      const urlObj = new URL(url);

      // Remove tracking parameters
      const trackingParams = ['mkevt', 'mkcid', 'mkrid', 'campid', 'toolid', 'customid'];
      trackingParams.forEach(param => {
        urlObj.searchParams.delete(param);
      });

      return urlObj.toString();
    } catch (error) {
      return url; // Return original if parsing fails
    }
  }

  /**
   * Sanitize tracking URL
   * @param {string} url - Tracking URL to sanitize
   * @returns {string} Sanitized tracking URL
   */
  static sanitizeTrackingUrl(url) {
    return this.sanitizeUrl(url);
  }

  /**
   * Sanitize financial data
   * @param {Object} financials - Financial data object
   * @param {Object} options - Sanitization options
   * @returns {Object} Sanitized financial data
   */
  static sanitizeFinancials(financials, options = {}) {
    const sanitized = { ...financials };

    // Normalize all price fields
    if (sanitized.totalSale) {
      sanitized.totalSale = this.normalizePrice(sanitized.totalSale);
    }

    if (sanitized.yourEarnings) {
      sanitized.yourEarnings = this.normalizePrice(sanitized.yourEarnings);
    }

    if (sanitized.ebayFees) {
      sanitized.ebayFees = this.normalizePrice(sanitized.ebayFees);
    }

    if (sanitized.shippingCost) {
      sanitized.shippingCost = this.normalizePrice(sanitized.shippingCost);
    }

    // Option to add numeric values for easier processing
    if (options.addNumericValues) {
      sanitized.totalSaleNumeric = this.parsePrice(sanitized.totalSale);
      sanitized.yourEarningsNumeric = this.parsePrice(sanitized.yourEarnings);
      sanitized.ebayFeesNumeric = this.parsePrice(sanitized.ebayFees);
      sanitized.shippingCostNumeric = this.parsePrice(sanitized.shippingCost);
    }

    return sanitized;
  }

  /**
   * Remove eBay branding from text
   * @param {string} text - Text to clean
   * @returns {string} Cleaned text
   */
  static removeEbayBranding(text) {
    if (!text) return text;

    const patterns = [
      /\bebay\b/gi,
      /\bebay\.com\b/gi,
      /\(ebay\s+item\)/gi,
    ];

    let cleaned = text;
    patterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    return this.cleanString(cleaned);
  }

  /**
   * Normalize price format to consistent string
   * @param {string} price - Price string
   * @returns {string} Normalized price
   */
  static normalizePrice(price) {
    if (!price) return price;

    // Extract just the numeric part with decimal
    const match = price.match(/[\d,]+\.?\d*/);
    if (!match) return price;

    const cleaned = match[0].replace(/,/g, '');
    return `$${cleaned}`;
  }

  /**
   * Parse price string to number
   * @param {string} price - Price string
   * @returns {number} Parsed price
   */
  static parsePrice(price) {
    if (!price) return 0;

    const cleaned = price.replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
  }

  /**
   * Clean string (remove extra whitespace, trim)
   * @param {string} str - String to clean
   * @returns {string} Cleaned string
   */
  static cleanString(str) {
    if (!str) return str;

    return str
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .trim();                // Remove leading/trailing whitespace
  }

  /**
   * Clean image URL (remove tracking parameters)
   * @param {string} url - Image URL
   * @returns {string} Cleaned image URL
   */
  static cleanImageUrl(url) {
    if (!url) return url;

    try {
      const urlObj = new URL(url);

      // Remove common tracking parameters
      const trackingParams = ['_trkparms', 'hash'];
      trackingParams.forEach(param => {
        urlObj.searchParams.delete(param);
      });

      return urlObj.toString();
    } catch (error) {
      return url;
    }
  }

  /**
   * Anonymize name for privacy
   * @param {string} name - Name to anonymize
   * @returns {string} Anonymized name
   */
  static anonymizeName(name) {
    if (!name) return name;

    // Replace all but first letter with asterisks
    const parts = name.split(' ');
    return parts.map(part => {
      if (part.length <= 1) return part;
      return part[0] + '*'.repeat(part.length - 1);
    }).join(' ');
  }

  /**
   * Anonymize phone number for privacy
   * @param {string} phone - Phone number to anonymize
   * @returns {string} Anonymized phone number
   */
  static anonymizePhone(phone) {
    if (!phone) return phone;

    // Keep only last 4 digits
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '***';

    return '***-***-' + digits.slice(-4);
  }

  /**
   * Anonymize username for privacy
   * @param {string} username - Username to anonymize
   * @returns {string} Anonymized username
   */
  static anonymizeUsername(username) {
    if (!username) return username;

    if (username.length <= 2) return '**';
    return username.substring(0, 2) + '*'.repeat(username.length - 2);
  }

  /**
   * Deep copy object
   * @param {Object} obj - Object to copy
   * @returns {Object} Deep copy of object
   */
  static deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Sanitize multiple orders at once
   * @param {Array} orders - Array of orders to sanitize
   * @param {Object} options - Sanitization options
   * @returns {Array} Array of sanitized orders
   */
  static sanitizeOrders(orders, options = {}) {
    if (!Array.isArray(orders)) return orders;

    return orders.map(order => this.sanitizeOrderData(order, options));
  }

  /**
   * Prepare order data for export
   * @param {Object} orderData - Order data to prepare
   * @param {string} format - Export format ('json' or 'csv')
   * @returns {Object} Prepared order data
   */
  static prepareForExport(orderData, format = 'json') {
    const sanitized = this.sanitizeOrderData(orderData, {
      addNumericValues: true,
      removeEbayBranding: false, // Keep branding for export
      removeBuyerEmail: false,
      anonymize: false
    });

    if (format === 'csv') {
      // Flatten nested objects for CSV export
      return this.flattenForCSV(sanitized);
    }

    return sanitized;
  }

  /**
   * Flatten order data for CSV export
   * @param {Object} orderData - Order data to flatten
   * @returns {Object} Flattened order data
   */
  static flattenForCSV(orderData) {
    const flattened = {
      orderId: orderData.orderId,
      orderDate: orderData.orderDate,
      orderStatus: orderData.orderStatus,
      buyerUsername: orderData.buyerInfo?.username,
      shippingName: orderData.shippingAddress?.name,
      shippingAddress: orderData.shippingAddress?.fullAddress,
      shippingPhone: orderData.shippingAddress?.phoneNumber,
      totalSale: orderData.financials?.totalSale,
      yourEarnings: orderData.financials?.yourEarnings,
      ebayFees: orderData.financials?.ebayFees,
      shippingCost: orderData.financials?.shippingCost,
      trackingNumber: orderData.tracking?.trackingNumber,
      carrier: orderData.tracking?.carrier,
      itemCount: orderData.items?.length || 0,
      url: orderData.url,
      scrapedAt: orderData.scrapedAt
    };

    // Add item details (for first item if multiple)
    if (orderData.items && orderData.items.length > 0) {
      const firstItem = orderData.items[0];
      flattened.itemTitle = firstItem.title;
      flattened.itemId = firstItem.itemId;
      flattened.itemQuantity = firstItem.quantity;
      flattened.itemPrice = firstItem.soldPrice;
    }

    return flattened;
  }
}
