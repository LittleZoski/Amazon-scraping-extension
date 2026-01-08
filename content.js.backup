// Content script that runs on Amazon product pages
// Injects a scrape button and handles product data extraction

class AmazonScraper {
  constructor() {
    this.scrapeButton = null;
    this.init();
  }

  init() {
    // Wait for page to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.injectScrapeButton());
    } else {
      this.injectScrapeButton();
    }
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
    // Extract price info from products
    const productsWithPrices = allProducts.map(p => {
      const priceText = p.element?.querySelector('.a-price .a-offscreen, .a-price-whole, ._cDEzb_p13n-sc-price_3mJ9Z')?.textContent?.trim();
      const price = this.parsePrice(priceText);
      return { ...p, price, priceText };
    }).filter(p => p.price > 0); // Only products with valid prices

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
              <span id="filtered-count">${allProducts.length}</span> products match filter
            </div>
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

      if (enablePriceFilter.checked) {
        const filtered = productsWithPrices.filter(p => p.price >= minPrice && p.price <= maxPrice);
        filteredCount.textContent = filtered.length;
      } else {
        filteredCount.textContent = allProducts.length;
      }
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

    // Start button
    startBtn.addEventListener('click', () => {
      const count = parseInt(countSlider.value);
      const usePriceFilter = enablePriceFilter.checked;
      const minPrice = parseInt(minPriceSlider.value);
      const maxPrice = parseInt(maxPriceSlider.value);

      modal.remove();
      this.bulkScrapeFromPage(allProducts, count, usePriceFilter, minPrice, maxPrice);
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

  async bulkScrapeFromPage(allProducts, maxCount, usePriceFilter, minPrice, maxPrice) {
    try {
      this.scrapeButton.innerHTML = '⏳ Filtering...';
      this.scrapeButton.disabled = true;

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

      let successCount = 0;
      let failCount = 0;

      // Scrape each product
      for (let i = 0; i < productLinks.length; i++) {
        try {
          // Update progress UI
          this.updateProgressIndicator(progressUI, i + 1, productLinks.length, successCount, failCount);

          const productData = await this.scrapeProductFromLink(productLinks[i]);

          if (productData && productData.title) {
            // Sanitize data before saving
            const sanitizedData = this.sanitizeProductData(productData);
            await this.saveProduct(sanitizedData);
            successCount++;
          } else {
            failCount++;
          }

          // Small delay to avoid overwhelming Amazon
          await this.sleep(500);

        } catch (error) {
          console.error('Error scraping product:', error);
          failCount++;
        }
      }

      // Remove progress UI
      progressUI.remove();

      // Show results
      this.showNotification(
        `✅ Scraped ${successCount} products successfully!${failCount > 0 ? ` (${failCount} failed)` : ''}`,
        'success'
      );
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
          <span style="color: #ef4444; font-weight: 600;" id="fail-count">0</span> Failed
        </div>
      </div>

      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
        <div style="font-size: 12px; color: #999; text-align: center;">
          Currently scraping: <span id="current-item" style="color: #667eea; font-weight: 500;">Product 0</span>
        </div>
      </div>
    `;

    return progressContainer;
  }

  updateProgressIndicator(progressUI, current, total, successCount, failCount) {
    const percent = Math.round((current / total) * 100);

    progressUI.querySelector('#progress-text').textContent = `${current} / ${total}`;
    progressUI.querySelector('#progress-percent').textContent = `${percent}%`;
    progressUI.querySelector('#progress-bar').style.width = `${percent}%`;
    progressUI.querySelector('#success-count').textContent = successCount;
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
        price: 'See Amazon',
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
    const selectors = [
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price-whole'
    ];
    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) return element.textContent.trim();
    }
    return null;
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
    const selectors = [
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price-whole'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return null;
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

  async saveProduct(productData) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['scrapedProducts'], (result) => {
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
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
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
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
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
