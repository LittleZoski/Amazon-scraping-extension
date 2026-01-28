/**
 * YamiDataExtractor - Data extraction logic for Yami.com
 * MUST MATCH Amazon DataExtractor.js format exactly
 * Extracts product data using multiple fallback strategies
 */

class YamiDataExtractor {
  // ===== Current Page Extraction =====

  /**
   * Extract complete product data from current page
   * MATCHES Amazon extractProductData() format EXACTLY
   * @returns {Object} Product data object
   */
  static extractProductData() {
    const productID = YamiDOMHelpers.extractProductID();

    return {
      asin: productID, // Use "asin" for eBay backend compatibility (same as Amazon)
      title: this.getTitle(),
      price: this.getPrice(),
      deliveryFee: '$5.99', // Always set to 5.99 for Yami products
      images: this.getImages(),
      description: this.getDescription(),
      bulletPoints: this.getBulletPoints(),
      specifications: this.getSpecifications(),
      countryOfOrigin: this.getCountryOfOrigin(), // Add country of origin field
      url: window.location.href,
      scrapedAt: new Date().toISOString(),
      source: 'yami' // Add source field
    };
  }

  /**
   * Extract product title with multiple fallback strategies
   * @returns {string} Product title
   */
  static getTitle() {
    // Strategy 1: JSON-LD structured data
    const jsonld = YamiDOMHelpers.extractJSONLD(document);
    if (jsonld && jsonld.name) {
      return jsonld.name;
    }

    // Strategy 2: H1 tag
    const h1 = document.querySelector('h1');
    if (h1) {
      return h1.textContent.trim();
    }

    // Strategy 3: Meta tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      return ogTitle.getAttribute('content');
    }

    // Strategy 4: Title tag (less reliable)
    const titleTag = document.querySelector('title');
    if (titleTag) {
      const title = titleTag.textContent.trim();
      // Remove site suffix like " - Yami.com"
      return title.replace(/\s*[-–|]\s*Yami\.com.*$/i, '').trim();
    }

    return null;
  }

  /**
   * Extract current price with multiple fallback strategies
   * CRITICAL: Must get the CORRECT displayed price
   * @returns {string} Formatted price (e.g., "$35.99")
   */
  static getPrice() {
    // Strategy 1: JSON-LD offers price (most reliable - verified to have correct price 35.99)
    const jsonld = YamiDOMHelpers.extractJSONLD(document);
    if (jsonld && jsonld.offers && jsonld.offers.price) {
      const price = parseFloat(jsonld.offers.price);
      if (!isNaN(price)) {
        return YamiDOMHelpers.formatPrice(price);
      }
    }

    // Strategy 2: .price-shop.word-bold (verified correct selector from debug)
    const priceShop = document.querySelector('.price-shop.word-bold');
    if (priceShop) {
      const priceText = priceShop.textContent.trim();
      const price = YamiDOMHelpers.parsePrice(priceText);
      if (price !== null && price > 0) {
        return YamiDOMHelpers.formatPrice(price);
      }
    }

    // Strategy 3: Other price selectors (fallback)
    const priceSelectors = [
      '.price-shop',
      '.word-bold-price.red-price',
      '[itemprop="price"]',
      '.item-price__valid'
    ];

    for (const selector of priceSelectors) {
      const priceElement = document.querySelector(selector);
      if (priceElement) {
        const priceText = priceElement.textContent.trim();
        const price = YamiDOMHelpers.parsePrice(priceText);
        if (price !== null && price > 0) {
          return YamiDOMHelpers.formatPrice(price);
        }
      }
    }

    // Strategy 4: Meta tags
    const ogPrice = document.querySelector('meta[property="product:price:amount"]');
    if (ogPrice) {
      const price = parseFloat(ogPrice.getAttribute('content'));
      if (!isNaN(price)) {
        return YamiDOMHelpers.formatPrice(price);
      }
    }

    return null;
  }

  /**
   * Extract delivery/shipping fee information
   * @returns {string} Delivery fee description
   */
  static getDeliveryFee() {
    // Look for shipping information text
    const bodyText = document.body.textContent;

    // Check for free shipping threshold
    const freeShippingMatch = bodyText.match(/free\s+shipping\s+over\s+\$(\d+)/i);
    if (freeShippingMatch) {
      return `FREE (over $${freeShippingMatch[1]})`;
    }

    // Look for specific shipping cost
    const shippingSelectors = [
      '[data-qa="shipping-info"]',
      '.shipping-info',
      '.delivery-info',
      '.item-shipping'
    ];

    for (const selector of shippingSelectors) {
      const shippingElement = document.querySelector(selector);
      if (shippingElement) {
        const shippingText = shippingElement.textContent.trim();
        if (shippingText) {
          return shippingText;
        }
      }
    }

    // Check JSON-LD for shipping details
    const jsonld = YamiDOMHelpers.extractJSONLD(document);
    if (jsonld && jsonld.offers && jsonld.offers.shippingDetails) {
      const shipping = jsonld.offers.shippingDetails;
      if (shipping.shippingRate && shipping.shippingRate.value !== undefined) {
        const rate = parseFloat(shipping.shippingRate.value);
        if (rate === 0) {
          return 'FREE';
        }
        return `$${rate.toFixed(2)}`;
      }
    }

    // Default
    return null;
  }

  /**
   * Check if product is fulfilled by Yami (equivalent to Amazon Prime)
   * @returns {boolean} True if fulfilled by Yami
   */
  static isFulfilledByYami() {
    // Look for "Fulfilled by Yami" text in page
    const bodyText = document.body.textContent;
    if (bodyText.includes('Fulfilled by Yami') ||
        bodyText.includes('Shipped by Yami') ||
        bodyText.includes('Sold by Yami')) {
      return true;
    }

    // Check for specific badge elements
    const badgeSelectors = [
      '.bff-item__badge',
      '[data-qa="fulfillment-badge"]',
      '.fulfillment-info',
      '.seller-info'
    ];

    for (const selector of badgeSelectors) {
      const badge = document.querySelector(selector);
      if (badge) {
        const badgeText = badge.textContent.toLowerCase();
        if (badgeText.includes('fulfilled by yami') || badgeText.includes('shipped by yami')) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Extract product images with high-resolution URLs
   * @returns {Array<string>} Array of image URLs (up to 10)
   */
  static getImages() {
    const images = new Set(); // Use Set to avoid duplicates

    // Strategy 1: JSON-LD Product schema (FASTEST - already in page, no lazy loading needed)
    const scripts = document.querySelectorAll('script');
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      const content = script.textContent.trim();

      if (content.includes('"@type":"Product"') || content.includes('"@type": "Product"')) {
        try {
          const jsonld = JSON.parse(content);

          // Handle both array and single string for image field
          if (jsonld.image) {
            const imageUrls = Array.isArray(jsonld.image) ? jsonld.image : [jsonld.image];

            imageUrls.forEach((url, index) => {
              if (url && !url.includes('logo') && !url.includes('placeholder')) {
                // JSON-LD images are already in good quality, just normalize the URL
                const normalized = YamiDOMHelpers.normalizeURL(url);
                images.add(normalized);
              }
            });

            // JSON-LD often only contains aspect ratio variations of the main image (e.g., 640x640, 640x480, 640x360)
            // If we only got 3 or fewer images, they're likely just variations, so continue to DOM extraction
            // to get all actual product images from the gallery
            if (images.size > 3) {
              return Array.from(images).slice(0, 10);
            } else {
              images.clear(); // Clear the aspect ratio variations
            }
          }
        } catch (e) {
          // Continue to next strategy if JSON parsing fails
        }
        break; // Only check first Product schema
      }
    }

    // Strategy 2: Product image gallery - div[data-observetrack="goods_image"] .item-preview__list li img
    const itemPreviewList = document.querySelector('[data-observetrack="goods_image"] .item-preview__list');
    if (itemPreviewList) {
      const listItems = itemPreviewList.querySelectorAll('li');
      listItems.forEach((li, liIndex) => {
        // Try to find all images within this li
        const imgs = li.querySelectorAll('img');
        imgs.forEach((img, imgIndex) => {
          // Try multiple attribute names for image sources
          // Prioritize data-src over src because lazy-loaded images have lazy.svg in src
          let src = img.getAttribute('data-src') ||
                    img.dataset?.src ||
                    img.getAttribute('data-lazy') ||
                    img.dataset?.lazy ||
                    img.getAttribute('data-original') ||
                    img.dataset?.original ||
                    img.getAttribute('src');

          if (src && !src.includes('lazy.svg') && !src.includes('placeholder') &&
              !src.includes('data:image') && !src.includes('logo')) {
            const normalized = YamiDOMHelpers.normalizeURL(src);
            const highRes = YamiDOMHelpers.getHighResImageURL(normalized);
            images.add(highRes);
          }
        });
      });
    }

    // Strategy 3: Fallback - .item-preview__wrapper .item-preview__list li img
    if (images.size === 0) {
      const previewList = document.querySelector('.item-preview__wrapper .item-preview__list');
      if (previewList) {
        const listItems = previewList.querySelectorAll('li');
        listItems.forEach((li, liIndex) => {
          const imgs = li.querySelectorAll('img');
          imgs.forEach((img, imgIndex) => {
            // Prioritize data-src over src because lazy-loaded images have lazy.svg in src
            const src = img.getAttribute('data-src') ||
                       img.dataset?.src ||
                       img.getAttribute('data-lazy') ||
                       img.dataset?.lazy ||
                       img.getAttribute('data-original') ||
                       img.dataset?.original ||
                       img.getAttribute('src');

            if (src && !src.includes('lazy.svg') && !src.includes('placeholder') &&
                !src.includes('data:image') && !src.includes('logo')) {
              const normalized = YamiDOMHelpers.normalizeURL(src);
              const highRes = YamiDOMHelpers.getHighResImageURL(normalized);
              images.add(highRes);
            }
          });
        });
      }
    }

    // Strategy 3: JSON-LD images (fallback)
    if (images.size === 0) {
      const jsonld = YamiDOMHelpers.extractJSONLD(document);
      if (jsonld && jsonld.image) {
        if (Array.isArray(jsonld.image)) {
          jsonld.image.forEach(url => {
            if (!url.includes('logo')) {
              const normalized = YamiDOMHelpers.normalizeURL(url);
              const highRes = YamiDOMHelpers.getHighResImageURL(normalized);
              images.add(highRes);
            }
          });
        } else if (typeof jsonld.image === 'string') {
          if (!jsonld.image.includes('logo')) {
            const normalized = YamiDOMHelpers.normalizeURL(jsonld.image);
            const highRes = YamiDOMHelpers.getHighResImageURL(normalized);
            images.add(highRes);
          }
        }
      }
    }

    // Strategy 4: Meta tags (last resort)
    if (images.size === 0) {
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) {
        const content = ogImage.getAttribute('content');
        if (content && !content.includes('logo')) {
          const normalized = YamiDOMHelpers.normalizeURL(content);
          const highRes = YamiDOMHelpers.getHighResImageURL(normalized);
          images.add(highRes);
        }
      }
    }

    // Convert Set to Array and limit to 10 images
    return Array.from(images).filter(url => url && url.length > 0).slice(0, 10);
  }

  /**
   * Extract product description
   * For Yami, format specifications as description text
   * @returns {string} Product description
   */
  static getDescription() {
    // Strategy 1: Format specifications as description
    const specs = this.getSpecifications();
    if (specs && Object.keys(specs).length > 0) {
      let description = '';
      for (const [key, value] of Object.entries(specs)) {
        description += `${key}: ${value}\n`;
      }
      return description.trim();
    }

    // Strategy 2: JSON-LD description (fallback)
    const jsonld = YamiDOMHelpers.extractJSONLD(document);
    if (jsonld && jsonld.description) {
      return jsonld.description;
    }

    // Strategy 3: Meta description (last resort)
    const metaDesc = document.querySelector('meta[name="description"], meta[property="og:description"]');
    if (metaDesc) {
      return metaDesc.getAttribute('content');
    }

    return '';
  }

  /**
   * Extract bullet points / key features from "Product Highlights" section
   * CRITICAL: Must extract from Product Highlights section, not just any list
   * @returns {Array<string>} Array of bullet points
   */
  static getBulletPoints() {
    const bulletPoints = [];

    // Strategy 1: Look within .item-desc__content for H2 "Product Highlights" (verified from debug)
    const itemDescContent = document.querySelector('.item-desc__content');
    if (itemDescContent) {
      const h2Headings = itemDescContent.querySelectorAll('h2.item-desc__title');
      for (const h2 of h2Headings) {
        if (h2.textContent.trim().toLowerCase() === 'product highlights') {
          const ul = h2.nextElementSibling;
          if (ul && ul.tagName === 'UL' && ul.classList.contains('item-desc__list')) {
            const bullets = ul.querySelectorAll('li');
            bullets.forEach(bullet => {
              const text = bullet.textContent.trim();
              if (text && text.length > 0) {
                bulletPoints.push(text);
              }
            });
            break;
          }
        }
      }
    }

    // Strategy 2: Fallback - first UL.item-desc__list in .item-desc__content
    if (bulletPoints.length === 0 && itemDescContent) {
      const ul = itemDescContent.querySelector('ul.item-desc__list');
      if (ul) {
        const bullets = ul.querySelectorAll('li');
        bullets.forEach(bullet => {
          const text = bullet.textContent.trim();
          if (text && text.length > 0) {
            bulletPoints.push(text);
          }
        });
      }
    }

    // Strategy 3: Global search for "Product Highlights" heading
    if (bulletPoints.length === 0) {
      const allHeadings = document.querySelectorAll('h2, h3, h4');
      for (const heading of allHeadings) {
        const headingText = heading.textContent.trim().toLowerCase();
        if (headingText === 'product highlights' || headingText.includes('product highlight')) {
          let nextElement = heading.nextElementSibling;
          while (nextElement) {
            if (nextElement.tagName === 'UL' || nextElement.tagName === 'OL') {
              const bullets = nextElement.querySelectorAll('li');
              bullets.forEach(bullet => {
                const text = bullet.textContent.trim();
                if (text && text.length > 0) {
                  bulletPoints.push(text);
                }
              });
              break;
            }
            nextElement = nextElement.nextElementSibling;
          }
          if (bulletPoints.length > 0) break;
        }
      }
    }

    // Strategy 4: Extract from description if no explicit bullets found
    if (bulletPoints.length === 0) {
      const description = this.getDescription();
      if (description) {
        const lines = description.split('\n').filter(line => line.trim().length > 20);
        return lines.slice(0, 5); // Max 5 lines as bullet points
      }
    }

    return bulletPoints;
  }

  /**
   * Extract product specifications / attributes from "Details" section
   * CRITICAL: Must extract from Details/Specification section
   * @returns {Object} Key-value pairs of specifications
   */
  static getSpecifications() {
    const specs = {};

    // Strategy 1: Look for H3 "Specifications" heading → TABLE.specification (verified from debug)
    const allH3Headings = document.querySelectorAll('h3.item-desc__title');
    for (const h3 of allH3Headings) {
      if (h3.textContent.trim().toLowerCase() === 'specifications') {
        const table = h3.nextElementSibling;
        if (table && table.tagName === 'TABLE' && table.classList.contains('specification')) {
          const rows = table.querySelectorAll('tr');
          rows.forEach(row => {
            const cells = row.querySelectorAll('td, th');
            if (cells.length >= 2) {
              const key = cells[0].textContent.trim();
              const value = cells[1].textContent.trim();
              if (key && value) {
                specs[key] = value;
              }
            }
          });
          break;
        }
      }
    }

    // Strategy 2: Fallback - direct TABLE.specification selector
    if (Object.keys(specs).length === 0) {
      const table = document.querySelector('table.specification');
      if (table) {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td, th');
          if (cells.length >= 2) {
            const key = cells[0].textContent.trim();
            const value = cells[1].textContent.trim();
            if (key && value) {
              specs[key] = value;
            }
          }
        });
      }
    }

    // Strategy 3: Global search for "Specifications" or "Details" heading
    if (Object.keys(specs).length === 0) {
      const allHeadings = document.querySelectorAll('h3, h4');
      for (const heading of allHeadings) {
        const headingText = heading.textContent.trim().toLowerCase();
        if (headingText === 'specifications' || headingText === 'details' ||
            headingText.includes('specification') || headingText.includes('detail')) {
          let nextElement = heading.nextElementSibling;
          while (nextElement) {
            if (nextElement.tagName === 'TABLE') {
              const rows = nextElement.querySelectorAll('tr');
              rows.forEach(row => {
                const cells = row.querySelectorAll('td, th');
                if (cells.length >= 2) {
                  const key = cells[0].textContent.trim();
                  const value = cells[1].textContent.trim();
                  if (key && value) {
                    specs[key] = value;
                  }
                }
              });
              break;
            }
            // Check for definition list
            if (nextElement.tagName === 'DL') {
              const terms = nextElement.querySelectorAll('dt');
              const definitions = nextElement.querySelectorAll('dd');
              terms.forEach((term, index) => {
                if (definitions[index]) {
                  const key = term.textContent.trim();
                  const value = definitions[index].textContent.trim();
                  if (key && value) {
                    specs[key] = value;
                  }
                }
              });
              break;
            }
            nextElement = nextElement.nextElementSibling;
          }
          if (Object.keys(specs).length > 0) break;
        }
      }
    }

    // Strategy 4: Generic table/list selectors
    if (Object.keys(specs).length === 0) {
      const specSelectors = [
        '.product-specs tr',
        '.specifications tr',
        '.product-attributes tr',
        '[data-qa="specs"] tr',
        '.details-table tr'
      ];

      for (const selector of specSelectors) {
        const rows = document.querySelectorAll(selector);
        if (rows.length > 0) {
          rows.forEach(row => {
            const cells = row.querySelectorAll('td, th');
            if (cells.length >= 2) {
              const key = cells[0].textContent.trim();
              const value = cells[1].textContent.trim();
              if (key && value) {
                specs[key] = value;
              }
            }
          });
          if (Object.keys(specs).length > 0) break;
        }
      }
    }

    return specs;
  }

  /**
   * Extract country of origin from specifications
   * @returns {string} Country of origin or empty string
   */
  static getCountryOfOrigin() {
    const specs = this.getSpecifications();
    return specs['Brand Origin'] || specs['Origin'] || specs['Country of Origin'] || specs['Country'] || '';
  }

  // ===== Parsed Document Extraction (for bulk scraping) =====

  static extractTitleFromDoc(doc) {
    const jsonld = YamiDOMHelpers.extractJSONLD(doc);
    if (jsonld && jsonld.name) return jsonld.name;

    const h1 = doc.querySelector('h1');
    if (h1) return h1.textContent.trim();

    const ogTitle = doc.querySelector('meta[property="og:title"]');
    if (ogTitle) return ogTitle.getAttribute('content');

    return null;
  }

  static extractPriceFromDoc(doc) {
    // Strategy 1: JSON-LD Product schema (FASTEST and most reliable)
    const scripts = doc.querySelectorAll('script');

    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      const content = script.textContent.trim();

      // Look for JSON-LD Product schema
      if (content.includes('"@type":"Product"') || content.includes('"@type": "Product"')) {
        try {
          const jsonld = JSON.parse(content);

          // Try to extract price from offers
          if (jsonld.offers) {
            const price = parseFloat(jsonld.offers.price || jsonld.offers.lowPrice || jsonld.offers.highPrice);
            if (!isNaN(price) && price > 0) {
              return YamiDOMHelpers.formatPrice(price);
            }
          }
        } catch (e) {
          // Continue to next strategy if JSON parsing fails
        }
        break; // Only check first Product schema
      }
    }

    // Strategy 2: Try DOM selectors (fallback)
    const priceSelectors = [
      '.item-price__valid',
      '.bff-item__price--valid',
      '.red-price',
      '[data-qa="item-price"]'
    ];

    for (const selector of priceSelectors) {
      const priceElement = doc.querySelector(selector);
      if (priceElement) {
        const priceText = priceElement.textContent.trim();
        const price = YamiDOMHelpers.parsePrice(priceText);
        if (price !== null && price > 0) {
          return YamiDOMHelpers.formatPrice(price);
        }
      }
    }

    return null;
  }

  static extractDeliveryFeeFromDoc(doc) {
    const bodyText = doc.body.textContent;
    const freeShippingMatch = bodyText.match(/free\s+shipping\s+over\s+\$(\d+)/i);
    if (freeShippingMatch) {
      return `FREE (over $${freeShippingMatch[1]})`;
    }
    return null;
  }

  static extractPrimeEligibilityFromDoc(doc) {
    const bodyText = doc.body.textContent;
    return bodyText.includes('Fulfilled by Yami') ||
           bodyText.includes('Shipped by Yami') ||
           bodyText.includes('Sold by Yami');
  }

  static extractImagesFromDoc(doc) {
    const images = new Set();

    // Strategy 1: JSON-LD Product schema (FASTEST - no DOM traversal needed)
    // This is embedded in Script 4 and contains all product images
    const scripts = doc.querySelectorAll('script');
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      const content = script.textContent.trim();

      if (content.includes('"@type":"Product"') || content.includes('"@type": "Product"')) {
        try {
          const jsonld = JSON.parse(content);

          // Handle both array and single string for image field
          if (jsonld.image) {
            const imageUrls = Array.isArray(jsonld.image) ? jsonld.image : [jsonld.image];

            imageUrls.forEach((url, index) => {
              if (url && !url.includes('logo') && !url.includes('placeholder')) {
                // JSON-LD images are already in good quality, just normalize the URL
                const normalized = YamiDOMHelpers.normalizeURL(url);
                images.add(normalized);
              }
            });

            // JSON-LD often only contains aspect ratio variations of the main image (e.g., 640x640, 640x480, 640x360)
            // If we only got 3 or fewer images, they're likely just variations, so continue to DOM extraction
            if (images.size > 3) {
              return Array.from(images);
            } else {
              images.clear(); // Clear the aspect ratio variations
            }
          }
        } catch (e) {
          // Continue to next strategy if JSON parsing fails
        }
        break; // Only check first Product schema
      }
    }

    // Strategy 2: Product image gallery - div[data-observetrack="goods_image"] .item-preview__list li img
    const itemPreviewList = doc.querySelector('[data-observetrack="goods_image"] .item-preview__list');
    if (itemPreviewList) {
      const listItems = itemPreviewList.querySelectorAll('li');
      listItems.forEach((li, liIndex) => {
        const imgs = li.querySelectorAll('img');
        imgs.forEach((img, imgIndex) => {
          // Prioritize data-src over src because lazy-loaded images have lazy.svg in src
          const src = img.getAttribute('data-src') ||
                     img.dataset?.src ||
                     img.getAttribute('data-lazy') ||
                     img.dataset?.lazy ||
                     img.getAttribute('data-original') ||
                     img.dataset?.original ||
                     img.getAttribute('src');

          if (src && !src.includes('lazy.svg') && !src.includes('placeholder') &&
              !src.includes('data:image') && !src.includes('logo')) {
            const normalized = YamiDOMHelpers.normalizeURL(src);
            const highRes = YamiDOMHelpers.getHighResImageURL(normalized);
            images.add(highRes);
          }
        });
      });
    }

    // Strategy 3: Fallback - .item-preview__wrapper .item-preview__list li img
    if (images.size === 0) {
      const previewList = doc.querySelector('.item-preview__wrapper .item-preview__list');
      if (previewList) {
        const listItems = previewList.querySelectorAll('li');
        listItems.forEach(li => {
          const imgs = li.querySelectorAll('img');
          imgs.forEach(img => {
            // Prioritize data-src over src because lazy-loaded images have lazy.svg in src
            const src = img.getAttribute('data-src') ||
                       img.dataset?.src ||
                       img.getAttribute('data-lazy') ||
                       img.dataset?.lazy ||
                       img.getAttribute('data-original') ||
                       img.dataset?.original ||
                       img.getAttribute('src');

            if (src && !src.includes('lazy.svg') && !src.includes('placeholder') &&
                !src.includes('data:image') && !src.includes('logo')) {
              const normalized = YamiDOMHelpers.normalizeURL(src);
              const highRes = YamiDOMHelpers.getHighResImageURL(normalized);
              images.add(highRes);
            }
          });
        });
      }
    }

    // Strategy 4: Old JSON-LD helper method (final fallback)
    if (images.size === 0) {
      const jsonld = YamiDOMHelpers.extractJSONLD(doc);
      if (jsonld && jsonld.image) {
        if (Array.isArray(jsonld.image)) {
          jsonld.image.forEach(url => {
            if (!url.includes('logo')) {
              const normalized = YamiDOMHelpers.normalizeURL(url);
              const highRes = YamiDOMHelpers.getHighResImageURL(normalized);
              images.add(highRes);
            }
          });
        } else if (typeof jsonld.image === 'string') {
          if (!jsonld.image.includes('logo')) {
            const normalized = YamiDOMHelpers.normalizeURL(jsonld.image);
            const highRes = YamiDOMHelpers.getHighResImageURL(normalized);
            images.add(highRes);
          }
        }
      }
    }

    return Array.from(images).filter(url => url && url.length > 0).slice(0, 10);
  }

  static extractDescriptionFromDoc(doc) {
    // Strategy 1: Format specifications as description
    const specs = this.extractSpecificationsFromDoc(doc);
    if (specs && Object.keys(specs).length > 0) {
      let description = '';
      for (const [key, value] of Object.entries(specs)) {
        description += `${key}: ${value}\n`;
      }
      return description.trim();
    }

    // Strategy 2: JSON-LD description (fallback)
    const jsonld = YamiDOMHelpers.extractJSONLD(doc);
    if (jsonld && jsonld.description) {
      return jsonld.description;
    }

    // Strategy 3: Meta description (last resort)
    const metaDesc = doc.querySelector('meta[name="description"], meta[property="og:description"]');
    if (metaDesc) {
      return metaDesc.getAttribute('content');
    }

    return '';
  }

  static extractBulletPointsFromDoc(doc) {
    const bulletPoints = [];

    // Strategy 1: Look within .item-desc__content for H2 "Product Highlights"
    const itemDescContent = doc.querySelector('.item-desc__content');
    if (itemDescContent) {
      const h2Headings = itemDescContent.querySelectorAll('h2.item-desc__title');
      for (const h2 of h2Headings) {
        if (h2.textContent.trim().toLowerCase() === 'product highlights') {
          const ul = h2.nextElementSibling;
          if (ul && ul.tagName === 'UL' && ul.classList.contains('item-desc__list')) {
            const bullets = ul.querySelectorAll('li');
            bullets.forEach(bullet => {
              const text = bullet.textContent.trim();
              if (text && text.length > 0) {
                bulletPoints.push(text);
              }
            });
            break;
          }
        }
      }
    }

    // Strategy 2: Fallback - first UL.item-desc__list
    if (bulletPoints.length === 0 && itemDescContent) {
      const ul = itemDescContent.querySelector('ul.item-desc__list');
      if (ul) {
        const bullets = ul.querySelectorAll('li');
        bullets.forEach(bullet => {
          const text = bullet.textContent.trim();
          if (text && text.length > 0) {
            bulletPoints.push(text);
          }
        });
      }
    }

    // Strategy 3: Global search
    if (bulletPoints.length === 0) {
      const allHeadings = doc.querySelectorAll('h2, h3, h4');
      for (const heading of allHeadings) {
        const headingText = heading.textContent.trim().toLowerCase();
        if (headingText === 'product highlights' || headingText.includes('product highlight')) {
          let nextElement = heading.nextElementSibling;
          while (nextElement) {
            if (nextElement.tagName === 'UL' || nextElement.tagName === 'OL') {
              const bullets = nextElement.querySelectorAll('li');
              bullets.forEach(bullet => {
                const text = bullet.textContent.trim();
                if (text && text.length > 0) {
                  bulletPoints.push(text);
                }
              });
              break;
            }
            nextElement = nextElement.nextElementSibling;
          }
          if (bulletPoints.length > 0) break;
        }
      }
    }

    return bulletPoints;
  }

  static extractSpecificationsFromDoc(doc) {
    const specs = {};

    // Strategy 1: Look for H3 "Specifications" heading → TABLE.specification
    const allH3Headings = doc.querySelectorAll('h3.item-desc__title');
    for (const h3 of allH3Headings) {
      if (h3.textContent.trim().toLowerCase() === 'specifications') {
        const table = h3.nextElementSibling;
        if (table && table.tagName === 'TABLE' && table.classList.contains('specification')) {
          const rows = table.querySelectorAll('tr');
          rows.forEach(row => {
            const cells = row.querySelectorAll('td, th');
            if (cells.length >= 2) {
              const key = cells[0].textContent.trim();
              const value = cells[1].textContent.trim();
              if (key && value) {
                specs[key] = value;
              }
            }
          });
          break;
        }
      }
    }

    // Strategy 2: Fallback - direct TABLE.specification selector
    if (Object.keys(specs).length === 0) {
      const table = doc.querySelector('table.specification');
      if (table) {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td, th');
          if (cells.length >= 2) {
            const key = cells[0].textContent.trim();
            const value = cells[1].textContent.trim();
            if (key && value) {
              specs[key] = value;
            }
          }
        });
      }
    }

    // Strategy 3: Global search for "Specifications" or "Details" heading
    if (Object.keys(specs).length === 0) {
      const allHeadings = doc.querySelectorAll('h3, h4');
      for (const heading of allHeadings) {
        const headingText = heading.textContent.trim().toLowerCase();
        if (headingText === 'specifications' || headingText === 'details' ||
            headingText.includes('specification') || headingText.includes('detail')) {
          let nextElement = heading.nextElementSibling;
          while (nextElement) {
            if (nextElement.tagName === 'TABLE') {
              const rows = nextElement.querySelectorAll('tr');
              rows.forEach(row => {
                const cells = row.querySelectorAll('td, th');
                if (cells.length >= 2) {
                  const key = cells[0].textContent.trim();
                  const value = cells[1].textContent.trim();
                  if (key && value) {
                    specs[key] = value;
                  }
                }
              });
              break;
            }
            nextElement = nextElement.nextElementSibling;
          }
          if (Object.keys(specs).length > 0) break;
        }
      }
    }

    return specs;
  }

  /**
   * Extract product links from category/search page
   * @returns {Array<Object>} Array of product link objects
   */
  static extractProductLinksFromPage() {
    const productLinks = [];
    const seenIDs = new Set();

    // Primary selector: Category items with data-goods_id
    const categoryCards = document.querySelectorAll('.category-items div[data-goods_id]');

    if (categoryCards.length > 0) {
      categoryCards.forEach(card => {
        const goodsId = card.getAttribute('data-goods_id');
        if (goodsId && !seenIDs.has(goodsId)) {
          seenIDs.add(goodsId);

          // Find the product link within this card
          const link = card.querySelector('a[href*="/p/"]');
          if (link) {
            productLinks.push({
              productID: goodsId,
              url: YamiDOMHelpers.normalizeURL(link.href),
              element: card
            });
          }
        }
      });
    } else {
      // Fallback selectors for other page types
      const selectors = [
        '.bff-item a[href*="/p/"]',
        '.product-card a[href*="/p/"]',
        'a[href*="/p/"]'
      ];

      selectors.forEach(selector => {
        const links = document.querySelectorAll(selector);

        links.forEach(link => {
          const href = link.getAttribute('href');
          if (!href) return;

          // Extract product ID from URL pattern: /p/{slug}/{id}
          const idMatch = href.match(/\/p\/[^\/]+\/(\d+)/);
          if (idMatch && !seenIDs.has(idMatch[1])) {
            const productID = idMatch[1];
            seenIDs.add(productID);

            const listingElement = YamiDOMHelpers.closest(link, '.bff-item') ||
                                    YamiDOMHelpers.closest(link, '.product-card') ||
                                    YamiDOMHelpers.closest(link, '[data-qa="product"]');

            productLinks.push({
              productID: productID,
              url: YamiDOMHelpers.normalizeURL(href),
              element: listingElement
            });
          }
        });
      });
    }

    return productLinks;
  }

  /**
   * Extract data from a specific document (for fetched pages in bulk scraping)
   * MUST MATCH Amazon format exactly
   * @param {Document} doc - Document to extract from
   * @param {string} productID - Product ID
   * @param {string} url - Product URL
   * @returns {Object} Product data
   */
  static extractFromDocument(doc, productID, url) {
    const specs = this.extractSpecificationsFromDoc(doc);
    const countryOfOrigin = specs['Brand Origin'] || specs['Origin'] || specs['Country of Origin'] || specs['Country'] || '';

    return {
      asin: productID,
      url: url,
      scrapedAt: new Date().toISOString(),
      title: this.extractTitleFromDoc(doc),
      price: this.extractPriceFromDoc(doc),
      deliveryFee: '$5.99', // Always set to 5.99 for Yami products
      images: this.extractImagesFromDoc(doc),
      description: this.extractDescriptionFromDoc(doc),
      bulletPoints: this.extractBulletPointsFromDoc(doc),
      specifications: specs,
      countryOfOrigin: countryOfOrigin,
      source: 'yami' // Add source field
    };
  }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = YamiDataExtractor;
}
