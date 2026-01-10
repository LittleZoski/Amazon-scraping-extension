// Content script that runs on Amazon product pages
// Injects a scrape button and handles product data extraction

class AmazonScraper {
  constructor() {
    this.scrapeButton = null;
    this.primeOnlyMode = false; // Global Prime-only setting
    this.init();
  }

  init() {
    // Load Prime-only setting from storage
    chrome.storage.local.get(['primeOnlyMode'], (result) => {
      this.primeOnlyMode = result.primeOnlyMode || false;
    });

    // Wait for page to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.injectScrapeButton();
        this.checkAddressPage();
      });
    } else {
      this.injectScrapeButton();
      this.checkAddressPage();
    }
  }

  checkAddressPage() {
    // Check if we're on the Amazon addresses page
    if (window.location.href.includes('/a/addresses')) {
      if (window.location.href.includes('/a/addresses/add')) {
        // We're on the add address form page - check if we should auto-fill
        this.checkAndFillAddress();
      } else if (window.location.href.includes('alertId=yaab-enterAddressSucceed')) {
        // Address was successfully added - continue import if in progress
        this.continueImportAfterSuccess();
      } else {
        // We're on the main addresses page - inject import button
        this.injectAddressImportButton();
      }
    }
  }

  continueImportAfterSuccess() {
    // Check if we're in the middle of an import
    const addressesJSON = sessionStorage.getItem('ebayAddressesToImport');
    const currentIndex = parseInt(sessionStorage.getItem('currentAddressIndex') || '0');

    if (!addressesJSON) {
      return; // No import in progress
    }

    const addresses = JSON.parse(addressesJSON);

    if (currentIndex >= addresses.length) {
      // All done!
      sessionStorage.removeItem('ebayAddressesToImport');
      sessionStorage.removeItem('currentAddressIndex');
      this.showNotification('✅ All addresses imported successfully!', 'success');
      return;
    }

    // Continue to next address
    this.showNotification(`Address saved! Loading next address...`, 'success');
    setTimeout(() => {
      window.location.href = 'https://www.amazon.com/a/addresses/add?ref=ebay_import';
    }, 1000);
  }

  injectScrapeButton() {
    // Check if we're on a product page or category/listing page
    const isProduct = this.isProductPage();
    const isCategoryPage = this.isCategoryPage();

    if (!isProduct && !isCategoryPage) {
      return;
    }

    // Create floating scrape button
    this.scrapeButton = document.createElement('button');
    this.scrapeButton.id = 'amazon-scraper-btn';

    if (isProduct) {
      this.scrapeButton.innerHTML = '📦 Scrape for eBay';
    } else {
      // Category page - show bulk scrape option
      const itemCount = this.getVisibleProductCount();
      this.scrapeButton.innerHTML = `📦 Scrape ${itemCount} Items`;
    }

    this.scrapeButton.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 10000;
      padding: 12px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;
    `;

    // Add hover effect
    this.scrapeButton.addEventListener('mouseenter', () => {
      this.scrapeButton.style.transform = 'scale(1.05)';
      this.scrapeButton.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
    });

    this.scrapeButton.addEventListener('mouseleave', () => {
      this.scrapeButton.style.transform = 'scale(1)';
      this.scrapeButton.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
    });

    // Add click handler - bulk scrape for category pages
    if (isCategoryPage) {
      this.scrapeButton.addEventListener('click', () => this.showBulkScrapeSettings());
    } else {
      this.scrapeButton.addEventListener('click', () => this.scrapeProduct());
    }

    document.body.appendChild(this.scrapeButton);
  }

  isProductPage() {
    // Check if URL matches Amazon product page pattern
    const url = window.location.href;
    return url.includes('/dp/') || url.includes('/gp/product/');
  }

  isCategoryPage() {
    // Check if we're on a category/listing page
    const url = window.location.href;
    return url.includes('/s?') ||
           url.includes('/s/') ||
           url.includes('/gp/bestsellers') ||
           url.includes('/zgbs/') ||
           url.includes('/Best-Sellers') ||
           url.includes('/gp/new-releases') ||
           url.includes('/gp/movers-and-shakers') ||
           url.includes('/gp/most-wished-for');
  }

  getVisibleProductCount() {
    // Count visible products on page
    const productSelectors = [
      '[data-asin]:not([data-asin=""])',
      '.s-result-item[data-asin]',
      '.zg-grid-general-faceout',
      '.a-carousel-card'
    ];

    let products = new Set();
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

  showBulkScrapeSettings() {
    // Find all products first
    const allProducts = this.extractProductLinksFromPage();

    if (allProducts.length === 0) {
      this.showNotification('❌ No products found on this page', 'error');
      return;
    }

    // Show settings modal
    const settingsModal = this.createSettingsModal(allProducts);
    document.body.appendChild(settingsModal);
  }

  createSettingsModal(allProducts) {
    // Extract price and Prime info from products
    const productsWithMetadata = allProducts.map(p => {
      const priceText = p.element?.querySelector('.a-price .a-offscreen, .a-price-whole, ._cDEzb_p13n-sc-price_3mJ9Z')?.textContent?.trim();
      const price = this.parsePrice(priceText);
      const isPrime = this.checkPrimeEligibilityFromElement(p.element);
      return { ...p, price, priceText, isPrime };
    });

    const productsWithPrices = productsWithMetadata.filter(p => p.price > 0);
    const primeProducts = productsWithMetadata.filter(p => p.isPrime);

    const prices = productsWithPrices.map(p => p.price);
    const minPrice = prices.length > 0 ? Math.floor(Math.min(...prices)) : 0;
    const maxPrice = prices.length > 0 ? Math.ceil(Math.max(...prices)) : 100;

    const modal = document.createElement('div');
    modal.id = 'scraper-settings-modal';
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
            <span style="color: #667eea; font-weight: 600; font-size: 16px;">${allProducts.length}</span>
          </div>

          <div style="margin: 20px 0;">
            <label style="display: block; color: #666; font-size: 14px; margin-bottom: 10px;">
              Number to Scrape: <span id="count-value" style="color: #667eea; font-weight: 600;">${allProducts.length}</span>
            </label>
            <input
              type="range"
              id="scrape-count-slider"
              min="1"
              max="${allProducts.length}"
              value="${allProducts.length}"
              style="width: 100%; height: 6px; border-radius: 3px; background: #e0e0e0; outline: none; -webkit-appearance: none;"
            >
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
              <input
                type="range"
                id="min-price-slider"
                min="${minPrice}"
                max="${maxPrice}"
                value="${minPrice}"
                style="width: 100%; height: 6px; border-radius: 3px; background: #e0e0e0; outline: none; -webkit-appearance: none;"
              >
            </div>

            <div style="margin-bottom: 15px;">
              <label style="display: block; color: #666; font-size: 13px; margin-bottom: 8px;">
                Max Price: $<span id="max-price-value">${maxPrice}</span>
              </label>
              <input
                type="range"
                id="max-price-slider"
                min="${minPrice}"
                max="${maxPrice}"
                value="${maxPrice}"
                style="width: 100%; height: 6px; border-radius: 3px; background: #e0e0e0; outline: none; -webkit-appearance: none;"
              >
            </div>

            <div style="font-size: 13px; color: #666; padding: 10px; background: white; border-radius: 6px;">
              <span id="filtered-count">${allProducts.length}</span> products match filters
            </div>
          </div>
        </div>

        <div style="margin-bottom: 25px; padding: 20px; background: #e8f4fd; border-radius: 8px; border: 2px solid #3b82f6;">
          <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="checkbox" id="prime-only-filter" style="margin-right: 10px; width: 18px; height: 18px; cursor: pointer;">
            <span style="color: #1e40af; font-weight: 600; display: flex; align-items: center;">
              <span style="font-size: 18px; margin-right: 5px;">📦</span>
              Prime Only (Skip non-Prime items)
            </span>
          </label>
          <p style="margin: 10px 0 0 28px; font-size: 12px; color: #666;">
            Only scrape products eligible for Amazon Prime shipping
          </p>
          <div id="prime-filter-info" style="margin: 10px 0 0 28px; font-size: 13px; color: #1e40af; padding: 10px; background: white; border-radius: 6px; display: none;">
            <span id="prime-count">${primeProducts.length}</span> Prime products found
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 25px;">
          <button id="start-scrape-btn" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 15px;">
            Start Scraping
          </button>
          <button id="cancel-scrape-btn" style="flex: 1; padding: 12px; background: #e0e0e0; color: #666; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 15px;">
            Cancel
          </button>
        </div>
      </div>
    `;

    // Add event listeners
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

    // Count slider
    countSlider.addEventListener('input', (e) => {
      countValue.textContent = e.target.value;
    });

    // Price filter toggle
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

    // Price sliders
    const updateFilteredCount = () => {
      const minPrice = parseInt(minPriceSlider.value);
      const maxPrice = parseInt(maxPriceSlider.value);
      const primeOnly = primeOnlyFilter.checked;

      let filtered = productsWithMetadata;

      // Apply price filter if enabled
      if (enablePriceFilter.checked) {
        filtered = filtered.filter(p => p.price >= minPrice && p.price <= maxPrice);
      }

      // Apply Prime filter if enabled
      if (primeOnly) {
        filtered = filtered.filter(p => p.isPrime);
      }

      filteredCount.textContent = filtered.length;
    };

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

    // Get Prime filter reference
    const primeOnlyFilter = modal.querySelector('#prime-only-filter');
    const primeFilterInfo = modal.querySelector('#prime-filter-info');
    const primeCount = modal.querySelector('#prime-count');

    // Prime filter toggle
    primeOnlyFilter.addEventListener('change', (e) => {
      if (e.target.checked) {
        primeFilterInfo.style.display = 'block';
      } else {
        primeFilterInfo.style.display = 'none';
      }
      updateFilteredCount();
    });

    // Start button
    startBtn.addEventListener('click', () => {
      const count = parseInt(countSlider.value);
      const usePriceFilter = enablePriceFilter.checked;
      const minPrice = parseInt(minPriceSlider.value);
      const maxPrice = parseInt(maxPriceSlider.value);
      const primeOnly = primeOnlyFilter.checked;

      modal.remove();
      this.bulkScrapeFromPage(allProducts, count, usePriceFilter, minPrice, maxPrice, primeOnly);
    });

    // Cancel button
    cancelBtn.addEventListener('click', () => {
      modal.remove();
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    return modal;
  }

  parsePrice(priceText) {
    if (!priceText) return 0;
    const cleaned = priceText.replace(/[^0-9.]/g, '');
    const price = parseFloat(cleaned);
    return isNaN(price) ? 0 : price;
  }

  async bulkScrapeFromPage(allProducts, maxCount, usePriceFilter, minPrice, maxPrice, primeOnly = false) {
    try {
      this.scrapeButton.innerHTML = '⏳ Filtering...';
      this.scrapeButton.disabled = true;

      // Store primeOnly for use in validation
      this.primeOnlyMode = primeOnly;

      // Apply filters
      let productLinks = allProducts;

      // Filter by price if enabled
      if (usePriceFilter) {
        productLinks = productLinks.filter(p => {
          const priceElement = p.element?.querySelector('.a-price .a-offscreen, .a-price-whole, ._cDEzb_p13n-sc-price_3mJ9Z');
          const priceText = priceElement?.textContent?.trim();
          const price = this.parsePrice(priceText);
          return price >= minPrice && price <= maxPrice;
        });
      }

      // Limit to max count
      productLinks = productLinks.slice(0, maxCount);

      if (productLinks.length === 0) {
        throw new Error('No products found matching the filter criteria');
      }

      // Create progress indicator UI
      const progressUI = this.createProgressIndicator(productLinks.length);
      document.body.appendChild(progressUI);

      // Add stop button handler
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

      // Process products in parallel batches for faster scraping
      const BATCH_SIZE = 3; // Scrape 3 products at once

      for (let batchStart = 0; batchStart < productLinks.length; batchStart += BATCH_SIZE) {
        // Check if stop was requested
        if (stopRequested) {
          console.log('Scraping stopped by user');
          break;
        }

        const batchEnd = Math.min(batchStart + BATCH_SIZE, productLinks.length);
        const batch = productLinks.slice(batchStart, batchEnd);

        // Process batch in parallel
        const batchPromises = batch.map(link => this.scrapeProductFromLink(link));
        const batchResults = await Promise.allSettled(batchPromises);

        // Process results
        for (let i = 0; i < batchResults.length; i++) {
          processedCount++;
          this.updateProgressIndicator(progressUI, processedCount, productLinks.length, successCount, failCount, skippedCount);

          const result = batchResults[i];

          if (result.status === 'fulfilled' && result.value && result.value.title) {
            const productData = result.value;

            // Validate product (pass primeOnly flag)
            const validation = this.validateProductFromDoc(productData, this.primeOnlyMode);

            if (validation.isValid) {
              // Sanitize data before saving
              const sanitizedData = this.sanitizeProductData(productData);

              // Use localStorage as fallback to prevent data loss on extension reload
              try {
                await this.saveProduct(sanitizedData);
                successCount++;
              } catch (error) {
                // If chrome.storage fails, save to localStorage as backup
                console.warn('chrome.storage failed, using localStorage:', error);
                this.saveToLocalStorage(sanitizedData);
                successCount++;
              }
            } else {
              // Product failed validation - skip it
              skippedCount++;
              console.log(`Skipped product ${productData.asin}:`, validation.errors.join(', '));
            }
          } else {
            failCount++;
            if (result.status === 'rejected') {
              console.error('Error scraping product:', result.reason);
            }
          }
        }

        // Small delay between batches to avoid overwhelming Amazon
        if (batchEnd < productLinks.length && !stopRequested) {
          await this.sleep(100);
        }
      }

      // Remove progress UI
      progressUI.remove();

      // Show results
      const resultParts = [];
      if (stopRequested) {
        resultParts.push(`⏸ Stopped: ${successCount} products scraped`);
      } else {
        resultParts.push(`✅ Scraped ${successCount} products successfully!`);
      }

      if (skippedCount > 0) {
        resultParts.push(`${skippedCount} skipped (no price/unavailable/non-Prime)`);
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
      console.error('Bulk scraping error:', error);
      this.showNotification('❌ Error: ' + error.message, 'error');
      const count = this.getVisibleProductCount();
      this.scrapeButton.innerHTML = `📦 Scrape ${count} Items`;
      this.scrapeButton.disabled = false;
    }
  }

  createProgressIndicator(total) {
    const progressContainer = document.createElement('div');
    progressContainer.id = 'amazon-scraper-progress';
    progressContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10002;
      background: white;
      border-radius: 12px;
      padding: 25px 30px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      min-width: 350px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    progressContainer.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 24px; margin-bottom: 10px;">📦</div>
        <div style="font-size: 18px; font-weight: 600; color: #333;">Scraping Products</div>
      </div>

      <div style="margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; color: #666;">
          <span id="progress-text">0 / ${total}</span>
          <span id="progress-percent">0%</span>
        </div>
        <div style="background: #e0e0e0; border-radius: 10px; height: 20px; overflow: hidden;">
          <div id="progress-bar" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 100%; width: 0%; transition: width 0.3s ease;"></div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-around; font-size: 13px; color: #666;">
        <div>
          <span style="color: #10b981; font-weight: 600;" id="success-count">0</span> Success
        </div>
        <div>
          <span style="color: #f59e0b; font-weight: 600;" id="skipped-count">0</span> Skipped
        </div>
        <div>
          <span style="color: #ef4444; font-weight: 600;" id="fail-count">0</span> Failed
        </div>
      </div>

      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
        <div style="font-size: 12px; color: #999; text-align: center; margin-bottom: 15px;">
          Currently scraping: <span id="current-item" style="color: #667eea; font-weight: 500;">Product 0</span>
        </div>
        <button id="stop-scraping-btn" style="width: 100%; padding: 10px; background: #ef4444; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px; transition: all 0.2s;">
          ⏸ Stop Scraping
        </button>
      </div>
    `;

    // Add hover effect to stop button
    const stopBtn = progressContainer.querySelector('#stop-scraping-btn');
    stopBtn.addEventListener('mouseenter', () => {
      stopBtn.style.background = '#dc2626';
      stopBtn.style.transform = 'scale(1.02)';
    });
    stopBtn.addEventListener('mouseleave', () => {
      stopBtn.style.background = '#ef4444';
      stopBtn.style.transform = 'scale(1)';
    });

    return progressContainer;
  }

  updateProgressIndicator(progressUI, current, total, successCount, failCount, skippedCount = 0) {
    const percent = Math.round((current / total) * 100);

    progressUI.querySelector('#progress-text').textContent = `${current} / ${total}`;
    progressUI.querySelector('#progress-percent').textContent = `${percent}%`;
    progressUI.querySelector('#progress-bar').style.width = `${percent}%`;
    progressUI.querySelector('#success-count').textContent = successCount;
    progressUI.querySelector('#skipped-count').textContent = skippedCount;
    progressUI.querySelector('#fail-count').textContent = failCount;
    progressUI.querySelector('#current-item').textContent = `Product ${current}`;
  }

  sanitizeProductData(productData) {
    // Create a deep copy to avoid modifying original
    const sanitized = JSON.parse(JSON.stringify(productData));

    // Sanitize title
    if (sanitized.title) {
      sanitized.title = this.removeAmazonBranding(sanitized.title);
    }

    // Sanitize description
    if (sanitized.description) {
      sanitized.description = this.removeAmazonBranding(sanitized.description);
    }

    // Sanitize bullet points
    if (sanitized.bulletPoints && Array.isArray(sanitized.bulletPoints)) {
      sanitized.bulletPoints = sanitized.bulletPoints.map(bullet =>
        this.removeAmazonBranding(bullet)
      );
    }

    // Sanitize specifications (values only, keep keys)
    if (sanitized.specifications && typeof sanitized.specifications === 'object') {
      Object.keys(sanitized.specifications).forEach(key => {
        sanitized.specifications[key] = this.removeAmazonBranding(sanitized.specifications[key]);
      });
    }

    // Remove Amazon URL from product URL (keep ASIN for reference)
    // We keep the URL field but mark it as sanitized
    if (sanitized.url) {
      sanitized.originalAmazonUrl = sanitized.url; // Keep for reference
      sanitized.url = `Product ASIN: ${sanitized.asin}`; // Replace with neutral text
    }

    return sanitized;
  }

  removeAmazonBranding(text) {
    if (!text || typeof text !== 'string') return text;

    // Patterns to remove/replace
    const patterns = [
      // Amazon brand mentions
      { pattern: /\bAmazon\.com\b/gi, replacement: '' },
      { pattern: /\bAmazon\b/gi, replacement: '' },
      { pattern: /\bAMZ\b/gi, replacement: '' },
      { pattern: /\bamzn\b/gi, replacement: '' },

      // Amazon-specific terms
      { pattern: /Amazon Prime/gi, replacement: '' },
      { pattern: /Prime eligible/gi, replacement: '' },
      { pattern: /Amazon's Choice/gi, replacement: '' },
      { pattern: /Amazon Basics/gi, replacement: 'Basic' },

      // Amazon services
      { pattern: /Amazon\.com Gift Card/gi, replacement: 'Gift Card' },
      { pattern: /Ships from Amazon/gi, replacement: '' },
      { pattern: /Sold by Amazon/gi, replacement: '' },
      { pattern: /Fulfilled by Amazon/gi, replacement: '' },
      { pattern: /\bFBA\b/gi, replacement: '' },

      // URLs (except in image URLs which we keep)
      { pattern: /https?:\/\/(www\.)?amazon\.[a-z.]+\/[^\s]*/gi, replacement: '' },
      { pattern: /www\.amazon\.[a-z]+/gi, replacement: '' },

      // Clean up extra spaces and punctuation left behind
      { pattern: /\s+/g, replacement: ' ' },
      { pattern: /\s,/g, replacement: ',' },
      { pattern: /\s\./g, replacement: '.' },
      { pattern: /^\s+|\s+$/g, replacement: '' }, // trim
    ];

    let sanitized = text;

    patterns.forEach(({ pattern, replacement }) => {
      sanitized = sanitized.replace(pattern, replacement);
    });

    return sanitized;
  }

  extractProductLinksFromPage() {
    const productLinks = [];
    const seenAsins = new Set();

    // Different selectors for different Amazon page types
    const selectors = [
      // Search results
      '[data-asin]:not([data-asin=""]) h2 a',
      '[data-asin]:not([data-asin=""]) .a-link-normal[href*="/dp/"]',

      // Best sellers / New releases
      '.zg-grid-general-faceout a[href*="/dp/"]',
      '.zg-item-immersion a[href*="/dp/"]',

      // General product links
      'a[href*="/dp/"]'
    ];

    selectors.forEach(selector => {
      const links = document.querySelectorAll(selector);

      links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;

        // Extract ASIN from URL
        const asinMatch = href.match(/\/dp\/([A-Z0-9]{10})/);
        if (asinMatch && !seenAsins.has(asinMatch[1])) {
          seenAsins.add(asinMatch[1]);

          // Get basic info from the listing
          const listingElement = link.closest('[data-asin]') || link.closest('.s-result-item') || link.closest('.zg-grid-general-faceout');

          productLinks.push({
            asin: asinMatch[1],
            url: href.startsWith('http') ? href : `https://www.amazon.com${href}`,
            element: listingElement
          });
        }
      });
    });

    return productLinks;
  }

  async scrapeProductFromLink(linkData) {
    // Deep scrape: Fetch the product page and extract full details
    const { asin, url } = linkData;

    try {
      // Fetch the product page HTML
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();

      // Create a temporary DOM parser
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Now extract full product data from the fetched page
      const productData = {
        asin: asin,
        url: url,
        scrapedAt: new Date().toISOString(),
        title: this.extractTitleFromDoc(doc),
        price: this.extractPriceFromDoc(doc),
        deliveryFee: this.extractDeliveryFeeFromDoc(doc),
        isPrime: this.extractPrimeEligibilityFromDoc(doc),
        images: this.extractImagesFromDoc(doc),
        description: this.extractDescriptionFromDoc(doc),
        bulletPoints: this.extractBulletPointsFromDoc(doc),
        specifications: this.extractSpecificationsFromDoc(doc)
      };

      return productData;

    } catch (error) {
      console.error(`Error fetching product ${asin}:`, error);

      // Fallback to basic data if fetch fails
      return {
        asin: asin,
        url: url,
        scrapedAt: new Date().toISOString(),
        title: `Product ${asin}`,
        price: null,
        deliveryFee: null,
        isPrime: false,
        images: [],
        description: `Error loading details: ${error.message}`,
        bulletPoints: [],
        specifications: {}
      };
    }
  }

  // Helper methods for extracting data from fetched HTML document
  extractTitleFromDoc(doc) {
    const selectors = ['#productTitle', '#title', 'h1.a-size-large'];
    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) return element.textContent.trim();
    }
    return null;
  }

  extractPriceFromDoc(doc) {
    // PRIORITY 1: Try to get "Typical Price" or "List Price" (for eBay reselling)
    const typicalPriceSelectors = [
      // Typical price selectors
      'span.a-price[data-a-color="secondary"] .a-offscreen',
      '.a-price.a-text-price .a-offscreen',
      'span:contains("Typical price") + .a-price .a-offscreen',
      'span:contains("List Price") + .a-price .a-offscreen',
      // Look for strikethrough prices (usually the original price)
      '.a-text-price .a-offscreen'
    ];

    for (const selector of typicalPriceSelectors) {
      const elements = doc.querySelectorAll(selector);
      for (const element of elements) {
        const priceText = element.textContent.trim();
        // Make sure it's a valid price and not a unit price
        if (priceText.includes('$') && /\$\d+\.\d{2}/.test(priceText)) {
          // Check more thoroughly for unit pricing indicators
          if (!this.isUnitPriceText(priceText, element)) {
            return priceText;
          }
        }
      }
    }

    // PRIORITY 2: Check for explicit "Typical:" or "List:" labels
    const textContent = doc.body.textContent;
    const typicalMatch = textContent.match(/Typical\s*price:\s*\$(\d+\.\d{2})/i);
    if (typicalMatch) {
      return '$' + typicalMatch[1];
    }
    const listMatch = textContent.match(/List\s*Price:\s*\$(\d+\.\d{2})/i);
    if (listMatch) {
      return '$' + listMatch[1];
    }

    // PRIORITY 3: Fall back to current price if no typical/list price found
    const selectors = [
      // Modern Amazon price selectors (2024-2025) - in priority order
      '.a-price[data-a-size="xl"]',
      '.a-price[data-a-size="large"]',
      '.a-price'
    ];

    // First, try to find price containers and check if they contain unit pricing
    for (const selector of selectors) {
      const priceContainers = doc.querySelectorAll(selector);

      for (const container of priceContainers) {
        // Skip if this is a unit price container
        if (this.isUnitPriceContainerFromDoc(container)) {
          continue;
        }

        // Get the actual price from .a-offscreen within this container
        const offscreenPrice = container.querySelector('.a-offscreen');
        if (offscreenPrice && offscreenPrice.textContent.trim()) {
          const priceText = offscreenPrice.textContent.trim();
          if ((priceText.includes('$') || /\d/.test(priceText)) && !this.isUnitPriceText(priceText, offscreenPrice)) {
            return priceText;
          }
        }

        // Fallback to .a-price-whole
        const wholePrice = container.querySelector('.a-price-whole');
        if (wholePrice && wholePrice.textContent.trim()) {
          const priceText = wholePrice.textContent.trim();
          if (/\d/.test(priceText) && !this.isUnitPriceText('$' + priceText, wholePrice)) {
            return '$' + priceText;
          }
        }
      }
    }

    // Legacy fallback selectors
    const legacySelectors = [
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '#price_inside_buybox'
    ];

    for (const selector of legacySelectors) {
      const element = doc.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  isUnitPriceContainerFromDoc(priceContainer) {
    // Same logic as isUnitPriceContainer but for parsed documents
    const containerText = priceContainer.textContent || '';
    const parentText = priceContainer.parentElement?.textContent || '';

    const unitPatterns = [
      /\$[\d.]+\s*\/\s*(fl\.?\s*oz|fluid\s*ounce|ounce|oz|count|each|lb|pound|kg|gram|item|piece)/i,
      /\(\$[\d.]+\s*\/\s*(fl\.?\s*oz|fluid\s*ounce|ounce|oz|count|each|lb|pound|kg|gram|item|piece)\)/i,
      /per\s+(fl\.?\s*oz|fluid\s*ounce|ounce|oz|count|each|lb|pound|kg|gram|item|piece)/i
    ];

    const textToCheck = containerText + ' ' + parentText;
    return unitPatterns.some(pattern => pattern.test(textToCheck));
  }

  extractDeliveryFeeFromDoc(doc) {
    const selectors = [
      // Modern delivery/shipping selectors
      '#deliveryMessageMirId span[data-csa-c-delivery-price]',
      '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE .a-color-success',
      '#mir-layout-DELIVERY_BLOCK-slot-SECONDARY_DELIVERY_MESSAGE_LARGE',
      // Shipping price
      '#ourprice_shippingmessage',
      '#price-shipping-message',
      '#price_shipping_message',
      // Delivery block
      '#delivery-message',
      '#ddmDeliveryMessage',
      // Free delivery indicators
      '#fulfillerInfoFeature_feature_div .a-color-success',
      '#deliveryBlockMessage',
      // Alternative selectors
      '[data-feature-name="delivery"] .a-color-price',
      '#buybox-see-all-buying-choices span.a-color-secondary'
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();

        // Check for "FREE" delivery/shipping
        if (text.match(/free\s+(delivery|shipping)/i)) {
          return 'FREE';
        }

        // Check for delivery price (e.g., "$5.99 delivery", "+ $3.50 shipping")
        const priceMatch = text.match(/[\+]?\s*\$[\d.]+/);
        if (priceMatch) {
          return priceMatch[0].trim();
        }
      }
    }

    // Check for Prime badge (usually means free delivery)
    const primeElement = doc.querySelector('#priceBadging_feature_div, .prime-logo, [aria-label*="Prime"]');
    if (primeElement) {
      const primeText = primeElement.textContent || primeElement.getAttribute('aria-label') || '';
      if (primeText.match(/prime/i)) {
        return 'FREE (Prime)';
      }
    }

    return null;
  }

  extractPrimeEligibilityFromDoc(doc) {
    // Check for Prime badge/logo in parsed document
    const primeSelectors = [
      '#priceBadging_feature_div [aria-label*="Prime"]',
      '.prime-logo',
      'i.a-icon-prime',
      '[data-testid*="prime"]',
      '#deliveryMessageMirId [aria-label*="Prime"]',
      '#mir-layout-DELIVERY_BLOCK [aria-label*="Prime"]'
    ];

    for (const selector of primeSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const text = element.textContent || element.getAttribute('aria-label') || '';
        if (text.match(/prime/i)) {
          return true;
        }
      }
    }

    // Check delivery message for "Prime"
    const deliverySelectors = [
      '#deliveryMessageMirId',
      '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE'
    ];

    for (const selector of deliverySelectors) {
      const element = doc.querySelector(selector);
      if (element && element.textContent.match(/prime/i)) {
        return true;
      }
    }

    return false;
  }

  extractImagesFromDoc(doc) {
    const images = [];
    const mainImage = doc.querySelector('#landingImage, #imgBlkFront');
    if (mainImage) {
      const src = mainImage.getAttribute('data-old-hires') || mainImage.getAttribute('src');
      if (src) images.push(src);
    }

    const thumbnails = doc.querySelectorAll('#altImages img, .imageThumbnail img');
    thumbnails.forEach(img => {
      const src = img.getAttribute('src');
      if (src && !images.includes(src)) {
        const highRes = src.replace(/\._.*_\./, '.');
        images.push(highRes);
      }
    });

    return images.slice(0, 10);
  }

  extractDescriptionFromDoc(doc) {
    const selectors = ['#productDescription p', '#feature-bullets', '.a-section.a-spacing-medium'];
    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) return element.textContent.trim();
    }
    return '';
  }

  extractBulletPointsFromDoc(doc) {
    const bullets = [];
    const bulletElements = doc.querySelectorAll('#feature-bullets li, #featurebullets_feature_div li');
    bulletElements.forEach(li => {
      const text = li.textContent.trim();
      if (text && text.length > 0) {
        bullets.push(text);
      }
    });
    return bullets;
  }

  extractSpecificationsFromDoc(doc) {
    const specs = {};
    const specTables = doc.querySelectorAll('#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr');
    specTables.forEach(row => {
      const th = row.querySelector('th');
      const td = row.querySelector('td');
      if (th && td) {
        specs[th.textContent.trim()] = td.textContent.trim();
      }
    });
    return specs;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async scrapeProduct() {
    try {
      // Change button state
      this.scrapeButton.innerHTML = '⏳ Scraping...';
      this.scrapeButton.disabled = true;

      const productData = this.extractProductData();

      if (!productData.title) {
        throw new Error('Could not extract product information');
      }

      // Validate product before saving (use global primeOnlyMode setting)
      const validation = this.validateProduct(productData, this.primeOnlyMode);
      if (!validation.isValid) {
        // Show popup with validation errors
        const errorMessage = '❌ Cannot scrape this product:\n\n' + validation.errors.join('\n\n');
        alert(errorMessage);

        this.scrapeButton.innerHTML = '📦 Scrape for eBay';
        this.scrapeButton.disabled = false;
        return;
      }

      // Sanitize data before saving
      const sanitizedData = this.sanitizeProductData(productData);

      // Save to storage
      await this.saveProduct(sanitizedData);

      // Show success
      this.showNotification('✅ Product scraped successfully!', 'success');
      this.scrapeButton.innerHTML = '✅ Scraped!';

      setTimeout(() => {
        this.scrapeButton.innerHTML = '📦 Scrape for eBay';
        this.scrapeButton.disabled = false;
      }, 2000);

    } catch (error) {
      console.error('Scraping error:', error);
      this.showNotification('❌ Error scraping product: ' + error.message, 'error');
      this.scrapeButton.innerHTML = '📦 Scrape for eBay';
      this.scrapeButton.disabled = false;
    }
  }

  extractProductData() {
    const data = {
      asin: this.getASIN(),
      title: this.getTitle(),
      price: this.getPrice(),
      deliveryFee: this.getDeliveryFee(),
      images: this.getImages(),
      description: this.getDescription(),
      bulletPoints: this.getBulletPoints(),
      specifications: this.getSpecifications(),
      url: window.location.href,
      scrapedAt: new Date().toISOString()
    };

    return data;
  }

  getASIN() {
    // Extract ASIN from URL or page
    const urlMatch = window.location.href.match(/\/dp\/([A-Z0-9]{10})/);
    if (urlMatch) return urlMatch[1];

    const asinInput = document.querySelector('input[name="ASIN"]');
    if (asinInput) return asinInput.value;

    return null;
  }

  getTitle() {
    const selectors = [
      '#productTitle',
      '#title',
      'h1.a-size-large'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  getPrice() {
    // PRIORITY 1: Try to get "Typical Price" or "List Price" (for eBay reselling)
    const typicalPriceSelectors = [
      // Typical price selectors
      'span.a-price[data-a-color="secondary"] .a-offscreen',
      '.a-price.a-text-price .a-offscreen',
      'span:contains("Typical price") + .a-price .a-offscreen',
      'span:contains("List Price") + .a-price .a-offscreen',
      // Look for strikethrough prices (usually the original price)
      '.a-text-price .a-offscreen'
    ];

    for (const selector of typicalPriceSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const priceText = element.textContent.trim();
        // Make sure it's a valid price and not a unit price
        if (priceText.includes('$') && /\$\d+\.\d{2}/.test(priceText)) {
          // Check more thoroughly for unit pricing indicators
          if (!this.isUnitPriceText(priceText, element)) {
            return priceText;
          }
        }
      }
    }

    // PRIORITY 2: Check for explicit "Typical:" or "List:" labels in page text
    const pageText = document.body.textContent;
    const typicalMatch = pageText.match(/Typical\s*price:\s*\$(\d+\.\d{2})/i);
    if (typicalMatch) {
      return '$' + typicalMatch[1];
    }
    const listMatch = pageText.match(/List\s*Price:\s*\$(\d+\.\d{2})/i);
    if (listMatch) {
      return '$' + listMatch[1];
    }

    // PRIORITY 3: Fall back to current price if no typical/list price found
    const selectors = [
      // Modern Amazon price selectors (2024-2025) - in priority order
      '.a-price[data-a-size="xl"]',
      '.a-price[data-a-size="large"]',
      '.a-price'
    ];

    // First, try to find price containers and check if they contain unit pricing
    for (const selector of selectors) {
      const priceContainers = document.querySelectorAll(selector);

      for (const container of priceContainers) {
        // Skip if this is a unit price container
        if (this.isUnitPriceContainer(container)) {
          continue;
        }

        // Get the actual price from .a-offscreen within this container
        const offscreenPrice = container.querySelector('.a-offscreen');
        if (offscreenPrice && offscreenPrice.textContent.trim()) {
          const priceText = offscreenPrice.textContent.trim();
          if ((priceText.includes('$') || /\d/.test(priceText)) && !this.isUnitPriceText(priceText, offscreenPrice)) {
            return priceText;
          }
        }

        // Fallback to .a-price-whole
        const wholePrice = container.querySelector('.a-price-whole');
        if (wholePrice && wholePrice.textContent.trim()) {
          const priceText = wholePrice.textContent.trim();
          if (/\d/.test(priceText) && !this.isUnitPriceText('$' + priceText, wholePrice)) {
            return '$' + priceText;
          }
        }
      }
    }

    // Legacy fallback selectors
    const legacySelectors = [
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '#price_inside_buybox'
    ];

    for (const selector of legacySelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  isUnitPriceText(priceText, element) {
    // Check if the price text itself or surrounding context indicates it's a unit price

    // Check the price text directly
    const unitPricePatterns = [
      /\$[\d.,]+\s*(per|\/)\s*(fl\.?\s*oz|fluid\s*ounce|ounce|oz|count|each|lb|pound|kg|gram|item|piece)/i,
      /\(\$[\d.,]+\s*\/\s*(fl\.?\s*oz|fluid\s*ounce|ounce|oz|count|each|lb|pound|kg|gram|item|piece)\)/i
    ];

    if (unitPricePatterns.some(pattern => pattern.test(priceText))) {
      return true;
    }

    // Check surrounding context (parent and nearby text)
    if (element) {
      const parent = element.parentElement;
      const grandparent = parent?.parentElement;

      // Check up to 3 levels of parent elements
      const contextTexts = [
        element.textContent || '',
        parent?.textContent || '',
        grandparent?.textContent || '',
        grandparent?.parentElement?.textContent || ''
      ];

      for (const context of contextTexts) {
        // Look for "per ounce", "per count", etc. in the surrounding text
        if (/per\s+(fl\.?\s*oz|fluid\s*ounce|ounce|oz|count|each|lb|pound|kg|gram|item|piece)/i.test(context)) {
          // Make sure the price we found is actually associated with this unit pricing
          if (context.includes(priceText)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  isUnitPriceContainer(priceContainer) {
    // Check the container and its parent for unit price indicators
    const containerText = priceContainer.textContent || '';
    const parentText = priceContainer.parentElement?.textContent || '';

    // Look for text patterns that indicate unit pricing
    const unitPatterns = [
      /\$[\d.]+\s*\/\s*(fl\.?\s*oz|fluid\s*ounce|ounce|oz|count|each|lb|pound|kg|gram|item|piece)/i,
      /\(\$[\d.]+\s*\/\s*(fl\.?\s*oz|fluid\s*ounce|ounce|oz|count|each|lb|pound|kg|gram|item|piece)\)/i,
      /per\s+(fl\.?\s*oz|fluid\s*ounce|ounce|oz|count|each|lb|pound|kg|gram|item|piece)/i
    ];

    // Check if container or parent contains unit price text
    const textToCheck = containerText + ' ' + parentText;
    return unitPatterns.some(pattern => pattern.test(textToCheck));
  }

  checkPrimeEligibilityFromElement(element) {
    // Check for Prime badge/logo within a product listing element
    if (!element) return false;

    const primeSelectors = [
      'i.a-icon-prime',
      '.a-icon-prime',
      '[aria-label*="Prime"]',
      '.s-prime',
      'i[aria-label*="Prime"]',
      'span.a-icon-prime-logo'
    ];

    for (const selector of primeSelectors) {
      const primeElement = element.querySelector(selector);
      if (primeElement) {
        const text = primeElement.textContent || primeElement.getAttribute('aria-label') || '';
        if (text.match(/prime/i) || primeElement.className.includes('prime')) {
          return true;
        }
      }
    }

    // Check for "FREE delivery" or "FREE Shipping" text which often indicates Prime
    const deliveryText = element.textContent || '';
    if (deliveryText.match(/FREE.*delivery/i) || deliveryText.match(/FREE.*shipping/i)) {
      // Additional check: make sure it's not just "FREE returns"
      if (!deliveryText.match(/FREE.*returns/i) || deliveryText.match(/Prime/i)) {
        return true;
      }
    }

    return false;
  }

  isPrimeEligible() {
    // Check for Prime badge/logo
    const primeSelectors = [
      '#priceBadging_feature_div [aria-label*="Prime"]',
      '.prime-logo',
      'i.a-icon-prime',
      '[data-testid*="prime"]',
      'span:contains("Prime")',
      '#deliveryMessageMirId [aria-label*="Prime"]',
      '#mir-layout-DELIVERY_BLOCK [aria-label*="Prime"]'
    ];

    for (const selector of primeSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent || element.getAttribute('aria-label') || '';
        if (text.match(/prime/i)) {
          return true;
        }
      }
    }

    // Check delivery message for "FREE delivery" with Prime
    const deliverySelectors = [
      '#deliveryMessageMirId',
      '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE'
    ];

    for (const selector of deliverySelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent || '';
        if (text.match(/prime/i)) {
          return true;
        }
      }
    }

    return false;
  }

  getDeliveryFee() {
    const selectors = [
      // Modern delivery/shipping selectors
      '#deliveryMessageMirId span[data-csa-c-delivery-price]',
      '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE .a-color-success',
      '#mir-layout-DELIVERY_BLOCK-slot-SECONDARY_DELIVERY_MESSAGE_LARGE',
      // Shipping price
      '#ourprice_shippingmessage',
      '#price-shipping-message',
      '#price_shipping_message',
      // Delivery block
      '#delivery-message',
      '#ddmDeliveryMessage',
      // Free delivery indicators
      '#fulfillerInfoFeature_feature_div .a-color-success',
      '#deliveryBlockMessage',
      // Alternative selectors
      '[data-feature-name="delivery"] .a-color-price',
      '#buybox-see-all-buying-choices span.a-color-secondary'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();

        // Check for "FREE" delivery/shipping
        if (text.match(/free\s+(delivery|shipping)/i)) {
          return 'FREE';
        }

        // Check for delivery price (e.g., "$5.99 delivery", "+ $3.50 shipping")
        const priceMatch = text.match(/[\+]?\s*\$[\d.]+/);
        if (priceMatch) {
          return priceMatch[0].trim();
        }
      }
    }

    // Check for Prime badge (usually means free delivery)
    const primeElement = document.querySelector('#priceBadging_feature_div, .prime-logo, [aria-label*="Prime"]');
    if (primeElement) {
      const primeText = primeElement.textContent || primeElement.getAttribute('aria-label') || '';
      if (primeText.match(/prime/i)) {
        return 'FREE (Prime)';
      }
    }

    return null;
  }

  getDeliveryDate() {
    const selectors = [
      '#deliveryMessageMirId',
      '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE',
      '#mir-layout-DELIVERY_BLOCK-slot-SECONDARY_DELIVERY_MESSAGE_LARGE',
      '#delivery-message',
      '#ddmDeliveryMessage'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();

        // Look for date patterns like "January 15", "Jan 15", "Monday, January 15"
        const dateMatch = text.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/i);

        if (dateMatch) {
          return dateMatch[0];
        }
      }
    }

    return null;
  }

  calculateDaysUntilDelivery(deliveryDateStr) {
    if (!deliveryDateStr) return null;

    try {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();

      // Parse the delivery date string
      const cleanDate = deliveryDateStr.replace(/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/i, '').trim();
      const deliveryDate = new Date(`${cleanDate}, ${currentYear}`);

      // If the parsed month is earlier than current month, it's probably next year
      if (deliveryDate.getMonth() < currentMonth) {
        deliveryDate.setFullYear(currentYear + 1);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      deliveryDate.setHours(0, 0, 0, 0);

      const diffTime = deliveryDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays;
    } catch (error) {
      console.error('Error parsing delivery date:', error);
      return null;
    }
  }

  validateProduct(productData, primeOnly = false) {
    const errors = [];

    // Check if price exists
    if (!productData.price || productData.price === null || productData.price === '') {
      errors.push('No price available - item may be out of stock');
    }

    // Check delivery date
    const deliveryDate = this.getDeliveryDate();
    if (deliveryDate) {
      const daysUntilDelivery = this.calculateDaysUntilDelivery(deliveryDate);
      if (daysUntilDelivery !== null && daysUntilDelivery > 10) {
        errors.push(`Delivery time too long (${daysUntilDelivery} days) - ships after ${deliveryDate}`);
      }
    }

    // Check Prime eligibility if required
    if (primeOnly && !this.isPrimeEligible()) {
      errors.push('Not eligible for Amazon Prime shipping');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  validateProductFromDoc(productData, primeOnly = false) {
    const errors = [];

    // Check if price exists
    if (!productData.price || productData.price === null || productData.price === '') {
      errors.push('No price available');
    }

    // Check Prime eligibility if required
    if (primeOnly && productData.isPrime === false) {
      errors.push('Not Prime eligible');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  getImages() {
    const images = [];

    // Main image
    const mainImage = document.querySelector('#landingImage, #imgBlkFront');
    if (mainImage) {
      const src = mainImage.getAttribute('data-old-hires') ||
                  mainImage.getAttribute('src');
      if (src) images.push(src);
    }

    // Thumbnail images
    const thumbnails = document.querySelectorAll('#altImages img, .imageThumbnail img');
    thumbnails.forEach(img => {
      const src = img.getAttribute('src');
      if (src && !images.includes(src)) {
        // Try to get higher resolution version
        const highRes = src.replace(/\._.*_\./, '.');
        images.push(highRes);
      }
    });

    return images.slice(0, 10); // Limit to 10 images
  }

  getDescription() {
    const selectors = [
      '#productDescription p',
      '#feature-bullets',
      '.a-section.a-spacing-medium'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return '';
  }

  getBulletPoints() {
    const bullets = [];
    const bulletElements = document.querySelectorAll('#feature-bullets li, #featurebullets_feature_div li');

    bulletElements.forEach(li => {
      const text = li.textContent.trim();
      if (text && text.length > 0) {
        bullets.push(text);
      }
    });

    return bullets;
  }

  getSpecifications() {
    const specs = {};

    // Try to find specification table
    const specTables = document.querySelectorAll('#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr');

    specTables.forEach(row => {
      const th = row.querySelector('th');
      const td = row.querySelector('td');

      if (th && td) {
        const key = th.textContent.trim();
        const value = td.textContent.trim();
        specs[key] = value;
      }
    });

    return specs;
  }

  saveToLocalStorage(productData) {
    try {
      const stored = localStorage.getItem('scrapedProducts');
      const products = stored ? JSON.parse(stored) : [];

      // Check if product already exists (by ASIN)
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

  async saveProduct(productData) {
    return new Promise((resolve, reject) => {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        console.warn('Extension context invalidated, using localStorage');
        this.saveToLocalStorage(productData);
        resolve();
        return;
      }

      try {
        chrome.storage.local.get(['scrapedProducts'], (result) => {
          // Check for extension context invalidation
          if (chrome.runtime.lastError) {
            console.warn('chrome.storage failed, using localStorage:', chrome.runtime.lastError);
            this.saveToLocalStorage(productData);
            resolve();
            return;
          }

          const products = result.scrapedProducts || [];

          // Check if product already exists (by ASIN)
          const existingIndex = products.findIndex(p => p.asin === productData.asin);

          if (existingIndex >= 0) {
            // Update existing product
            products[existingIndex] = productData;
          } else {
            // Add new product
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

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10001;
      padding: 15px 25px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // ========== ADDRESS IMPORT FUNCTIONALITY ==========

  injectAddressImportButton() {
    // Check if button already exists
    if (document.getElementById('ebay-address-import-btn')) {
      return;
    }

    // Create floating import button
    const importButton = document.createElement('button');
    importButton.id = 'ebay-address-import-btn';
    importButton.innerHTML = '📦 Import eBay Addresses';
    importButton.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 10000;
      padding: 12px 20px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;
    `;

    importButton.addEventListener('mouseenter', () => {
      importButton.style.transform = 'scale(1.05)';
      importButton.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
    });

    importButton.addEventListener('mouseleave', () => {
      importButton.style.transform = 'scale(1)';
      importButton.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
    });

    importButton.addEventListener('click', () => this.showAddressImportModal());

    document.body.appendChild(importButton);
  }

  showAddressImportModal() {
    // Create modal for uploading eBay orders JSON
    const modal = document.createElement('div');
    modal.id = 'address-import-modal';
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
        <h2 style="margin: 0 0 20px 0; color: #333; font-size: 24px;">📦 Import eBay Order Addresses</h2>

        <div style="margin-bottom: 20px; padding: 15px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 1.5;">
            Upload your eBay orders JSON file from the <code style="background: white; padding: 2px 6px; border-radius: 3px;">ebay_orders</code> folder.
            This will automatically add shipping addresses to your Amazon account.
          </p>
        </div>

        <div style="margin-bottom: 25px;">
          <label style="display: block; margin-bottom: 10px; font-weight: 600; color: #333;">
            Select eBay Orders JSON File:
          </label>
          <input
            type="file"
            id="ebay-orders-file-input"
            accept=".json,application/json"
            style="width: 100%; padding: 10px; border: 2px dashed #d1d5db; border-radius: 8px; cursor: pointer; font-size: 13px;"
          >
        </div>

        <div id="address-preview" style="display: none; margin-bottom: 20px; max-height: 200px; overflow-y: auto; background: #f9fafb; padding: 15px; border-radius: 8px;">
          <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Addresses to Import:</h3>
          <div id="address-list" style="font-size: 12px; color: #333;"></div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 25px;">
          <button id="start-import-btn" disabled style="flex: 1; padding: 12px; background: #d1d5db; color: #6b7280; border: none; border-radius: 8px; font-weight: 600; cursor: not-allowed; font-size: 15px;">
            Start Import
          </button>
          <button id="cancel-import-btn" style="flex: 1; padding: 12px; background: #e0e0e0; color: #666; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 15px;">
            Cancel
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Setup event listeners
    const fileInput = modal.querySelector('#ebay-orders-file-input');
    const startBtn = modal.querySelector('#start-import-btn');
    const cancelBtn = modal.querySelector('#cancel-import-btn');
    const addressPreview = modal.querySelector('#address-preview');
    const addressList = modal.querySelector('#address-list');

    let ordersData = null;

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        ordersData = JSON.parse(text);

        // Extract unique addresses
        const addresses = this.extractAddressesFromOrders(ordersData);

        if (addresses.length === 0) {
          alert('No addresses found in the file.');
          return;
        }

        // Show preview
        addressPreview.style.display = 'block';
        addressList.innerHTML = addresses.map((addr, i) => `
          <div style="padding: 8px; margin-bottom: 5px; background: white; border-radius: 4px;">
            ${i + 1}. ${addr.name} - ${addr.city}, ${addr.stateOrProvince} ${addr.postalCode}
          </div>
        `).join('');

        // Enable start button
        startBtn.disabled = false;
        startBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        startBtn.style.color = 'white';
        startBtn.style.cursor = 'pointer';

      } catch (error) {
        alert('Error reading file: ' + error.message);
        console.error('File read error:', error);
      }
    });

    startBtn.addEventListener('click', () => {
      if (!ordersData) return;
      modal.remove();
      this.startAddressImport(ordersData);
    });

    cancelBtn.addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  extractAddressesFromOrders(ordersData) {
    const addresses = [];
    const seen = new Set();

    if (!ordersData.orders || !Array.isArray(ordersData.orders)) {
      return addresses;
    }

    ordersData.orders.forEach(order => {
      if (order.shippingAddress) {
        const addr = order.shippingAddress;
        // Create unique key to avoid duplicates
        const key = `${addr.name}|${addr.addressLine1}|${addr.city}|${addr.postalCode}`;

        if (!seen.has(key)) {
          seen.add(key);
          addresses.push(addr);
        }
      }
    });

    return addresses;
  }

  async startAddressImport(ordersData) {
    const addresses = this.extractAddressesFromOrders(ordersData);

    if (addresses.length === 0) {
      this.showNotification('No addresses to import', 'error');
      return;
    }

    // Store addresses in session storage for use across page navigations
    sessionStorage.setItem('ebayAddressesToImport', JSON.stringify(addresses));
    sessionStorage.setItem('currentAddressIndex', '0');

    this.showNotification(`Starting import of ${addresses.length} addresses...`, 'info');

    // Navigate to add address page
    setTimeout(() => {
      window.location.href = 'https://www.amazon.com/a/addresses/add?ref=ebay_import';
    }, 1000);
  }

  checkAndFillAddress() {
    // Check if we have addresses to import
    const addressesJSON = sessionStorage.getItem('ebayAddressesToImport');
    const currentIndex = parseInt(sessionStorage.getItem('currentAddressIndex') || '0');

    if (!addressesJSON) {
      return; // No import in progress
    }

    const addresses = JSON.parse(addressesJSON);

    if (currentIndex >= addresses.length) {
      // All done!
      sessionStorage.removeItem('ebayAddressesToImport');
      sessionStorage.removeItem('currentAddressIndex');
      this.showNotification('✅ All addresses imported successfully!', 'success');

      // Navigate back to addresses page
      setTimeout(() => {
        window.location.href = 'https://www.amazon.com/a/addresses';
      }, 2000);
      return;
    }

    // Fill the form with current address
    const address = addresses[currentIndex];

    // Wait for form to load
    setTimeout(() => {
      this.fillAddressForm(address, currentIndex + 1, addresses.length);
    }, 1000);
  }

  fillAddressForm(address, current, total) {
    try {
      // Common Amazon address form field IDs/names
      const fieldMappings = {
        fullName: ['address-ui-widgets-enterAddressFullName', 'address-ui-widgets-enterAddressFormContainer-fullName'],
        phoneNumber: ['address-ui-widgets-enterAddressPhoneNumber', 'address-ui-widgets-enterAddressFormContainer-phoneNumber'],
        addressLine1: ['address-ui-widgets-enterAddressLine1', 'address-ui-widgets-enterAddressFormContainer-addressLine1'],
        addressLine2: ['address-ui-widgets-enterAddressLine2', 'address-ui-widgets-enterAddressFormContainer-addressLine2'],
        city: ['address-ui-widgets-enterAddressCity', 'address-ui-widgets-enterAddressFormContainer-city'],
        state: ['address-ui-widgets-enterAddressStateOrRegion', 'address-ui-widgets-enterAddressFormContainer-stateOrRegion'],
        postalCode: ['address-ui-widgets-enterAddressPostalCode', 'address-ui-widgets-enterAddressFormContainer-postalCode']
      };

      const setValue = (fieldIds, value) => {
        for (const id of fieldIds) {
          const field = document.getElementById(id);
          if (field) {
            field.value = value;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;
      };

      // Format phone number to +1 xxx-xxx-xxxx
      const formattedPhone = this.formatPhoneNumber(address.phoneNumber || '');

      // Fill in the form fields
      setValue(fieldMappings.fullName, address.name || '');
      setValue(fieldMappings.phoneNumber, formattedPhone);
      setValue(fieldMappings.addressLine1, address.addressLine1 || '');
      setValue(fieldMappings.addressLine2, address.addressLine2 || '');
      setValue(fieldMappings.city, address.city || '');
      setValue(fieldMappings.postalCode, address.postalCode || '');

      // Set country if needed (usually US)
      const countrySelect = document.getElementById('address-ui-widgets-enterAddressFormContainer-country-dropdown-nativeId');
      if (countrySelect && address.countryCode) {
        countrySelect.value = address.countryCode;
        countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Handle state dropdown specially - Amazon uses a custom dropdown component
      setTimeout(() => {
        this.setStateDropdown(address.stateOrProvince);
      }, 300);

      this.showNotification(`Importing address ${current} of ${total}...`, 'info');

      // Auto-submit after a short delay to ensure form is fully populated
      setTimeout(() => {
        this.submitAddressAndNext();
      }, 1500);

    } catch (error) {
      console.error('Error filling form:', error);
      this.showNotification('Error filling form. Please check the fields.', 'error');
    }
  }

  showAutoSubmitControls(current, total) {
    // Remove existing controls if any
    const existing = document.getElementById('auto-submit-controls');
    if (existing) existing.remove();

    const controls = document.createElement('div');
    controls.id = 'auto-submit-controls';
    controls.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10004;
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      min-width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    controls.innerHTML = `
      <div style="margin-bottom: 15px;">
        <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 5px;">
          Address ${current} of ${total}
        </div>
        <div style="background: #e5e7eb; border-radius: 6px; height: 6px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); height: 100%; width: ${(current / total) * 100}%;"></div>
        </div>
      </div>

      <div style="margin-bottom: 15px; padding: 10px; background: #f0f9ff; border-radius: 6px; font-size: 12px; color: #1e40af;">
        Please verify the address details are correct, then click "Submit & Next" to continue.
      </div>

      <div style="display: flex; gap: 10px;">
        <button id="submit-and-next-btn" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px;">
          Submit & Next
        </button>
        <button id="skip-address-btn" style="padding: 10px 15px; background: #f59e0b; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px;">
          Skip
        </button>
        <button id="stop-import-btn" style="padding: 10px 15px; background: #ef4444; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px;">
          Stop
        </button>
      </div>
    `;

    document.body.appendChild(controls);

    // Event listeners
    controls.querySelector('#submit-and-next-btn').addEventListener('click', () => {
      this.submitAddressAndNext();
    });

    controls.querySelector('#skip-address-btn').addEventListener('click', () => {
      this.skipToNextAddress();
    });

    controls.querySelector('#stop-import-btn').addEventListener('click', () => {
      sessionStorage.removeItem('ebayAddressesToImport');
      sessionStorage.removeItem('currentAddressIndex');
      controls.remove();
      this.showNotification('Import stopped', 'warning');
      setTimeout(() => {
        window.location.href = 'https://www.amazon.com/a/addresses';
      }, 1500);
    });
  }

  submitAddressAndNext() {
    // Find and click the submit button - try multiple approaches
    const submitSelectors = [
      // Direct button IDs and inputs
      '#address-ui-widgets-form-submit-button',
      'input[name="address-ui-widgets-form-submit-button"]',
      '#address-ui-widgets-form-submit-button-announce',

      // Look for span elements that wrap the input (Amazon's button structure)
      'span.a-button-inner input[aria-labelledby*="submit"]',
      'span.a-button-inner input[type="submit"]',

      // General submit buttons
      'button[type="submit"]',
      'input[type="submit"]',

      // Amazon's primary button structure
      '.a-button-primary input',
      '.a-button-primary span input',

      // By text content
      'span.a-button-text'
    ];

    let submitBtn = null;
    let foundSelector = null;

    for (const selector of submitSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Check if it's a span with text "Add address" or similar
        if (element.tagName === 'SPAN') {
          const text = element.textContent.trim().toLowerCase();
          if (text.includes('add address') || text.includes('submit')) {
            // Find the actual input within or near this span
            const input = element.closest('.a-button-primary')?.querySelector('input[type="submit"]');
            if (input) {
              submitBtn = input;
              foundSelector = selector + ' -> input';
              break;
            }
          }
        } else {
          submitBtn = element;
          foundSelector = selector;
          break;
        }
      }
    }

    if (submitBtn) {
      console.log('Found submit button with selector:', foundSelector);

      // Increment counter BEFORE submitting (so when Amazon redirects, we're ready for next)
      const currentIndex = parseInt(sessionStorage.getItem('currentAddressIndex') || '0');
      sessionStorage.setItem('currentAddressIndex', (currentIndex + 1).toString());

      this.showNotification('Submitting address...', 'info');

      // Try clicking both the element and via JavaScript
      submitBtn.click();

      // Also try triggering via dispatchEvent
      submitBtn.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      }));

      // Amazon will automatically redirect after successful submission
      // Our continueImportAfterSuccess() will catch it and continue the import

      return;
    }

    // If we still can't find it, log what buttons exist on the page for debugging
    console.warn('Could not find submit button. Available buttons:');
    document.querySelectorAll('button, input[type="submit"]').forEach(btn => {
      console.log('Button found:', {
        tag: btn.tagName,
        type: btn.type,
        id: btn.id,
        name: btn.name,
        className: btn.className,
        text: btn.textContent?.substring(0, 50)
      });
    });

    this.showNotification('Could not find submit button. Please submit manually and click "Skip".', 'warning');
  }

  skipToNextAddress() {
    const currentIndex = parseInt(sessionStorage.getItem('currentAddressIndex') || '0');
    sessionStorage.setItem('currentAddressIndex', (currentIndex + 1).toString());
    window.location.href = 'https://www.amazon.com/a/addresses/add?ref=ebay_import';
  }

  setStateDropdown(stateValue) {
    if (!stateValue) return;

    // Try multiple approaches to set the state dropdown
    const stateSelectors = [
      '#address-ui-widgets-enterAddressStateOrRegion-dropdown-nativeId',
      'select[name="address-ui-widgets-enterAddressStateOrRegion"]',
      '[aria-labelledby*="State"] select',
      'select.a-native-dropdown'
    ];

    for (const selector of stateSelectors) {
      const dropdown = document.querySelector(selector);
      if (dropdown) {
        // Find the option that matches the state (could be full name or abbreviation)
        const options = Array.from(dropdown.options);
        const matchingOption = options.find(opt =>
          opt.value === stateValue ||
          opt.text === stateValue ||
          opt.value.toLowerCase() === stateValue.toLowerCase() ||
          opt.text.toLowerCase() === stateValue.toLowerCase()
        );

        if (matchingOption) {
          dropdown.value = matchingOption.value;
          dropdown.dispatchEvent(new Event('change', { bubbles: true }));
          dropdown.dispatchEvent(new Event('input', { bubbles: true }));

          // Also trigger React/Vue events if the page uses them
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
          nativeInputValueSetter.call(dropdown, matchingOption.value);
          dropdown.dispatchEvent(new Event('change', { bubbles: true }));

          console.log('State set to:', matchingOption.value);
          return true;
        }
      }
    }

    console.warn('Could not set state dropdown for:', stateValue);
    return false;
  }

  formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return '';

    // Remove all non-digit characters
    const digitsOnly = phoneNumber.replace(/\D/g, '');

    // Handle different phone number formats
    if (digitsOnly.length === 10) {
      // US phone number without country code: 6127498677 -> +1 612-749-8677
      return `+1 ${digitsOnly.substring(0, 3)}-${digitsOnly.substring(3, 6)}-${digitsOnly.substring(6)}`;
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      // US phone number with country code: 16127498677 -> +1 612-749-8677
      return `+1 ${digitsOnly.substring(1, 4)}-${digitsOnly.substring(4, 7)}-${digitsOnly.substring(7)}`;
    } else if (digitsOnly.length === 11) {
      // Other format with 11 digits
      return `+1 ${digitsOnly.substring(1, 4)}-${digitsOnly.substring(4, 7)}-${digitsOnly.substring(7)}`;
    } else {
      // Fallback: return original if format is unexpected
      return phoneNumber;
    }
  }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Initialize scraper
new AmazonScraper();
