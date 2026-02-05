/**
 * CostcoDataExtractor - Data extraction logic for Costco.com
 * MUST MATCH Amazon/Yami DataExtractor.js format exactly
 * Extracts product data using multiple fallback strategies
 *
 * NOTE: Selectors are best-guesses based on common e-commerce patterns.
 * Run the debug scripts on actual Costco pages and update selectors as needed.
 */

class CostcoDataExtractor {
  // ===== Current Page Extraction =====

  /**
   * Extract complete product data from current page
   * MATCHES Amazon/Yami extractProductData() format EXACTLY
   * @returns {Object} Product data object
   */
  static extractProductData() {
    const productID = CostcoDOMHelpers.extractProductID();

    return {
      asin: productID, // Use "asin" for eBay backend compatibility
      title: this.getTitle(),
      price: this.getPrice(),
      deliveryFee: this.getDeliveryFee(),
      images: this.getImages(),
      description: this.getDescription(),
      bulletPoints: this.getBulletPoints(),
      specifications: this.getSpecifications(),
      url: window.location.href,
      scrapedAt: new Date().toISOString(),
      source: 'costco'
    };
  }

  /**
   * Extract product title with multiple fallback strategies
   * @returns {string} Product title
   */
  static getTitle() {
    // Strategy 1: JSON-LD structured data (most reliable)
    const jsonld = CostcoDOMHelpers.extractJSONLD(document);
    if (jsonld && jsonld.name) {
      return jsonld.name;
    }

    // Strategy 2: H1 tag (usually product name)
    const h1 = document.querySelector('h1');
    if (h1) {
      return h1.textContent.trim();
    }

    // Strategy 3: Product title specific selectors
    const titleSelectors = [
      '[data-testid="product-title"]',
      '[class*="product-title"]',
      '[class*="ProductTitle"]',
      '[class*="product-name"]',
      '[class*="ProductName"]',
      '.product-h1-container h1',
      '#product-title'
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    // Strategy 4: Meta tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      return ogTitle.getAttribute('content');
    }

    // Strategy 5: Title tag (less reliable)
    const titleTag = document.querySelector('title');
    if (titleTag) {
      const title = titleTag.textContent.trim();
      // Remove site suffix like " | Costco"
      return title.replace(/\s*[|–-]\s*Costco.*$/i, '').trim();
    }

    return null;
  }

  /**
   * Extract current price with multiple fallback strategies
   * Prioritizes the actual displayed/sale price over JSON-LD (which may show original price)
   * @returns {string} Formatted price (e.g., "$35.99")
   */
  static getPrice() {
    // Strategy 1: Costco-specific price selectors (get actual sale price first)
    // These selectors target the current displayed price, not the "was" price
    const costcoPriceSelectors = [
      // Current price container - most reliable for sale prices
      '[data-testid="single-price-content"]',
      // Price container that shows the actual price
      '[data-testid="price"] [data-testid="single-price-content"]',
      // Build price from whole and decimal parts
      '[data-testid="Text_single-price-whole-value"]'
    ];

    for (const selector of costcoPriceSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const priceText = element.textContent.trim();
        // Match first dollar amount only (ignore "was" prices that come after)
        const priceMatch = priceText.match(/^\$?([\d,]+\.?\d*)/);
        if (priceMatch) {
          const price = CostcoDOMHelpers.parsePrice('$' + priceMatch[1]);
          if (price !== null && price > 0) {
            return CostcoDOMHelpers.formatPrice(price);
          }
        }
      }
    }

    // Strategy 2: Build price from whole and decimal value parts
    const wholeValue = document.querySelector('[data-testid="Text_single-price-whole-value"]');
    const decimalValue = document.querySelector('[data-testid="Text_single-price-decimal-value"]');
    if (wholeValue) {
      const whole = wholeValue.textContent.trim();
      const decimal = decimalValue ? decimalValue.textContent.trim() : '99';
      const price = parseFloat(`${whole}.${decimal}`);
      if (!isNaN(price) && price > 0) {
        return CostcoDOMHelpers.formatPrice(price);
      }
    }

    // Strategy 3: JSON-LD offers price (fallback - may show original price, not sale price)
    const jsonld = CostcoDOMHelpers.extractJSONLD(document);
    if (jsonld && jsonld.offers) {
      const offers = Array.isArray(jsonld.offers) ? jsonld.offers[0] : jsonld.offers;
      const price = parseFloat(offers.price || offers.lowPrice);
      if (!isNaN(price)) {
        return CostcoDOMHelpers.formatPrice(price);
      }
    }

    // Strategy 4: Generic price selectors
    const genericPriceSelectors = [
      '[data-testid="product-price"]',
      '[class*="your-price"] [class*="value"]',
      '.price-value',
      '.product-price',
      '[itemprop="price"]'
    ];

    for (const selector of genericPriceSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const priceText = element.textContent.trim();
        const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
        if (priceMatch) {
          const price = CostcoDOMHelpers.parsePrice(priceMatch[0]);
          if (price !== null && price > 0) {
            return CostcoDOMHelpers.formatPrice(price);
          }
        }
      }
    }

    // Strategy 5: Meta tags
    const ogPrice = document.querySelector('meta[property="product:price:amount"]');
    if (ogPrice) {
      const price = parseFloat(ogPrice.getAttribute('content'));
      if (!isNaN(price)) {
        return CostcoDOMHelpers.formatPrice(price);
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

    // Check for free shipping
    if (bodyText.toLowerCase().includes('free shipping')) {
      return 'FREE';
    }

    // Look for specific shipping selectors
    const shippingSelectors = [
      '[class*="shipping"]',
      '[class*="delivery"]',
      '[data-testid*="shipping"]',
      '[data-testid*="delivery"]'
    ];

    for (const selector of shippingSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();
        if (text.toLowerCase().includes('free')) {
          return 'FREE';
        }
        // Look for price in shipping text
        const priceMatch = text.match(/\$[\d,]+\.?\d*/);
        if (priceMatch) {
          return priceMatch[0];
        }
      }
    }

    // Costco often has flat shipping or includes it
    return 'Included';
  }

  /**
   * Extract product images with high-resolution URLs
   * Only scrapes from product-hero container to avoid unrelated images
   * @returns {Array<string>} Array of image URLs (up to 10)
   */
  static getImages() {
    const images = new Set();

    // Strategy 1: Costco-specific - images from product-hero container
    // Pattern: div[data-testid="product-hero"] contains multiple .mui-79elbk divs with lazy-loaded images
    const productHero = document.querySelector('[data-testid="product-hero"]');
    if (productHero) {
      // Find all image containers within product-hero
      const imageContainers = productHero.querySelectorAll('.mui-79elbk, [class*="media-container"]');
      imageContainers.forEach(container => {
        const img = container.querySelector('img[loading="lazy"], img');
        if (img) {
          const src = img.src || img.getAttribute('data-src');
          if (src && !src.includes('Logo') && !src.includes('logo') && !src.includes('placeholder')) {
            const highRes = CostcoDOMHelpers.getHighResImageURL(src);
            images.add(highRes);
          }
        }
      });

      // Also try direct img selection within product-hero
      if (images.size === 0) {
        const heroImages = productHero.querySelectorAll('img[loading="lazy"]');
        heroImages.forEach(img => {
          const src = img.src || img.getAttribute('data-src');
          if (src && !src.includes('Logo') && !src.includes('logo') && !src.includes('placeholder')) {
            const highRes = CostcoDOMHelpers.getHighResImageURL(src);
            images.add(highRes);
          }
        });
      }
    }

    // Strategy 2: Fallback - images with "Enlarge Product Preview" alt text
    if (images.size === 0) {
      const previewImages = document.querySelectorAll('img[alt*="Enlarge Product Preview"], img[alt*="Product Preview"]');
      previewImages.forEach(img => {
        const src = img.src;
        if (src && !src.includes('Logo') && !src.includes('logo')) {
          const highRes = CostcoDOMHelpers.getHighResImageURL(src);
          images.add(highRes);
        }
      });
    }

    // Strategy 3: JSON-LD Product schema (good fallback)
    if (images.size === 0) {
      const jsonld = CostcoDOMHelpers.extractJSONLD(document);
      if (jsonld && jsonld.image) {
        const imageUrls = Array.isArray(jsonld.image) ? jsonld.image : [jsonld.image];
        imageUrls.forEach(url => {
          if (url && !url.includes('logo') && !url.includes('placeholder')) {
            const normalized = CostcoDOMHelpers.normalizeURL(url);
            const highRes = CostcoDOMHelpers.getHighResImageURL(normalized);
            images.add(highRes);
          }
        });
      }
    }

    // Strategy 4: Meta og:image
    if (images.size === 0) {
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) {
        const content = ogImage.getAttribute('content');
        if (content && !content.includes('logo')) {
          const normalized = CostcoDOMHelpers.normalizeURL(content);
          const highRes = CostcoDOMHelpers.getHighResImageURL(normalized);
          images.add(highRes);
        }
      }
    }

    return Array.from(images).filter(url => url && url.length > 0).slice(0, 10);
  }

  /**
   * Extract product description
   * @returns {string} Product description
   */
  static getDescription() {
    // Strategy 1: JSON-LD description
    const jsonld = CostcoDOMHelpers.extractJSONLD(document);
    if (jsonld && jsonld.description) {
      return jsonld.description;
    }

    // Strategy 2: Description-specific selectors
    const descSelectors = [
      '[data-testid="product-description"]',
      '[class*="product-description"]',
      '[class*="ProductDescription"]',
      '[class*="product-details"]',
      '[class*="ProductDetails"]',
      '#product-description',
      '.product-info-description'
    ];

    for (const selector of descSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    // Strategy 3: Format specifications as description
    const specs = this.getSpecifications();
    if (specs && Object.keys(specs).length > 0) {
      let description = '';
      for (const [key, value] of Object.entries(specs)) {
        description += `${key}: ${value}\n`;
      }
      return description.trim();
    }

    // Strategy 4: Meta description
    const metaDesc = document.querySelector('meta[name="description"], meta[property="og:description"]');
    if (metaDesc) {
      return metaDesc.getAttribute('content');
    }

    return '';
  }

  /**
   * Extract bullet points / key features from Product Details section
   * @returns {Array<string>} Array of bullet points
   */
  static getBulletPoints() {
    const bulletPoints = [];

    // Strategy 1: Costco-specific #product-details-summary
    const detailsSummary = document.querySelector('#product-details-summary');
    if (detailsSummary) {
      // Parse the content - it uses <strong> tags for section headers
      // and text content between <br> tags

      // Extract sections marked with <strong> tags
      const strongTags = detailsSummary.querySelectorAll('strong');
      strongTags.forEach(strong => {
        const sectionTitle = strong.textContent.trim();
        // Get text after this strong tag until next strong or end
        let nextNode = strong.nextSibling;
        let sectionContent = '';

        while (nextNode) {
          if (nextNode.nodeType === Node.TEXT_NODE) {
            sectionContent += nextNode.textContent;
          } else if (nextNode.tagName === 'STRONG') {
            break;
          } else if (nextNode.tagName === 'BR') {
            // Skip br tags
          } else {
            sectionContent += nextNode.textContent || '';
          }
          nextNode = nextNode.nextSibling;
        }

        sectionContent = sectionContent.trim();
        if (sectionTitle && sectionContent) {
          bulletPoints.push(`${sectionTitle}: ${sectionContent}`);
        } else if (sectionTitle && !sectionContent) {
          // Just the title (like "Limit 5 Per Membership")
          bulletPoints.push(sectionTitle);
        }
      });

      // If no strong tags found, just get the text content
      if (bulletPoints.length === 0) {
        const text = detailsSummary.textContent.trim();
        // Split by double line breaks or common separators
        const lines = text.split(/\n\n+|\r\n\r\n+/).filter(line => line.trim().length > 10);
        lines.slice(0, 5).forEach(line => {
          bulletPoints.push(line.trim());
        });
      }
    }

    // Strategy 2: Feature list selectors (fallback)
    if (bulletPoints.length === 0) {
      const featureSelectors = [
        '[class*="feature"] li',
        '[class*="highlight"] li',
        '[data-testid="features"] li',
        '.product-features li'
      ];

      for (const selector of featureSelectors) {
        const items = document.querySelectorAll(selector);
        if (items.length > 0) {
          items.forEach(item => {
            const text = item.textContent.trim();
            if (text && text.length > 5) {
              bulletPoints.push(text);
            }
          });
          if (bulletPoints.length > 0) break;
        }
      }
    }

    // Strategy 3: Extract images from Product Details syndigo section (shadow DOM)
    // These are marketing/feature images that should be included with bullet points
    // The syndigo content is inside a shadow root, so we need to access it properly
    const syndigoPageElement = document.querySelector('syndigo-powerpage');
    if (syndigoPageElement && syndigoPageElement.shadowRoot) {
      const shadowRoot = syndigoPageElement.shadowRoot;

      // Find all picture elements - use the <img> src directly (the full image),
      // NOT the srcset entries which can be zoomed-in/cropped art-directed versions
      const pictureElements = shadowRoot.querySelectorAll('picture');
      pictureElements.forEach(picture => {
        const img = picture.querySelector('img');
        if (img) {
          const src = img.src || img.getAttribute('data-src');
          if (src && !src.includes('logo') && !src.includes('placeholder') && !src.includes('data:image')) {
            let imageUrl = src;
            if (imageUrl.startsWith('//')) {
              imageUrl = 'https:' + imageUrl;
            }
            imageUrl = CostcoDOMHelpers.getHighResImageURL(imageUrl);
            bulletPoints.push(`[IMAGE]: ${imageUrl}`);
          }
        }
      });

      // Fallback: standalone img elements in the shadow DOM (not inside <picture>)
      if (bulletPoints.filter(bp => bp.startsWith('[IMAGE]:')).length === 0) {
        const shadowImages = shadowRoot.querySelectorAll('.syndigo-featureset img, .asset-container img');
        shadowImages.forEach(img => {
          const src = img.src || img.getAttribute('data-src');
          if (src && !src.includes('logo') && !src.includes('placeholder') && !src.includes('data:image')) {
            let imageUrl = src;
            if (imageUrl.startsWith('//')) {
              imageUrl = 'https:' + imageUrl;
            }
            imageUrl = CostcoDOMHelpers.getHighResImageURL(imageUrl);
            bulletPoints.push(`[IMAGE]: ${imageUrl}`);
          }
        });
      }
    }

    // Strategy 4: Fallback - try direct query in case shadow DOM is not used
    if (bulletPoints.filter(bp => bp.startsWith('[IMAGE]:')).length === 0) {
      const syndigoContainer = document.querySelector('.syndigo-featureset-layout.syndigo-feature-stacked');
      if (syndigoContainer) {
        const syndigoImages = syndigoContainer.querySelectorAll('picture img, img');
        syndigoImages.forEach(img => {
          const src = img.src || img.getAttribute('data-src');
          if (src && !src.includes('logo') && !src.includes('placeholder') && !src.includes('data:image')) {
            const imageUrl = CostcoDOMHelpers.getHighResImageURL(src);
            bulletPoints.push(`[IMAGE]: ${imageUrl}`);
          }
        });
      }
    }

    return bulletPoints;
  }

  /**
   * Extract product specifications / attributes
   * @returns {Object} Key-value pairs of specifications
   */
  static getSpecifications() {
    const specs = {};

    // Strategy 1: Costco-specific ProductSpecifications table
    // Pattern: <table data-testid="Table_ProductSpecifications" id="ProductSpecifications">
    const costcoSpecTable = document.querySelector('[data-testid="Table_ProductSpecifications"], #ProductSpecifications');
    if (costcoSpecTable) {
      const rows = costcoSpecTable.querySelectorAll('tr');
      rows.forEach(row => {
        const th = row.querySelector('th');
        const td = row.querySelector('td');
        if (th && td) {
          const key = th.textContent.trim();
          const value = td.textContent.trim();
          if (key && value) {
            specs[key] = value;
          }
        }
      });
    }

    // Strategy 2: Generic specification table selectors (fallback)
    if (Object.keys(specs).length === 0) {
      const specTableSelectors = [
        '[class*="specification"] tr',
        '[class*="Specification"] tr',
        '[class*="spec-table"] tr',
        '[class*="SpecTable"] tr',
        '[data-testid="specifications"] tr',
        '.product-specs tr',
        '.product-info-specs tr'
      ];

      for (const selector of specTableSelectors) {
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

    // Strategy 3: Definition list format
    if (Object.keys(specs).length === 0) {
      const dlElements = document.querySelectorAll('dl');
      dlElements.forEach(dl => {
        const terms = dl.querySelectorAll('dt');
        const definitions = dl.querySelectorAll('dd');
        terms.forEach((term, index) => {
          if (definitions[index]) {
            const key = term.textContent.trim();
            const value = definitions[index].textContent.trim();
            if (key && value) {
              specs[key] = value;
            }
          }
        });
      });
    }

    // Strategy 4: Key-value pairs in specific containers
    if (Object.keys(specs).length === 0) {
      const specContainers = document.querySelectorAll('[class*="spec"], [class*="detail"], [class*="attribute"]');
      specContainers.forEach(container => {
        const label = container.querySelector('[class*="label"], [class*="key"], [class*="name"]');
        const value = container.querySelector('[class*="value"], [class*="data"]');
        if (label && value) {
          specs[label.textContent.trim()] = value.textContent.trim();
        }
      });
    }

    return specs;
  }

  // ===== Parsed Document Extraction (for bulk scraping) =====

  static extractTitleFromDoc(doc) {
    const jsonld = CostcoDOMHelpers.extractJSONLD(doc);
    if (jsonld && jsonld.name) return jsonld.name;

    const h1 = doc.querySelector('h1');
    if (h1) return h1.textContent.trim();

    const ogTitle = doc.querySelector('meta[property="og:title"]');
    if (ogTitle) return ogTitle.getAttribute('content');

    return null;
  }

  static extractPriceFromDoc(doc) {
    // Strategy 1: Costco-specific price selectors (get actual sale price first)
    const costcoPriceSelectors = [
      '[data-testid="single-price-content"]',
      '[data-testid="price"] [data-testid="single-price-content"]'
    ];

    for (const selector of costcoPriceSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const priceText = element.textContent.trim();
        const priceMatch = priceText.match(/^\$?([\d,]+\.?\d*)/);
        if (priceMatch) {
          const price = CostcoDOMHelpers.parsePrice('$' + priceMatch[1]);
          if (price !== null && price > 0) {
            return CostcoDOMHelpers.formatPrice(price);
          }
        }
      }
    }

    // Strategy 2: Build price from whole and decimal value parts
    const wholeValue = doc.querySelector('[data-testid="Text_single-price-whole-value"]');
    const decimalValue = doc.querySelector('[data-testid="Text_single-price-decimal-value"]');
    if (wholeValue) {
      const whole = wholeValue.textContent.trim();
      const decimal = decimalValue ? decimalValue.textContent.trim() : '99';
      const price = parseFloat(`${whole}.${decimal}`);
      if (!isNaN(price) && price > 0) {
        return CostcoDOMHelpers.formatPrice(price);
      }
    }

    // Strategy 3: JSON-LD Product schema (fallback)
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        let productData = data;

        if (data['@graph']) {
          productData = data['@graph'].find(item => item['@type'] === 'Product');
        }

        if (productData && productData['@type'] === 'Product' && productData.offers) {
          const offers = Array.isArray(productData.offers) ? productData.offers[0] : productData.offers;
          const price = parseFloat(offers.price || offers.lowPrice);
          if (!isNaN(price) && price > 0) {
            return CostcoDOMHelpers.formatPrice(price);
          }
        }
      } catch (e) {
        continue;
      }
    }

    // Strategy 4: Generic price selectors
    const priceSelectors = [
      '[data-testid="product-price"]',
      '.price-value',
      '.product-price',
      '[itemprop="price"]'
    ];

    for (const selector of priceSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const priceText = element.textContent.trim();
        const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
        if (priceMatch) {
          const price = CostcoDOMHelpers.parsePrice(priceMatch[0]);
          if (price !== null && price > 0) {
            return CostcoDOMHelpers.formatPrice(price);
          }
        }
      }
    }

    return null;
  }

  static extractDeliveryFeeFromDoc(doc) {
    const bodyText = doc.body.textContent;
    if (bodyText.toLowerCase().includes('free shipping')) {
      return 'FREE';
    }
    return 'Included';
  }

  static extractImagesFromDoc(doc) {
    const images = new Set();

    // Strategy 1: Costco-specific - images from product-hero container
    const productHero = doc.querySelector('[data-testid="product-hero"]');
    if (productHero) {
      // Find all image containers within product-hero
      const imageContainers = productHero.querySelectorAll('.mui-79elbk, [class*="media-container"]');
      imageContainers.forEach(container => {
        const img = container.querySelector('img[loading="lazy"], img');
        if (img) {
          const src = img.getAttribute('src') || img.getAttribute('data-src');
          if (src && !src.includes('Logo') && !src.includes('logo') && !src.includes('placeholder')) {
            const highRes = CostcoDOMHelpers.getHighResImageURL(src);
            images.add(highRes);
          }
        }
      });

      // Also try direct img selection within product-hero
      if (images.size === 0) {
        const heroImages = productHero.querySelectorAll('img[loading="lazy"]');
        heroImages.forEach(img => {
          const src = img.getAttribute('src') || img.getAttribute('data-src');
          if (src && !src.includes('Logo') && !src.includes('logo') && !src.includes('placeholder')) {
            const highRes = CostcoDOMHelpers.getHighResImageURL(src);
            images.add(highRes);
          }
        });
      }
    }

    // Strategy 2: Fallback - images with "Enlarge Product Preview" alt text
    if (images.size === 0) {
      const previewImages = doc.querySelectorAll('img[alt*="Enlarge Product Preview"], img[alt*="Product Preview"]');
      previewImages.forEach(img => {
        const src = img.getAttribute('src');
        if (src && !src.includes('Logo') && !src.includes('logo')) {
          const highRes = CostcoDOMHelpers.getHighResImageURL(src);
          images.add(highRes);
        }
      });
    }

    // Strategy 3: JSON-LD
    if (images.size === 0) {
      const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);
          let productData = data;

          if (data['@graph']) {
            productData = data['@graph'].find(item => item['@type'] === 'Product');
          }

          if (productData && productData['@type'] === 'Product' && productData.image) {
            const imageUrls = Array.isArray(productData.image) ? productData.image : [productData.image];
            imageUrls.forEach(url => {
              if (url && !url.includes('logo')) {
                const normalized = CostcoDOMHelpers.normalizeURL(url);
                const highRes = CostcoDOMHelpers.getHighResImageURL(normalized);
                images.add(highRes);
              }
            });
            if (images.size >= 3) break;
          }
        } catch (e) {
          continue;
        }
      }
    }

    // Strategy 4: Meta og:image
    if (images.size === 0) {
      const ogImage = doc.querySelector('meta[property="og:image"]');
      if (ogImage) {
        const content = ogImage.getAttribute('content');
        if (content) {
          images.add(CostcoDOMHelpers.normalizeURL(content));
        }
      }
    }

    return Array.from(images).filter(url => url && url.length > 0).slice(0, 10);
  }

  static extractDescriptionFromDoc(doc) {
    const jsonld = CostcoDOMHelpers.extractJSONLD(doc);
    if (jsonld && jsonld.description) {
      return jsonld.description;
    }

    const metaDesc = doc.querySelector('meta[name="description"], meta[property="og:description"]');
    if (metaDesc) {
      return metaDesc.getAttribute('content');
    }

    return '';
  }

  static extractBulletPointsFromDoc(doc) {
    const bulletPoints = [];

    // Strategy 1: Costco-specific #product-details-summary
    const detailsSummary = doc.querySelector('#product-details-summary');
    if (detailsSummary) {
      // Extract sections marked with <strong> tags
      const strongTags = detailsSummary.querySelectorAll('strong');
      strongTags.forEach(strong => {
        const sectionTitle = strong.textContent.trim();
        // Get text after this strong tag until next strong or end
        let nextNode = strong.nextSibling;
        let sectionContent = '';

        while (nextNode) {
          if (nextNode.nodeType === Node.TEXT_NODE) {
            sectionContent += nextNode.textContent;
          } else if (nextNode.tagName === 'STRONG') {
            break;
          } else if (nextNode.tagName === 'BR') {
            // Skip br tags
          } else {
            sectionContent += nextNode.textContent || '';
          }
          nextNode = nextNode.nextSibling;
        }

        sectionContent = sectionContent.trim();
        if (sectionTitle && sectionContent) {
          bulletPoints.push(`${sectionTitle}: ${sectionContent}`);
        } else if (sectionTitle && !sectionContent) {
          // Just the title (like "Limit 5 Per Membership")
          bulletPoints.push(sectionTitle);
        }
      });

      // If no strong tags found, just get the text content
      if (bulletPoints.length === 0) {
        const text = detailsSummary.textContent.trim();
        const lines = text.split(/\n\n+|\r\n\r\n+/).filter(line => line.trim().length > 10);
        lines.slice(0, 5).forEach(line => {
          bulletPoints.push(line.trim());
        });
      }
    }

    // Strategy 2: Feature list selectors (fallback)
    if (bulletPoints.length === 0) {
      const featureSelectors = [
        '[class*="feature"] li',
        '[class*="highlight"] li',
        '.product-features li'
      ];

      for (const selector of featureSelectors) {
        const items = doc.querySelectorAll(selector);
        if (items.length > 0) {
          items.forEach(item => {
            const text = item.textContent.trim();
            if (text && text.length > 5) {
              bulletPoints.push(text);
            }
          });
          if (bulletPoints.length > 0) break;
        }
      }
    }

    // Strategy 3: Extract images from Product Details syndigo section
    // Note: Shadow DOM content won't be available in fetched documents since JS doesn't execute
    // Try to find any syndigo-related images that might be in the static HTML
    const syndigoContainer = doc.querySelector('.syndigo-featureset-layout.syndigo-feature-stacked, syndigo-powerpage, [class*="syndigo"]');
    if (syndigoContainer) {
      // Use <img> src directly from <picture> elements (full image, not zoomed srcset crops)
      const pictureElements = syndigoContainer.querySelectorAll('picture');
      pictureElements.forEach(picture => {
        const img = picture.querySelector('img');
        if (img) {
          const src = img.getAttribute('src') || img.getAttribute('data-src');
          if (src && !src.includes('logo') && !src.includes('placeholder') && !src.includes('data:image')) {
            let imageUrl = src;
            if (imageUrl.startsWith('//')) {
              imageUrl = 'https:' + imageUrl;
            }
            imageUrl = CostcoDOMHelpers.getHighResImageURL(imageUrl);
            bulletPoints.push(`[IMAGE]: ${imageUrl}`);
          }
        }
      });

      // Fallback to standalone img elements
      if (bulletPoints.filter(bp => bp.startsWith('[IMAGE]:')).length === 0) {
        const syndigoImages = syndigoContainer.querySelectorAll('img');
        syndigoImages.forEach(img => {
          const src = img.getAttribute('src') || img.getAttribute('data-src');
          if (src && !src.includes('logo') && !src.includes('placeholder') && !src.includes('data:image')) {
            let imageUrl = src;
            if (imageUrl.startsWith('//')) {
              imageUrl = 'https:' + imageUrl;
            }
            imageUrl = CostcoDOMHelpers.getHighResImageURL(imageUrl);
            bulletPoints.push(`[IMAGE]: ${imageUrl}`);
          }
        });
      }
    }

    return bulletPoints;
  }

  static extractSpecificationsFromDoc(doc) {
    const specs = {};

    // Strategy 1: Costco-specific ProductSpecifications table
    const costcoSpecTable = doc.querySelector('[data-testid="Table_ProductSpecifications"], #ProductSpecifications');
    if (costcoSpecTable) {
      const rows = costcoSpecTable.querySelectorAll('tr');
      rows.forEach(row => {
        const th = row.querySelector('th');
        const td = row.querySelector('td');
        if (th && td) {
          const key = th.textContent.trim();
          const value = td.textContent.trim();
          if (key && value) {
            specs[key] = value;
          }
        }
      });
    }

    // Strategy 2: Generic specification table selectors (fallback)
    if (Object.keys(specs).length === 0) {
      const specTableSelectors = [
        '[class*="specification"] tr',
        '[class*="spec-table"] tr',
        '.product-specs tr'
      ];

      for (const selector of specTableSelectors) {
        const rows = doc.querySelectorAll(selector);
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
   * Extract product links from category/search page
   * @returns {Array<Object>} Array of product link objects
   */
  static extractProductLinksFromPage() {
    const productLinks = [];
    const seenIDs = new Set();

    // Strategy 1: Costco-specific ProductTile elements (from debug output)
    // Pattern: data-testid="ProductTile_XXXXXX" where XXXXXX is the product ID
    const productTiles = document.querySelectorAll('[data-testid^="ProductTile_"]');

    if (productTiles.length > 0) {
      productTiles.forEach(tile => {
        // Extract product ID from data-testid attribute
        const testId = tile.dataset.testid;
        const idMatch = testId.match(/ProductTile_(\d+)/);

        if (idMatch) {
          const productId = idMatch[1];

          if (!seenIDs.has(productId)) {
            seenIDs.add(productId);

            // Find the product link within this tile
            const link = tile.querySelector('a[href*=".product."]') ||
                        tile.querySelector('a[href*="/p/"]') ||
                        tile.querySelector('a[data-testid="Link"]');

            const href = link ? link.getAttribute('href') : null;

            productLinks.push({
              productID: productId,
              url: href ? CostcoDOMHelpers.normalizeURL(href) : `https://www.costco.com/product.${productId}.html`,
              element: tile
            });
          }
        }
      });
    }

    // Strategy 2: Grid items with product links (fallback)
    if (productLinks.length === 0) {
      const gridItems = document.querySelectorAll('.MuiGrid2-grid-xs-3');

      gridItems.forEach(item => {
        const link = item.querySelector('a[href*=".product."]') || item.querySelector('a[href*="/p/"]');

        if (link) {
          const href = link.getAttribute('href');
          // Extract ID from URL: .product.XXXXXX.html or /p/-/slug/XXXXXX
          const idMatch = href.match(/\.product\.(\d+)\.html/) ||
                         href.match(/\/p\/(?:-\/)?[^\/]+\/(\d+)/);

          if (idMatch && !seenIDs.has(idMatch[1])) {
            const productId = idMatch[1];
            seenIDs.add(productId);

            productLinks.push({
              productID: productId,
              url: CostcoDOMHelpers.normalizeURL(href),
              element: item
            });
          }
        }
      });
    }

    // Strategy 3: Find all product links and work backwards
    if (productLinks.length === 0) {
      const allProductLinks = document.querySelectorAll('a[href*="/p/"], a[href*=".product."]');

      allProductLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (!href || href.includes('onetrust')) return; // Skip cookie consent links

        // Extract ID from URL
        const idMatch = href.match(/\/p\/(?:-\/)?[^\/]+\/(\d+)/) ||
                       href.match(/\.product\.(\d+)\.html/) ||
                       href.match(/\/(\d{6,})(?:\?|$)/);

        if (idMatch && !seenIDs.has(idMatch[1])) {
          const productId = idMatch[1];
          seenIDs.add(productId);

          // Try to find parent card
          const card = CostcoDOMHelpers.closest(link, '[data-testid^="ProductTile_"]') ||
                      CostcoDOMHelpers.closest(link, '.MuiGrid2-grid-xs-3') ||
                      CostcoDOMHelpers.closest(link, '[class*="product"]') ||
                      link.parentElement;

          productLinks.push({
            productID: productId,
            url: CostcoDOMHelpers.normalizeURL(href),
            element: card
          });
        }
      });
    }

    return productLinks;
  }

  /**
   * Extract data from a specific document (for fetched pages in bulk scraping)
   * MUST MATCH Amazon/Yami format exactly
   * @param {Document} doc - Document to extract from
   * @param {string} productID - Product ID
   * @param {string} url - Product URL
   * @returns {Object} Product data
   */
  static extractFromDocument(doc, productID, url) {
    return {
      asin: productID,
      url: url,
      scrapedAt: new Date().toISOString(),
      title: this.extractTitleFromDoc(doc),
      price: this.extractPriceFromDoc(doc),
      deliveryFee: this.extractDeliveryFeeFromDoc(doc),
      images: this.extractImagesFromDoc(doc),
      description: this.extractDescriptionFromDoc(doc),
      bulletPoints: this.extractBulletPointsFromDoc(doc),
      specifications: this.extractSpecificationsFromDoc(doc),
      source: 'costco'
    };
  }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CostcoDataExtractor;
}
