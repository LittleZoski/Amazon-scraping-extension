/**
 * OrderValidators - Validation logic for eBay order data
 * Follows the same pattern as Validators for consistency
 */
export class OrderValidators {
  /**
   * Validate order data before saving
   * @param {Object} orderData - Order data to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result with isValid flag and errors array
   */
  static validateOrder(orderData, options = {}) {
    const errors = [];

    // Check for required fields
    if (!orderData.orderId || orderData.orderId === 'Unknown') {
      errors.push('Missing or invalid order ID');
    }

    // Validate items array
    if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      errors.push('No items found in order');
    } else {
      // Validate each item
      orderData.items.forEach((item, index) => {
        if (!item.title) {
          errors.push(`Item ${index + 1}: Missing title`);
        }
        if (!item.soldPrice) {
          errors.push(`Item ${index + 1}: Missing sold price`);
        }
      });
    }

    // Validate shipping address if required
    if (options.requireShippingAddress) {
      if (!orderData.shippingAddress || !orderData.shippingAddress.fullAddress) {
        errors.push('Missing shipping address');
      }
    }

    // Validate financials if required
    if (options.requireFinancials) {
      if (!orderData.financials || !orderData.financials.totalSale) {
        errors.push('Missing financial information');
      }
    }

    // Custom minimum earnings filter
    if (options.minEarnings) {
      const earnings = this.parsePrice(orderData.financials?.yourEarnings);
      if (earnings < options.minEarnings) {
        errors.push(`Earnings ($${earnings}) below minimum ($${options.minEarnings})`);
      }
    }

    // Custom maximum earnings filter
    if (options.maxEarnings) {
      const earnings = this.parsePrice(orderData.financials?.yourEarnings);
      if (earnings > options.maxEarnings) {
        errors.push(`Earnings ($${earnings}) above maximum ($${options.maxEarnings})`);
      }
    }

    // Date range filter
    if (options.startDate) {
      const orderDate = new Date(orderData.orderDate);
      const startDate = new Date(options.startDate);
      if (orderDate < startDate) {
        errors.push(`Order date before start date`);
      }
    }

    if (options.endDate) {
      const orderDate = new Date(orderData.orderDate);
      const endDate = new Date(options.endDate);
      if (orderDate > endDate) {
        errors.push(`Order date after end date`);
      }
    }

    // Order status filter
    if (options.requiredStatus && orderData.orderStatus !== options.requiredStatus) {
      errors.push(`Order status (${orderData.orderStatus}) does not match required status (${options.requiredStatus})`);
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Parse price string to number
   * @param {string} priceString - Price string like "$29.99" or "US $29.99"
   * @returns {number} Parsed price as number
   */
  static parsePrice(priceString) {
    if (!priceString) return 0;

    // Remove currency symbols and commas, then parse
    const cleaned = priceString.replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
  }

  /**
   * Validate order data extracted from a document (for bulk scraping)
   * @param {Object} orderData - Order data to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static validateOrderFromDoc(orderData, options = {}) {
    // Use same validation logic
    return this.validateOrder(orderData, options);
  }

  /**
   * Check if order has complete shipping information
   * @param {Object} orderData - Order data to check
   * @returns {boolean} True if shipping info is complete
   */
  static hasCompleteShippingInfo(orderData) {
    if (!orderData.shippingAddress) return false;

    const address = orderData.shippingAddress;
    return !!(
      address.name &&
      address.fullAddress &&
      (address.postalCode || address.city)
    );
  }

  /**
   * Check if order has complete financial information
   * @param {Object} orderData - Order data to check
   * @returns {boolean} True if financial info is complete
   */
  static hasCompleteFinancialInfo(orderData) {
    if (!orderData.financials) return false;

    const financials = orderData.financials;
    return !!(
      financials.totalSale &&
      financials.yourEarnings
    );
  }

  /**
   * Check if order has tracking information
   * @param {Object} orderData - Order data to check
   * @returns {boolean} True if tracking info exists
   */
  static hasTrackingInfo(orderData) {
    if (!orderData.tracking) return false;

    return !!(
      orderData.tracking.trackingNumber ||
      orderData.tracking.trackingUrl
    );
  }

  /**
   * Validate order ID format
   * @param {string} orderId - Order ID to validate
   * @returns {boolean} True if order ID format is valid
   */
  static isValidOrderId(orderId) {
    if (!orderId) return false;

    // eBay order IDs typically follow pattern: 12-34567-89012
    const ebayPattern = /^\d{2}-\d{5}-\d{5}$/;
    return ebayPattern.test(orderId);
  }

  /**
   * Check for duplicate orders
   * @param {Object} newOrder - New order to check
   * @param {Array} existingOrders - Array of existing orders
   * @returns {boolean} True if order already exists
   */
  static isDuplicateOrder(newOrder, existingOrders) {
    if (!existingOrders || existingOrders.length === 0) return false;

    return existingOrders.some(order =>
      order.orderId === newOrder.orderId
    );
  }

  /**
   * Sanitize and validate item data
   * @param {Object} item - Item object to validate
   * @returns {Object} Validation result
   */
  static validateItem(item) {
    const errors = [];

    if (!item.title || item.title.trim() === '') {
      errors.push('Item title is required');
    }

    if (!item.soldPrice) {
      errors.push('Item sold price is required');
    }

    if (item.quantity && (isNaN(item.quantity) || item.quantity < 1)) {
      errors.push('Item quantity must be a positive number');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Validate multiple orders at once
   * @param {Array} orders - Array of orders to validate
   * @param {Object} options - Validation options
   * @returns {Object} Batch validation result
   */
  static validateOrders(orders, options = {}) {
    const results = {
      valid: [],
      invalid: [],
      duplicates: [],
      totalCount: orders.length,
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0
    };

    const seenOrderIds = new Set();

    orders.forEach((order, index) => {
      // Check for duplicates
      if (seenOrderIds.has(order.orderId)) {
        results.duplicates.push({ order, index, reason: 'Duplicate order ID' });
        results.duplicateCount++;
        return;
      }

      seenOrderIds.add(order.orderId);

      // Validate order
      const validation = this.validateOrder(order, options);

      if (validation.isValid) {
        results.valid.push({ order, index });
        results.validCount++;
      } else {
        results.invalid.push({ order, index, errors: validation.errors });
        results.invalidCount++;
      }
    });

    return results;
  }

  /**
   * Get validation summary message
   * @param {Object} validationResult - Result from validateOrder
   * @returns {string} Human-readable validation message
   */
  static getValidationMessage(validationResult) {
    if (validationResult.isValid) {
      return 'Order data is valid';
    }

    return `Validation failed: ${validationResult.errors.join(', ')}`;
  }
}
