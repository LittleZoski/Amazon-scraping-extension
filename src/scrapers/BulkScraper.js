/**
 * Bulk Scraper
 * Handles bulk scraping from Amazon category/listing pages
 */
import { DataExtractor } from '../extractors/DataExtractor.js';
import { DataSanitizer } from '../utils/DataSanitizer.js';
import { Validators } from '../utils/Validators.js';
import { DOMHelpers } from '../utils/DOMHelpers.js';
import { StorageManager } from '../storage/StorageManager.js';
import { UIManager } from '../ui/UIManager.js';

export class BulkScraper {
  constructor() {
    this.scrapeButton = null;
    this.primeOnlyMode = false;
  }

  async init() {
    this.primeOnlyMode = await StorageManager.getPrimeOnlyMode();
    this.injectBulkScrapeButton();
  }

  injectBulkScrapeButton() {
    const itemCount = DOMHelpers.getVisibleProductCount();
    this.scrapeButton = document.createElement('button');
    this.scrapeButton.id = 'amazon-scraper-btn';
    this.scrapeButton.innerHTML = `📦 Scrape ${itemCount} Items`;
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

  showBulkScrapeSettings() {
    const allProducts = DataExtractor.extractProductLinksFromPage();

    if (allProducts.length === 0) {
      UIManager.showNotification('❌ No products found on this page', 'error');
      return;
    }

    const settingsModal = this.createSettingsModal(allProducts);
    document.body.appendChild(settingsModal);
  }

  createSettingsModal(allProducts) {
    const productsWithMetadata = allProducts.map(p => {
      const priceText = p.element?.querySelector('.a-price .a-offscreen, .a-price-whole, ._cDEzb_p13n-sc-price_3mJ9Z')?.textContent?.trim();
      const price = DOMHelpers.parsePrice(priceText);
      const isPrime = DataExtractor.checkPrimeEligibilityFromElement(p.element);
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

    this.attachModalEventListeners(modal, allProducts, productsWithMetadata);
    return modal;
  }

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
    const primeOnlyFilter = modal.querySelector('#prime-only-filter');
    const primeFilterInfo = modal.querySelector('#prime-filter-info');
    const startBtn = modal.querySelector('#start-scrape-btn');
    const cancelBtn = modal.querySelector('#cancel-scrape-btn');

    countSlider.addEventListener('input', (e) => {
      countValue.textContent = e.target.value;
    });

    const updateFilteredCount = () => {
      const minPrice = parseInt(minPriceSlider.value);
      const maxPrice = parseInt(maxPriceSlider.value);
      const primeOnly = primeOnlyFilter.checked;

      let filtered = productsWithMetadata;

      if (enablePriceFilter.checked) {
        filtered = filtered.filter(p => p.price >= minPrice && p.price <= maxPrice);
      }

      if (primeOnly) {
        filtered = filtered.filter(p => p.isPrime);
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

    primeOnlyFilter.addEventListener('change', (e) => {
      primeFilterInfo.style.display = e.target.checked ? 'block' : 'none';
      updateFilteredCount();
    });

    startBtn.addEventListener('click', () => {
      const count = parseInt(countSlider.value);
      const usePriceFilter = enablePriceFilter.checked;
      const minPrice = parseInt(minPriceSlider.value);
      const maxPrice = parseInt(maxPriceSlider.value);
      const primeOnly = primeOnlyFilter.checked;

      modal.remove();
      this.bulkScrapeFromPage(allProducts, count, usePriceFilter, minPrice, maxPrice, primeOnly);
    });

    cancelBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  async bulkScrapeFromPage(allProducts, maxCount, usePriceFilter, minPrice, maxPrice, primeOnly = false) {
    try {
      this.scrapeButton.innerHTML = '⏳ Filtering...';
      this.scrapeButton.disabled = true;
      this.primeOnlyMode = primeOnly;

      let productLinks = allProducts;

      if (usePriceFilter) {
        productLinks = productLinks.filter(p => {
          const priceElement = p.element?.querySelector('.a-price .a-offscreen, .a-price-whole, ._cDEzb_p13n-sc-price_3mJ9Z');
          const priceText = priceElement?.textContent?.trim();
          const price = DOMHelpers.parsePrice(priceText);
          return price >= minPrice && price <= maxPrice;
        });
      }

      productLinks = productLinks.slice(0, maxCount);

      if (productLinks.length === 0) {
        throw new Error('No products found matching the filter criteria');
      }

      const progressUI = UIManager.createProgressIndicator(productLinks.length);
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

      const BATCH_SIZE = 3;

      for (let batchStart = 0; batchStart < productLinks.length; batchStart += BATCH_SIZE) {
        if (stopRequested) {
          console.log('Scraping stopped by user');
          break;
        }

        const batchEnd = Math.min(batchStart + BATCH_SIZE, productLinks.length);
        const batch = productLinks.slice(batchStart, batchEnd);

        const batchPromises = batch.map(link => this.scrapeProductFromLink(link));
        const batchResults = await Promise.allSettled(batchPromises);

        for (let i = 0; i < batchResults.length; i++) {
          processedCount++;
          UIManager.updateProgressIndicator(progressUI, processedCount, productLinks.length, successCount, failCount, skippedCount);

          const result = batchResults[i];

          if (result.status === 'fulfilled' && result.value && result.value.title) {
            const productData = result.value;
            const validation = Validators.validateProductFromDoc(productData, this.primeOnlyMode);

            if (validation.isValid) {
              const sanitizedData = DataSanitizer.sanitizeProductData(productData);

              try {
                await StorageManager.saveProduct(sanitizedData);
                successCount++;
              } catch (error) {
                console.warn('chrome.storage failed, using localStorage:', error);
                StorageManager.saveToLocalStorage(sanitizedData);
                successCount++;
              }
            } else {
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

        if (batchEnd < productLinks.length && !stopRequested) {
          await DOMHelpers.sleep(100);
        }
      }

      progressUI.remove();

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

      UIManager.showNotification(resultParts.join(' | '), stopRequested ? 'warning' : 'success');
      this.scrapeButton.innerHTML = `✅ Scraped ${successCount}!`;

      setTimeout(() => {
        const newCount = DOMHelpers.getVisibleProductCount();
        this.scrapeButton.innerHTML = `📦 Scrape ${newCount} Items`;
        this.scrapeButton.disabled = false;
      }, 3000);

    } catch (error) {
      console.error('Bulk scraping error:', error);
      UIManager.showNotification('❌ Error: ' + error.message, 'error');
      const count = DOMHelpers.getVisibleProductCount();
      this.scrapeButton.innerHTML = `📦 Scrape ${count} Items`;
      this.scrapeButton.disabled = false;
    }
  }

  async scrapeProductFromLink(linkData) {
    const { asin, url } = linkData;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const productData = {
        asin: asin,
        url: url,
        scrapedAt: new Date().toISOString(),
        title: DataExtractor.extractTitleFromDoc(doc),
        price: DataExtractor.extractPriceFromDoc(doc),
        deliveryFee: DataExtractor.extractDeliveryFeeFromDoc(doc),
        isPrime: DataExtractor.extractPrimeEligibilityFromDoc(doc),
        images: DataExtractor.extractImagesFromDoc(doc),
        description: DataExtractor.extractDescriptionFromDoc(doc),
        bulletPoints: DataExtractor.extractBulletPointsFromDoc(doc),
        specifications: DataExtractor.extractSpecificationsFromDoc(doc)
      };

      return productData;

    } catch (error) {
      console.error(`Error fetching product ${asin}:`, error);
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
}
