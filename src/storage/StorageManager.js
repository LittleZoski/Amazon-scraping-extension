/**
 * Storage Manager
 * Handles all data persistence using Chrome storage and localStorage fallback
 */
export class StorageManager {
  static async saveProduct(productData) {
    return new Promise((resolve, reject) => {
      if (!chrome.runtime?.id) {
        console.warn('Extension context invalidated, using localStorage');
        this.saveToLocalStorage(productData);
        resolve();
        return;
      }

      try {
        chrome.storage.local.get(['scrapedProducts'], (result) => {
          if (chrome.runtime.lastError) {
            console.warn('chrome.storage failed, using localStorage:', chrome.runtime.lastError);
            this.saveToLocalStorage(productData);
            resolve();
            return;
          }

          const products = result.scrapedProducts || [];
          const existingIndex = products.findIndex(p => p.asin === productData.asin);

          if (existingIndex >= 0) {
            products[existingIndex] = productData;
          } else {
            products.push(productData);
          }

          chrome.storage.local.set({ scrapedProducts: products }, () => {
            if (chrome.runtime.lastError) {
              console.warn('chrome.storage.set failed, using localStorage:', chrome.runtime.lastError);
              this.saveToLocalStorage(productData);
              resolve();
            } else {
              resolve();
            }
          });
        });
      } catch (error) {
        console.warn('Extension context invalidated, using localStorage');
        this.saveToLocalStorage(productData);
        resolve();
      }
    });
  }

  static saveToLocalStorage(productData) {
    try {
      const stored = localStorage.getItem('scrapedProducts');
      const products = stored ? JSON.parse(stored) : [];
      const existingIndex = products.findIndex(p => p.asin === productData.asin);

      if (existingIndex >= 0) {
        products[existingIndex] = productData;
      } else {
        products.push(productData);
      }

      localStorage.setItem('scrapedProducts', JSON.stringify(products));
    } catch (error) {
      console.error('localStorage save failed:', error);
    }
  }

  static async getPrimeOnlyMode() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['primeOnlyMode'], (result) => {
        resolve(result.primeOnlyMode || false);
      });
    });
  }

  static async setPrimeOnlyMode(value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ primeOnlyMode: value }, () => {
        resolve();
      });
    });
  }
}
