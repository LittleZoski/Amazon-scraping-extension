/**
 * YamiBulkScraper - Bulk scraping for Yami.com category/search pages
 * Follows the same pattern as BulkScraper.js for Amazon
 */

class YamiBulkScraper {
  constructor() {
    this.scrapeButton = null;
  }

  async init() {
    this.injectBulkScrapeButton();
  }

  /**
   * Get visible product count on page
   * @returns {number}
   */
  getVisibleProductCount() {
    const products = YamiDataExtractor.extractProductLinksFromPage();
    return products.length;
  }

  /**
   * Inject bulk scrape button into category page
   */
  injectBulkScrapeButton() {
    // Check if button already exists
    if (document.getElementById('yami-bulk-scraper-btn')) {
      return;
    }

    const itemCount = this.getVisibleProductCount();

    this.scrapeButton = document.createElement('button');
    this.scrapeButton.id = 'yami-bulk-scraper-btn';
    this.scrapeButton.innerHTML = `📦 Scrape ${itemCount} Items`;
    this.scrapeButton.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 10000;
      padding: 12px 20px;
      background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;
    `;

    this.scrapeButton.addEventListener('mouseenter', () => {
      this.scrapeButton.style.transform = 'scale(1.05)';
      this.scrapeButton.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
    });

    this.scrapeButton.addEventListener('mouseleave', () => {
      this.scrapeButton.style.transform = 'scale(1)';
      this.scrapeButton.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
    });

    this.scrapeButton.addEventListener('click', () => this.showBulkScrapeSettings());
    document.body.appendChild(this.scrapeButton);
  }

  /**
   * Show settings modal for bulk scraping
   */
  showBulkScrapeSettings() {
    const allProducts = YamiDataExtractor.extractProductLinksFromPage();

    if (allProducts.length === 0) {
      this.showNotification('❌ No products found on this page', 'error');
      return;
    }

    const settingsModal = this.createSettingsModal(allProducts);
    document.body.appendChild(settingsModal);
  }

  /**
   * Create settings modal with filters
   * @param {Array} allProducts - All products found on page
   * @returns {HTMLElement} Modal element
   */
  createSettingsModal(allProducts) {
    // Extract metadata from product cards on the page
    const productsWithMetadata = allProducts.map(p => {
      // Correct selector for Yami category pages: .item-card__price-info .price-normal.price-valid.word-bold-price
      const priceElement = p.element?.querySelector('.item-card__price-info .price-normal.price-valid.word-bold-price') ||
                          p.element?.querySelector('.price-normal.price-valid.word-bold-price') ||
                          p.element?.querySelector('.price-valid');
      const priceText = priceElement?.textContent?.trim();
      const price = YamiDOMHelpers.parsePrice(priceText);
      return { ...p, price, priceText };
    });

    const productsWithPrices = productsWithMetadata.filter(p => p.price > 0);
    const prices = productsWithPrices.map(p => p.price);
    const minPrice = prices.length > 0 ? Math.floor(Math.min(...prices)) : 0;
    const maxPrice = prices.length > 0 ? Math.ceil(Math.max(...prices)) : 100;

    const modal = document.createElement('div');
    modal.id = 'yami-scraper-settings-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10003;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    modal.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 30px; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <h2 style="margin: 0 0 20px 0; color: #333; font-size: 24px;">📦 Bulk Scrape Settings</h2>

        <div style="margin-bottom: 25px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="color: #666; font-size: 14px;">Products Found:</span>
            <span style="color: #FF6B6B; font-weight: 600; font-size: 16px;">${allProducts.length}</span>
          </div>

          <div style="margin: 20px 0;">
            <label style="display: block; color: #666; font-size: 14px; margin-bottom: 10px;">
              Number to Scrape: <span id="count-value" style="color: #FF6B6B; font-weight: 600;">${allProducts.length}</span>
            </label>
            <input type="range" id="scrape-count-slider" min="1" max="${allProducts.length}" value="${allProducts.length}"
              style="width: 100%; height: 6px; border-radius: 3px; background: #e0e0e0; outline: none; -webkit-appearance: none;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #999; margin-top: 5px;">
              <span>1</span>
              <span>${allProducts.length}</span>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 25px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
          <label style="display: flex; align-items: center; margin-bottom: 15px; cursor: pointer;">
            <input type="checkbox" id="enable-price-filter" style="margin-right: 10px; width: 18px; height: 18px; cursor: pointer;">
            <span style="color: #333; font-weight: 500;">Enable Price Filter</span>
          </label>

          <div id="price-filter-controls" style="opacity: 0.5; pointer-events: none; transition: opacity 0.3s;">
            <div style="margin-bottom: 15px;">
              <label style="display: block; color: #666; font-size: 13px; margin-bottom: 8px;">
                Min Price: $<span id="min-price-value">${minPrice}</span>
              </label>
              <input type="range" id="min-price-slider" min="${minPrice}" max="${maxPrice}" value="${minPrice}"
                style="width: 100%; height: 6px; border-radius: 3px; background: #e0e0e0; outline: none; -webkit-appearance: none;">
            </div>

            <div style="margin-bottom: 15px;">
              <label style="display: block; color: #666; font-size: 13px; margin-bottom: 8px;">
                Max Price: $<span id="max-price-value">${maxPrice}</span>
              </label>
              <input type="range" id="max-price-slider" min="${minPrice}" max="${maxPrice}" value="${maxPrice}"
                style="width: 100%; height: 6px; border-radius: 3px; background: #e0e0e0; outline: none; -webkit-appearance: none;">
            </div>

            <div style="font-size: 13px; color: #666; padding: 10px; background: white; border-radius: 6px;">
              <span id="filtered-count">${allProducts.length}</span> products match filters
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 25px;">
          <button id="start-scrape-btn" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 15px;">
            Start Scraping
          </button>
          <button id="cancel-scrape-btn" style="flex: 1; padding: 12px; background: #e0e0e0; color: #666; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 15px;">
            Cancel
          </button>
        </div>
      </div>
    `;

    this.attachModalEventListeners(modal, allProducts, productsWithMetadata);
    return modal;
  }

  /**
   * Attach event listeners to modal
   * @param {HTMLElement} modal - Modal element
   * @param {Array} allProducts - All products
   * @param {Array} productsWithMetadata - Products with price metadata
   */
  attachModalEventListeners(modal, allProducts, productsWithMetadata) {
    const countSlider = modal.querySelector('#scrape-count-slider');
    const countValue = modal.querySelector('#count-value');
    const enablePriceFilter = modal.querySelector('#enable-price-filter');
    const priceFilterControls = modal.querySelector('#price-filter-controls');
    const minPriceSlider = modal.querySelector('#min-price-slider');
    const maxPriceSlider = modal.querySelector('#max-price-slider');
    const minPriceValue = modal.querySelector('#min-price-value');
    const maxPriceValue = modal.querySelector('#max-price-value');
    const filteredCount = modal.querySelector('#filtered-count');
    const startBtn = modal.querySelector('#start-scrape-btn');
    const cancelBtn = modal.querySelector('#cancel-scrape-btn');

    countSlider.addEventListener('input', (e) => {
      countValue.textContent = e.target.value;
    });

    const updateFilteredCount = () => {
      const minPrice = parseInt(minPriceSlider.value);
      const maxPrice = parseInt(maxPriceSlider.value);

      let filtered = productsWithMetadata;

      if (enablePriceFilter.checked) {
        filtered = filtered.filter(p => p.price >= minPrice && p.price <= maxPrice);
      }

      filteredCount.textContent = filtered.length;
    };

    enablePriceFilter.addEventListener('change', (e) => {
      if (e.target.checked) {
        priceFilterControls.style.opacity = '1';
        priceFilterControls.style.pointerEvents = 'auto';
      } else {
        priceFilterControls.style.opacity = '0.5';
        priceFilterControls.style.pointerEvents = 'none';
      }
      updateFilteredCount();
    });

    minPriceSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      minPriceValue.textContent = value;
      if (value > parseInt(maxPriceSlider.value)) {
        maxPriceSlider.value = value;
        maxPriceValue.textContent = value;
      }
      updateFilteredCount();
    });

    maxPriceSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      maxPriceValue.textContent = value;
      if (value < parseInt(minPriceSlider.value)) {
        minPriceSlider.value = value;
        minPriceValue.textContent = value;
      }
      updateFilteredCount();
    });

    startBtn.addEventListener('click', () => {
      const count = parseInt(countSlider.value);
      const usePriceFilter = enablePriceFilter.checked;
      const minPrice = parseInt(minPriceSlider.value);
      const maxPrice = parseInt(maxPriceSlider.value);

      modal.remove();
      this.bulkScrapeFromPage(allProducts, count, usePriceFilter, minPrice, maxPrice);
    });

    cancelBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  /**
   * Execute bulk scraping with filters
   */
  async bulkScrapeFromPage(allProducts, maxCount, usePriceFilter, minPrice, maxPrice) {
    try {
      this.scrapeButton.innerHTML = '⏳ Filtering...';
      this.scrapeButton.disabled = true;

      let productLinks = allProducts;

      // Apply price filter
      if (usePriceFilter) {
        productLinks = productLinks.filter(p => {
          // Correct selector for Yami category pages
          const priceElement = p.element?.querySelector('.item-card__price-info .price-normal.price-valid.word-bold-price') ||
                              p.element?.querySelector('.price-normal.price-valid.word-bold-price') ||
                              p.element?.querySelector('.price-valid');
          const priceText = priceElement?.textContent?.trim();
          const price = YamiDOMHelpers.parsePrice(priceText);
          return price !== null && price > 0 && price >= minPrice && price <= maxPrice;
        });
      }

      // Limit to max count
      productLinks = productLinks.slice(0, maxCount);

      if (productLinks.length === 0) {
        throw new Error('No products found matching the filter criteria');
      }

      // Create progress UI
      const progressUI = this.createProgressIndicator(productLinks.length);
      document.body.appendChild(progressUI);

      let stopRequested = false;
      const stopBtn = progressUI.querySelector('#stop-scraping-btn');
      stopBtn.addEventListener('click', () => {
        stopRequested = true;
        stopBtn.textContent = '⏹ Stopping...';
        stopBtn.disabled = true;
        stopBtn.style.background = '#9ca3af';
      });

      let successCount = 0;
      let failCount = 0;
      let skippedCount = 0;
      let processedCount = 0;

      const BATCH_SIZE = 3; // Process 3 products at a time

      for (let batchStart = 0; batchStart < productLinks.length; batchStart += BATCH_SIZE) {
        if (stopRequested) {
          console.log('Yami scraping stopped by user');
          break;
        }

        const batchEnd = Math.min(batchStart + BATCH_SIZE, productLinks.length);
        const batch = productLinks.slice(batchStart, batchEnd);

        const batchPromises = batch.map(link => this.scrapeProductFromLink(link));
        const batchResults = await Promise.allSettled(batchPromises);

        for (let i = 0; i < batchResults.length; i++) {
          processedCount++;
          this.updateProgressIndicator(progressUI, processedCount, productLinks.length, successCount, failCount, skippedCount);

          const result = batchResults[i];

          if (result.status === 'fulfilled' && result.value && result.value.title) {
            const productData = result.value;
            const validation = this.validateProduct(productData);

            if (validation.isValid) {
              const sanitizedData = YamiDataSanitizer.sanitizeProductData(productData);

              try {
                await this.saveProduct(sanitizedData);
                successCount++;
              } catch (error) {
                console.warn('Chrome storage failed, using localStorage:', error);
                this.saveToLocalStorage(sanitizedData);
                successCount++;
              }
            } else {
              skippedCount++;
              console.log(`Skipped product ${productData.asin}:`, validation.errors.join(', '));
            }
          } else {
            failCount++;
            if (result.status === 'rejected') {
              console.error('Error scraping Yami product:', result.reason);
            }
          }
        }

        // Delay between batches
        if (batchEnd < productLinks.length && !stopRequested) {
          await YamiDOMHelpers.sleep(100);
        }
      }

      progressUI.remove();

      // Show results
      const resultParts = [];
      if (stopRequested) {
        resultParts.push(`⏸ Stopped: ${successCount} products scraped`);
      } else {
        resultParts.push(`✅ Scraped ${successCount} products successfully!`);
      }

      if (skippedCount > 0) {
        resultParts.push(`${skippedCount} skipped (no price/unavailable)`);
      }
      if (failCount > 0) {
        resultParts.push(`${failCount} failed`);
      }

      this.showNotification(resultParts.join(' | '), stopRequested ? 'warning' : 'success');
      this.scrapeButton.innerHTML = `✅ Scraped ${successCount}!`;

      setTimeout(() => {
        const newCount = this.getVisibleProductCount();
        this.scrapeButton.innerHTML = `📦 Scrape ${newCount} Items`;
        this.scrapeButton.disabled = false;
      }, 3000);

    } catch (error) {
      console.error('Yami bulk scraping error:', error);
      this.showNotification('❌ Error: ' + error.message, 'error');
      const count = this.getVisibleProductCount();
      this.scrapeButton.innerHTML = `📦 Scrape ${count} Items`;
      this.scrapeButton.disabled = false;
    }
  }

  /**
   * Scrape individual product from link by fetching its page
   * @param {Object} linkData - Product link data {productID, url, element}
   * @returns {Promise<Object>} Product data
   */
  async scrapeProductFromLink(linkData) {
    const { productID, url } = linkData;

    if (!productID) {
      return {
        asin: null,
        url: url,
        scrapedAt: new Date().toISOString(),
        title: 'Error: No product ID',
        price: null,
        deliveryFee: '$4.99',
        images: [],
        description: 'Product ID was undefined',
        bulletPoints: [],
        specifications: {},
        source: 'yami'
      };
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      return YamiDataExtractor.extractFromDocument(doc, productID, url);

    } catch (error) {
      console.error(`Error fetching Yami product ${productID}:`, error);
      return {
        asin: productID,
        url: url,
        scrapedAt: new Date().toISOString(),
        title: `Product ${productID}`,
        price: null,
        deliveryFee: '$4.99', // Always set to 4.99 for Yami products
        images: [],
        description: `Error loading details: ${error.message}`,
        bulletPoints: [],
        specifications: {},
        source: 'yami' // Add source field
      };
    }
  }

  /**
   * Validate product data before saving
   */
  validateProduct(productData) {
    const errors = [];

    if (!productData.asin) {
      errors.push('Could not extract product ID from URL');
    }

    if (!productData.price) {
      errors.push('No price available - item may be out of stock');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Save product to storage
   */
  async saveProduct(productData) {
    return new Promise((resolve, reject) => {
      if (!chrome.runtime?.id) {
        this.saveToLocalStorage(productData);
        resolve();
        return;
      }

      try {
        chrome.storage.local.get(['scrapedProducts'], (result) => {
          const products = result.scrapedProducts || [];

          const existingIndex = products.findIndex(p =>
            p.asin === productData.asin
          );

          if (existingIndex >= 0) {
            products[existingIndex] = productData;
          } else {
            products.push(productData);
          }

          chrome.storage.local.set({ scrapedProducts: products }, () => {
            if (chrome.runtime.lastError) {
              this.saveToLocalStorage(productData);
            }
            resolve();
          });
        });
      } catch (error) {
        this.saveToLocalStorage(productData);
        resolve();
      }
    });
  }

  /**
   * Fallback: save to localStorage
   */
  saveToLocalStorage(productData) {
    try {
      const stored = localStorage.getItem('scrapedProducts');
      const products = stored ? JSON.parse(stored) : [];

      const existingIndex = products.findIndex(p =>
        p.asin === productData.asin
      );

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

  /**
   * Create progress indicator UI
   */
  createProgressIndicator(totalItems) {
    const progressUI = document.createElement('div');
    progressUI.id = 'yami-scraping-progress';
    progressUI.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10004;
      background: white;
      border-radius: 12px;
      padding: 25px 30px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      min-width: 350px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    progressUI.innerHTML = `
      <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">Scraping Yami Products...</h3>
      <div style="margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; color: #666;">
          <span id="progress-text">0 / ${totalItems}</span>
          <span id="progress-percent">0%</span>
        </div>
        <div style="width: 100%; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
          <div id="progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #FF6B6B, #FF8E53); transition: width 0.3s;"></div>
        </div>
      </div>
      <div style="display: flex; gap: 15px; margin-bottom: 15px; font-size: 13px;">
        <div>✅ Success: <span id="success-count">0</span></div>
        <div>⏭ Skipped: <span id="skipped-count">0</span></div>
        <div>❌ Failed: <span id="fail-count">0</span></div>
      </div>
      <button id="stop-scraping-btn" style="width: 100%; padding: 10px; background: #ef4444; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
        ⏹ Stop Scraping
      </button>
    `;

    return progressUI;
  }

  /**
   * Update progress indicator
   */
  updateProgressIndicator(progressUI, current, total, successCount, failCount, skippedCount) {
    const progressText = progressUI.querySelector('#progress-text');
    const progressPercent = progressUI.querySelector('#progress-percent');
    const progressBar = progressUI.querySelector('#progress-bar');
    const successCountElem = progressUI.querySelector('#success-count');
    const failCountElem = progressUI.querySelector('#fail-count');
    const skippedCountElem = progressUI.querySelector('#skipped-count');

    const percent = Math.round((current / total) * 100);

    progressText.textContent = `${current} / ${total}`;
    progressPercent.textContent = `${percent}%`;
    progressBar.style.width = `${percent}%`;
    successCountElem.textContent = successCount;
    failCountElem.textContent = failCount;
    skippedCountElem.textContent = skippedCount;
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10001;
      padding: 16px 24px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
      max-width: 400px;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 5000);
  }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = YamiBulkScraper;
}
