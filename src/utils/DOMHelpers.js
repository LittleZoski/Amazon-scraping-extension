/**
 * DOM Helper Utilities
 * Provides reusable DOM manipulation and query methods
 */
export class DOMHelpers {
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
