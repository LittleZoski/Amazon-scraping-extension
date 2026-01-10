/**
 * OrderStorageManager - Manages storage of eBay order data
 * Follows the same pattern as StorageManager for consistency
 */
export class OrderStorageManager {
  static STORAGE_KEY = 'scrapedOrders';

  /**
   * Save order data to storage
   * @param {Object} orderData - Order data to save
   * @returns {Promise<boolean>} Success status
   */
  static async saveOrder(orderData) {
    try {
      // Get existing orders
      const orders = await this.getScrapedOrders();

      // Check for duplicates
      const existingIndex = orders.findIndex(order => order.orderId === orderData.orderId);

      if (existingIndex >= 0) {
        // Update existing order
        orders[existingIndex] = orderData;
        console.log(`Updated existing order: ${orderData.orderId}`);
      } else {
        // Add new order
        orders.push(orderData);
        console.log(`Saved new order: ${orderData.orderId}`);
      }

      // Save to Chrome storage
      try {
        await chrome.storage.local.set({ [this.STORAGE_KEY]: orders });
        return true;
      } catch (chromeError) {
        console.warn('Chrome storage failed, falling back to localStorage:', chromeError);
        return this.saveToLocalStorage(orders);
      }
    } catch (error) {
      console.error('Error saving order:', error);
      return false;
    }
  }

  /**
   * Save multiple orders at once
   * @param {Array} ordersArray - Array of orders to save
   * @returns {Promise<boolean>} Success status
   */
  static async saveOrders(ordersArray) {
    try {
      const existingOrders = await this.getScrapedOrders();
      const orderMap = new Map(existingOrders.map(order => [order.orderId, order]));

      // Merge new orders with existing (update duplicates)
      ordersArray.forEach(order => {
        orderMap.set(order.orderId, order);
      });

      const mergedOrders = Array.from(orderMap.values());

      // Save to Chrome storage
      try {
        await chrome.storage.local.set({ [this.STORAGE_KEY]: mergedOrders });
        return true;
      } catch (chromeError) {
        console.warn('Chrome storage failed, falling back to localStorage:', chromeError);
        return this.saveToLocalStorage(mergedOrders);
      }
    } catch (error) {
      console.error('Error saving orders:', error);
      return false;
    }
  }

  /**
   * Get all scraped orders from storage
   * @returns {Promise<Array>} Array of scraped orders
   */
  static async getScrapedOrders() {
    try {
      // Try Chrome storage first
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      if (result[this.STORAGE_KEY]) {
        return result[this.STORAGE_KEY];
      }

      // Fallback to localStorage
      const localData = localStorage.getItem(this.STORAGE_KEY);
      if (localData) {
        return JSON.parse(localData);
      }

      return [];
    } catch (error) {
      console.error('Error getting scraped orders:', error);

      // Fallback to localStorage
      try {
        const localData = localStorage.getItem(this.STORAGE_KEY);
        return localData ? JSON.parse(localData) : [];
      } catch (localError) {
        console.error('Error reading from localStorage:', localError);
        return [];
      }
    }
  }

  /**
   * Get a specific order by ID
   * @param {string} orderId - Order ID to retrieve
   * @returns {Promise<Object|null>} Order data or null if not found
   */
  static async getOrderById(orderId) {
    try {
      const orders = await this.getScrapedOrders();
      return orders.find(order => order.orderId === orderId) || null;
    } catch (error) {
      console.error('Error getting order by ID:', error);
      return null;
    }
  }

  /**
   * Delete an order by ID
   * @param {string} orderId - Order ID to delete
   * @returns {Promise<boolean>} Success status
   */
  static async deleteOrder(orderId) {
    try {
      const orders = await this.getScrapedOrders();
      const filteredOrders = orders.filter(order => order.orderId !== orderId);

      // Save updated list
      try {
        await chrome.storage.local.set({ [this.STORAGE_KEY]: filteredOrders });
        return true;
      } catch (chromeError) {
        console.warn('Chrome storage failed, falling back to localStorage:', chromeError);
        return this.saveToLocalStorage(filteredOrders);
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      return false;
    }
  }

  /**
   * Delete multiple orders by IDs
   * @param {Array} orderIds - Array of order IDs to delete
   * @returns {Promise<boolean>} Success status
   */
  static async deleteOrders(orderIds) {
    try {
      const orders = await this.getScrapedOrders();
      const orderIdSet = new Set(orderIds);
      const filteredOrders = orders.filter(order => !orderIdSet.has(order.orderId));

      // Save updated list
      try {
        await chrome.storage.local.set({ [this.STORAGE_KEY]: filteredOrders });
        return true;
      } catch (chromeError) {
        console.warn('Chrome storage failed, falling back to localStorage:', chromeError);
        return this.saveToLocalStorage(filteredOrders);
      }
    } catch (error) {
      console.error('Error deleting orders:', error);
      return false;
    }
  }

  /**
   * Clear all scraped orders
   * @returns {Promise<boolean>} Success status
   */
  static async clearAllOrders() {
    try {
      await chrome.storage.local.set({ [this.STORAGE_KEY]: [] });
      localStorage.removeItem(this.STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('Error clearing orders:', error);
      return false;
    }
  }

  /**
   * Save orders to localStorage (fallback method)
   * @param {Array} orders - Orders array to save
   * @returns {boolean} Success status
   */
  static saveToLocalStorage(orders) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(orders));
      return true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return false;
    }
  }

  /**
   * Get order count
   * @returns {Promise<number>} Number of scraped orders
   */
  static async getOrderCount() {
    try {
      const orders = await this.getScrapedOrders();
      return orders.length;
    } catch (error) {
      console.error('Error getting order count:', error);
      return 0;
    }
  }

  /**
   * Get orders by date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Filtered orders
   */
  static async getOrdersByDateRange(startDate, endDate) {
    try {
      const orders = await this.getScrapedOrders();
      return orders.filter(order => {
        const orderDate = new Date(order.orderDate);
        return orderDate >= startDate && orderDate <= endDate;
      });
    } catch (error) {
      console.error('Error getting orders by date range:', error);
      return [];
    }
  }

  /**
   * Get orders by status
   * @param {string} status - Order status to filter by
   * @returns {Promise<Array>} Filtered orders
   */
  static async getOrdersByStatus(status) {
    try {
      const orders = await this.getScrapedOrders();
      return orders.filter(order => order.orderStatus === status);
    } catch (error) {
      console.error('Error getting orders by status:', error);
      return [];
    }
  }

  /**
   * Search orders by text
   * @param {string} searchText - Text to search for
   * @returns {Promise<Array>} Matching orders
   */
  static async searchOrders(searchText) {
    try {
      const orders = await this.getScrapedOrders();
      const searchLower = searchText.toLowerCase();

      return orders.filter(order => {
        // Search in order ID
        if (order.orderId?.toLowerCase().includes(searchLower)) return true;

        // Search in buyer username
        if (order.buyerInfo?.username?.toLowerCase().includes(searchLower)) return true;

        // Search in shipping name
        if (order.shippingAddress?.name?.toLowerCase().includes(searchLower)) return true;

        // Search in item titles
        if (order.items?.some(item => item.title?.toLowerCase().includes(searchLower))) return true;

        return false;
      });
    } catch (error) {
      console.error('Error searching orders:', error);
      return [];
    }
  }

  /**
   * Get total earnings from all orders
   * @returns {Promise<number>} Total earnings
   */
  static async getTotalEarnings() {
    try {
      const orders = await this.getScrapedOrders();
      return orders.reduce((total, order) => {
        if (order.financials?.yourEarnings) {
          const earnings = parseFloat(order.financials.yourEarnings.replace(/[^0-9.]/g, '')) || 0;
          return total + earnings;
        }
        return total;
      }, 0);
    } catch (error) {
      console.error('Error calculating total earnings:', error);
      return 0;
    }
  }

  /**
   * Get statistics about scraped orders
   * @returns {Promise<Object>} Statistics object
   */
  static async getOrderStats() {
    try {
      const orders = await this.getScrapedOrders();

      const stats = {
        totalOrders: orders.length,
        totalEarnings: 0,
        totalSales: 0,
        totalFees: 0,
        averageEarnings: 0,
        ordersByStatus: {},
        oldestOrder: null,
        newestOrder: null,
      };

      if (orders.length === 0) return stats;

      // Calculate financial totals
      orders.forEach(order => {
        if (order.financials?.yourEarnings) {
          stats.totalEarnings += parseFloat(order.financials.yourEarnings.replace(/[^0-9.]/g, '')) || 0;
        }
        if (order.financials?.totalSale) {
          stats.totalSales += parseFloat(order.financials.totalSale.replace(/[^0-9.]/g, '')) || 0;
        }
        if (order.financials?.ebayFees) {
          stats.totalFees += parseFloat(order.financials.ebayFees.replace(/[^0-9.]/g, '')) || 0;
        }

        // Count by status
        const status = order.orderStatus || 'Unknown';
        stats.ordersByStatus[status] = (stats.ordersByStatus[status] || 0) + 1;
      });

      stats.averageEarnings = stats.totalEarnings / orders.length;

      // Find oldest and newest orders
      const sortedByDate = [...orders].sort((a, b) => {
        return new Date(a.scrapedAt) - new Date(b.scrapedAt);
      });

      stats.oldestOrder = sortedByDate[0];
      stats.newestOrder = sortedByDate[sortedByDate.length - 1];

      return stats;
    } catch (error) {
      console.error('Error getting order stats:', error);
      return {
        totalOrders: 0,
        totalEarnings: 0,
        totalSales: 0,
        totalFees: 0,
        averageEarnings: 0,
        ordersByStatus: {},
        oldestOrder: null,
        newestOrder: null,
      };
    }
  }

  /**
   * Export orders to JSON
   * @returns {Promise<string>} JSON string of all orders
   */
  static async exportToJSON() {
    try {
      const orders = await this.getScrapedOrders();
      return JSON.stringify(orders, null, 2);
    } catch (error) {
      console.error('Error exporting to JSON:', error);
      return '[]';
    }
  }

  /**
   * Export orders to CSV
   * @returns {Promise<string>} CSV string of all orders
   */
  static async exportToCSV() {
    try {
      const orders = await this.getScrapedOrders();

      if (orders.length === 0) {
        return 'No orders to export';
      }

      // Define CSV headers
      const headers = [
        'Order ID',
        'Order Date',
        'Status',
        'Buyer Username',
        'Shipping Name',
        'Shipping Address',
        'Total Sale',
        'Your Earnings',
        'eBay Fees',
        'Shipping Cost',
        'Item Count',
        'Item Title',
        'Item ID',
        'Tracking Number',
        'Carrier',
        'URL',
        'Scraped At'
      ];

      // Convert orders to CSV rows
      const rows = orders.map(order => {
        const item = order.items?.[0] || {};
        return [
          order.orderId,
          order.orderDate,
          order.orderStatus,
          order.buyerInfo?.username || '',
          order.shippingAddress?.name || '',
          order.shippingAddress?.fullAddress || '',
          order.financials?.totalSale || '',
          order.financials?.yourEarnings || '',
          order.financials?.ebayFees || '',
          order.financials?.shippingCost || '',
          order.items?.length || 0,
          item.title || '',
          item.itemId || '',
          order.tracking?.trackingNumber || '',
          order.tracking?.carrier || '',
          order.url,
          order.scrapedAt
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
      });

      // Combine headers and rows
      return [headers.join(','), ...rows].join('\n');
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      return 'Error exporting to CSV';
    }
  }

  /**
   * Import orders from JSON
   * @param {string} jsonString - JSON string of orders to import
   * @returns {Promise<Object>} Import result with count and errors
   */
  static async importFromJSON(jsonString) {
    try {
      const importedOrders = JSON.parse(jsonString);

      if (!Array.isArray(importedOrders)) {
        return { success: false, error: 'Invalid JSON format: expected array' };
      }

      const result = await this.saveOrders(importedOrders);

      return {
        success: result,
        count: importedOrders.length,
        error: result ? null : 'Failed to save imported orders'
      };
    } catch (error) {
      console.error('Error importing from JSON:', error);
      return {
        success: false,
        count: 0,
        error: error.message
      };
    }
  }
}
