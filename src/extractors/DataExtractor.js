/**
 * Data Extractor
 * Extracts product information from Amazon product pages (live DOM and parsed HTML documents)
 */
import { DOMHelpers } from '../utils/DOMHelpers.js';

export class DataExtractor {
  // ===== Current Page Extraction =====

  static extractProductData() {
    const variations = this.extractVariations();
    let images = this.getImages();

    // For variation products, append hiRes colorImages URLs for all colors on top of DOM images
    if (variations.hasVariations && Object.keys(variations.colorImages).length > 0) {
      const allColorUrls = [...new Set(Object.values(variations.colorImages).flat())];
      for (const url of allColorUrls) {
        if (!images.includes(url) && this._isValidImageUrl(url)) images.push(url);
      }
    }

    // Append size chart only if it's a real image URL (table-type has no CDN URL)
    if (variations.sizeChart && variations.sizeChart.type === 'image') {
      images = [...images, variations.sizeChart.url];
    }

    return {
      asin: DOMHelpers.extractASIN(),
      title: this.getTitle(),
      price: this.getPrice(),
      deliveryFee: this.getDeliveryFee(),
      isPrime: this.isPrimeEligible(),
      images,
      description: this.getDescription(),
      bulletPoints: this.getBulletPoints(),
      specifications: this.getSpecifications(),
      variations,
      url: window.location.href,
      scrapedAt: new Date().toISOString(),
      source: 'amazon',
      customizedFinalPrice: null
    };
  }

  // ===== Variation Extraction =====

  static extractVariations() {
    const result = {
      hasVariations: false,
      parentAsin: null,
      dimensions: [],
      validCombinations: [],
      colorImages: {},
      sizeChart: null
    };

    // === PRIMARY: Read swatch <li> elements from static HTML ===
    // These are always present at document_end regardless of JS execution state.
    const dimensionUls = document.querySelectorAll('ul[data-a-button-group]');
    if (!dimensionUls.length) return result;

    const dimensions = [];

    for (const ul of dimensionUls) {
      let groupData;
      try {
        groupData = JSON.parse(ul.getAttribute('data-a-button-group') || '{}');
      } catch (e) {
        continue;
      }
      const dimName = groupData.name; // e.g. "color_name", "size_name"
      if (!dimName) continue;

      const cleanName = dimName.replace(/_name$/, ''); // "color", "size"
      const items = [...ul.querySelectorAll('li[data-asin]')];
      if (!items.length) continue;

      const values = [];
      for (const li of items) {
        const asin = li.getAttribute('data-asin');
        if (!asin) continue;

        const isSelected = li.getAttribute('data-initiallyselected') === 'true';
        const isUnavailable = li.getAttribute('data-initiallyunavailable') === 'true';

        const entry = { asin, available: !isUnavailable };
        if (isSelected) entry.selected = true;

        // Per-swatch price (color swatches carry this; size swatches typically don't)
        const priceLabel = li.querySelector('.apex-pricetopay-accessibility-label');
        if (priceLabel) {
          const m = priceLabel.textContent.match(/\$[\d,]+\.\d{2}/);
          if (m) entry.price = m[0];
        }

        if (cleanName === 'color') {
          const img = li.querySelector('img.swatch-image');
          if (img) {
            entry.value = img.getAttribute('alt') || '';
            // Upgrade swatch thumbnail to full-size (remove _SS64_ / _AC_ size suffix)
            const src = img.getAttribute('src') || '';
            entry.swatchImageUrl = src.replace(/\._[A-Z]{2}\d+_\./g, '.').replace(/\._AC_\./, '.');
          }
        } else {
          // Size / Style / other text swatch
          const textEl = li.querySelector('.swatch-title-text-display');
          entry.value = textEl ? textEl.textContent.trim() : '';
        }

        if (entry.value) values.push(entry);
      }

      if (values.length > 0) {
        dimensions.push({ name: cleanName, values });
      }
    }

    if (!dimensions.length) return result;

    result.hasVariations = true;
    result.dimensions = dimensions;

    // === ENHANCEMENT 1: hiRes colorImages from ImageBlockBTF script ===
    const allScripts = [...document.querySelectorAll('script:not([src])')];
    const imgScript = allScripts.find(s =>
      s.textContent.includes('"colorImages"') && s.textContent.includes('jQuery.parseJSON')
    );
    if (imgScript) {
      try {
        const m = imgScript.textContent.match(/jQuery\.parseJSON\('([\s\S]+?)'\s*\)/);
        if (m) {
          const data = JSON.parse(m[1].replace(/\\'/g, "'"));
          if (data.colorImages) {
            for (const [color, imgs] of Object.entries(data.colorImages)) {
              const hiRes = imgs.filter(i => i.hiRes).map(i => i.hiRes);
              if (hiRes.length) result.colorImages[color] = hiRes;
            }
          }
        }
      } catch (e) {}
    }

    // Fallback colorImages: use upgraded swatch URLs for colors not in the script data
    const colorDim = dimensions.find(d => d.name === 'color');
    if (colorDim) {
      for (const v of colorDim.values) {
        if (v.swatchImageUrl && !result.colorImages[v.value]) {
          result.colorImages[v.value] = [v.swatchImageUrl];
        }
      }
    }

    // === ENHANCEMENT 2: parentAsin from any inline script ===
    const parentScript = allScripts.find(s => s.textContent.includes('parentAsin'));
    if (parentScript) {
      const m = parentScript.textContent.match(/parentAsin=([A-Z0-9]{10})/);
      if (m) result.parentAsin = m[1];
    }

    // === ENHANCEMENT 3: exact valid combinations from twister-js-init-dpx-data ===
    const twisterEl = document.getElementById('twister-js-init-dpx-data');
    if (twisterEl) {
      try {
        const twisterData = JSON.parse(twisterEl.textContent.trim());
        const dims = twisterData.sortedDimValuesForAllDims;
        const sortedVars = twisterData.sortedVariations || [];

        if (dims && sortedVars.length > 0) {
          const dimKeys = Object.keys(dims);
          let orderedKeys = [...dimKeys];
          if (dimKeys.length === 2) {
            const maxIdx0 = Math.max(...sortedVars.map(c => c[0]));
            if (maxIdx0 >= dims[dimKeys[0]].length) {
              orderedKeys = [dimKeys[1], dimKeys[0]];
            }
          }
          result.validCombinations = sortedVars.map(combo => {
            const combination = {};
            combo.forEach((dimValueIdx, pos) => {
              const dimKey = orderedKeys[pos];
              const val = dims[dimKey]?.[dimValueIdx];
              if (val) combination[dimKey.replace('_name', '')] = val.dimensionValueDisplayText;
            });
            return combination;
          });
        }
      } catch (e) {}
    }

    // === FALLBACK validCombinations: cross-product of available dimension values ===
    if (!result.validCombinations.length) {
      if (dimensions.length >= 2) {
        const dim0 = dimensions[0];
        const dim1 = dimensions[1];
        for (const v0 of dim0.values.filter(v => v.available)) {
          for (const v1 of dim1.values.filter(v => v.available)) {
            result.validCombinations.push({ [dim0.name]: v0.value, [dim1.name]: v1.value });
          }
        }
      } else {
        const dim = dimensions[0];
        result.validCombinations = dim.values
          .filter(v => v.available)
          .map(v => ({ [dim.name]: v.value }));
      }
    }

    result.sizeChart = this.extractSizeChart();
    return result;
  }

  static extractSizeChart() {
    // Size chart is pre-rendered inside .a-popover-preload in #sizeChartV2Data_feature_div
    const wrapper = document.querySelector(
      '#sizeChartV2Data_feature_div .fit-sizechartv2-tables-wrapper, ' +
      '#a-popover-sizeGuide .fit-sizechartv2-tables-wrapper, ' +
      '.fit-sizechartv2-tables-wrapper'
    );

    if (wrapper) {
      const charts = this._parseSizeChartTables(wrapper);
      if (charts.length) {
        return { type: 'table', data: charts };
      }
    }

    // Fallback: some size charts are images directly
    const chartImg = document.querySelector(
      '#sizeChartV2Data_feature_div img[src*="media-amazon"], ' +
      '[id^="a-popover-content"] img[src*="media-amazon"]'
    );
    if (chartImg) {
      return { type: 'image', url: chartImg.src };
    }

    return null;
  }

  static _parseSizeChartTables(wrapper) {
    const charts = [];
    const sections = [...wrapper.querySelectorAll('[id^="fit-sizechartv2-"]')];
    const toParse = sections.length > 0 ? sections : [wrapper];

    for (const section of toParse) {
      const table = section.querySelector('table');
      if (!table) continue;

      const titleEl = section.querySelector('h5, h4, h3');
      const allRows = [...table.querySelectorAll('tr')];
      if (!allRows.length) continue;

      const headers = [...allRows[0].querySelectorAll('th, td')].map(c => c.textContent.trim());
      const rows = allRows.slice(1).map(row => {
        const cells = [...row.querySelectorAll('th, td')].map(c => c.textContent.trim());
        const obj = {};
        headers.forEach((h, i) => { obj[h] = cells[i] !== undefined ? cells[i] : ''; });
        return obj;
      }).filter(row => Object.values(row).some(v => v));

      if (headers.length && rows.length) {
        charts.push({ title: titleEl ? titleEl.textContent.trim() : '', headers, rows });
      }
    }

    return charts;
  }

  static getTitle() {
    const selectors = ['#productTitle', '#title', 'h1.a-size-large'];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element.textContent.trim();
    }
    return null;
  }

  static getPrice() {
    // CRITICAL: Only look for prices within the core price display container
    // This prevents picking up incorrect prices from other parts of the page
    // Use querySelector to get the FIRST occurrence (in case of duplicates)
    const corePriceDisplay = document.querySelector('#corePriceDisplay_desktop_feature_div');

    if (corePriceDisplay) {
      // Strategy 0: Look for .aok-offscreen (Amazon's accessibility class for screen readers)
      const aokOffscreen = corePriceDisplay.querySelector('.aok-offscreen');
      if (aokOffscreen) {
        const priceText = aokOffscreen.textContent.trim();
        // Validate it's a proper price format
        if (priceText && /^\$\d+(\,\d{3})*\.\d{2}$/.test(priceText)) {
          return priceText;
        }
      }

      // Strategy 1: Look for .priceToPay with .a-price-whole (most reliable for current price)
      const priceToPayWhole = corePriceDisplay.querySelector('.priceToPay .a-price-whole');
      if (priceToPayWhole) {
        const wholePart = priceToPayWhole.textContent.replace(/[^0-9]/g, '');
        const fractionPart = corePriceDisplay.querySelector('.priceToPay .a-price-fraction');
        if (wholePart) {
          const fraction = fractionPart ? fractionPart.textContent.trim() : '00';
          return `$${wholePart}.${fraction}`;
        }
      }

      // Strategy 2: Look for .priceToPay .a-offscreen (current/deal price) within core display
      const priceToPay = corePriceDisplay.querySelector('.priceToPay .a-offscreen');
      if (priceToPay && priceToPay.textContent.trim()) {
        const priceText = priceToPay.textContent.trim();
        if (priceText && /^\$\d+(\,\d{3})*\.\d{2}$/.test(priceText)) {
          return priceText;
        }
      }

      // Strategy 3: Look for .basisPrice (typical/list price) within core display
      const basisPrice = corePriceDisplay.querySelector('.basisPrice .a-offscreen');
      if (basisPrice && basisPrice.textContent.trim()) {
        const priceText = basisPrice.textContent.trim();
        if (priceText && /^\$\d+(\,\d{3})*\.\d{2}$/.test(priceText)) {
          return priceText;
        }
      }

      // Strategy 4: Look for any .a-offscreen within core display that has a valid price
      const offscreenPrices = corePriceDisplay.querySelectorAll('.a-offscreen');
      for (const offscreen of offscreenPrices) {
        const priceText = offscreen.textContent.trim();
        // Match valid price format like $10.49 or $1,234.56
        if (priceText && /^\$\d+(\,\d{3})*\.\d{2}$/.test(priceText)) {
          return priceText;
        }
      }

      // Strategy 5: Build price from .a-price-whole and .a-price-fraction within core display
      const priceWhole = corePriceDisplay.querySelector('.a-price-whole');
      if (priceWhole) {
        const wholePart = priceWhole.textContent.replace(/[^0-9]/g, '');
        const fractionElement = priceWhole.parentElement?.querySelector('.a-price-fraction');
        if (wholePart) {
          const fraction = fractionElement ? fractionElement.textContent.trim() : '00';
          return `$${wholePart}.${fraction}`;
        }
      }
    }

    // Fallback: Legacy selectors (only if core price display not found)
    const legacySelectors = ['#priceblock_ourprice', '#priceblock_dealprice', '#price_inside_buybox'];
    for (const selector of legacySelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  static isUnitPriceText(priceText, element) {
    const unitPricePatterns = [
      /\$[\d.,]+\s*(per|\/)\s*(fl\.?\s*oz|fluid\s*ounce|ounce|oz|count|each|lb|pound|kg|gram|item|piece)/i,
      /\(\$[\d.,]+\s*\/\s*(fl\.?\s*oz|fluid\s*ounce|ounce|oz|count|each|lb|pound|kg|gram|item|piece)\)/i
    ];

    if (unitPricePatterns.some(pattern => pattern.test(priceText))) {
      return true;
    }

    if (element) {
      const parent = element.parentElement;
      const grandparent = parent?.parentElement;
      const contextTexts = [
        element.textContent || '',
        parent?.textContent || '',
        grandparent?.textContent || '',
        grandparent?.parentElement?.textContent || ''
      ];

      for (const context of contextTexts) {
        if (/per\s+(fl\.?\s*oz|fluid\s*ounce|ounce|oz|count|each|lb|pound|kg|gram|item|piece)/i.test(context)) {
          if (context.includes(priceText)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  static isUnitPriceContainer(priceContainer) {
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

  static isPrimeEligible() {
    // Check within a-box-inner containers near pricing first
    const boxInnerElements = document.querySelectorAll('.a-box-inner');
    for (const box of boxInnerElements) {
      const boxText = box.textContent || '';
      if (boxText.match(/prime/i)) {
        // Verify it's near price information
        const hasPriceInfo = boxText.match(/\$[\d,]+\.?\d*/);
        if (hasPriceInfo) {
          return true;
        }
      }
    }

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

    const deliverySelectors = [
      '#deliveryMessageMirId',
      '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE'
    ];

    for (const selector of deliverySelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.match(/prime/i)) {
        return true;
      }
    }

    return false;
  }

  static checkPrimeEligibilityFromElement(element) {
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

    const deliveryText = element.textContent || '';
    if (deliveryText.match(/FREE.*delivery/i) || deliveryText.match(/FREE.*shipping/i)) {
      if (!deliveryText.match(/FREE.*returns/i) || deliveryText.match(/Prime/i)) {
        return true;
      }
    }

    return false;
  }

  static getDeliveryFee() {
    const selectors = [
      '#deliveryMessageMirId span[data-csa-c-delivery-price]',
      '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE .a-color-success',
      '#mir-layout-DELIVERY_BLOCK-slot-SECONDARY_DELIVERY_MESSAGE_LARGE',
      '#ourprice_shippingmessage',
      '#price-shipping-message',
      '#price_shipping_message',
      '#delivery-message',
      '#ddmDeliveryMessage',
      '#fulfillerInfoFeature_feature_div .a-color-success',
      '#deliveryBlockMessage',
      '[data-feature-name="delivery"] .a-color-price',
      '#buybox-see-all-buying-choices span.a-color-secondary'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();
        if (text.match(/free\s+(delivery|shipping)/i)) {
          return 'FREE';
        }
        const priceMatch = text.match(/[\+]?\s*\$[\d.]+/);
        if (priceMatch) {
          return priceMatch[0].trim();
        }
      }
    }

    const primeElement = document.querySelector('#priceBadging_feature_div, .prime-logo, [aria-label*="Prime"]');
    if (primeElement) {
      const primeText = primeElement.textContent || primeElement.getAttribute('aria-label') || '';
      if (primeText.match(/prime/i)) {
        return 'FREE (Prime)';
      }
    }

    return null;
  }

  static getDeliveryDate() {
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
        const dateMatch = text.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/i);
        if (dateMatch) {
          return dateMatch[0];
        }
      }
    }

    return null;
  }

  static _isValidImageUrl(url) {
    return url && !/(PKmb|play-button-overlay|overlay-thumb)/i.test(url);
  }

  static getImages() {
    const images = [];
    const mainImage = document.querySelector('#landingImage, #imgBlkFront');
    if (mainImage) {
      const src = mainImage.getAttribute('data-old-hires') || mainImage.getAttribute('src');
      if (src && this._isValidImageUrl(src)) images.push(src);
    }

    const thumbnails = document.querySelectorAll('#altImages img, .imageThumbnail img');
    thumbnails.forEach(img => {
      const src = img.getAttribute('src');
      if (src && !images.includes(src)) {
        const highRes = src.replace(/\._.*_\./, '.');
        if (this._isValidImageUrl(highRes)) images.push(highRes);
      }
    });

    return images.slice(0, 10);
  }

  static getDescription() {
    // Collect all paragraph text from the product description section
    const descDiv = document.querySelector('#productDescription');
    if (descDiv) {
      const paragraphs = [...descDiv.querySelectorAll('p')]
        .map(p => p.textContent.trim())
        .filter(Boolean);
      if (paragraphs.length) return paragraphs.join('\n\n');
      const text = descDiv.textContent.trim();
      if (text) return text;
    }
    // Fallback: #feature-bullets
    const featureBullets = document.querySelector('#feature-bullets');
    if (featureBullets) return featureBullets.textContent.trim();
    // Fallback: .a-section.a-spacing-medium — skip Rufus AI widget and other non-description widgets
    for (const el of document.querySelectorAll('.a-section.a-spacing-medium')) {
      if (el.closest('#nile-inline-btf_feature_div') || el.id === 'nile-inline-btf_feature_div') continue;
      const text = el.textContent.trim();
      if (text) return text;
    }
    return '';
  }

  static getBulletPoints() {
    const bullets = [];

    // Strategy 1: standard feature-bullets section (most products)
    let items = document.querySelectorAll(
      '#feature-bullets ul li span.a-list-item, ' +
      '#featurebullets_feature_div ul li span.a-list-item'
    );

    // Strategy 2: softlines/fashion products — standalone ul with a-spacing-small
    if (!items.length) {
      items = document.querySelectorAll(
        'ul.a-unordered-list.a-vertical.a-spacing-small li span.a-list-item.a-size-base'
      );
    }

    // Strategy 3: broad fallback
    if (!items.length) {
      items = document.querySelectorAll('#feature-bullets li, #featurebullets_feature_div li');
    }

    items.forEach(el => {
      const text = el.textContent.trim();
      if (text && !bullets.includes(text)) bullets.push(text);
    });

    // Extract A+ content images (enhanced brand content below description)
    const seenUrls = new Set();
    document.querySelectorAll('.aplus-v2 img, #aplus img').forEach(img => {
      if (img.closest('.premium-aplus-module-5')) return;
      let src = (img.getAttribute('data-src') || img.getAttribute('src') || '').trim();
      if (!src || src.startsWith('data:')) return;
      // A+ images have a known path prefix. Reconstruct the full canonical URL from the path
      // so that any variation of truncated/broken domain is corrected.
      const aplusPath = '/images/S/aplus-media-library-service-media/';
      const pathIdx = src.indexOf(aplusPath);
      if (pathIdx !== -1) src = 'https://m.media-amazon.com' + src.slice(pathIdx);
      if (!src.includes('amazon.com')) return;
      if (this._isValidImageUrl(src) && !seenUrls.has(src)) {
        seenUrls.add(src);
        bullets.push(`[IMAGE]: ${src}`);
      }
    });

    return bullets;
  }

  static getSpecifications() {
    const specs = {};

    // Strategy 1: product details table (most products)
    document.querySelectorAll(
      '#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr'
    ).forEach(row => {
      const th = row.querySelector('th');
      const td = row.querySelector('td');
      if (th && td) {
        const key = th.textContent.trim();
        const val = td.textContent.trim();
        if (key && val) specs[key] = val;
      }
    });

    // Strategy 2: detail bullets list (softlines/fashion products)
    document.querySelectorAll('#detailBullets_feature_div ul li').forEach(li => {
      const listItem = li.querySelector('span.a-list-item');
      if (!listItem) return;
      const bold = listItem.querySelector('span.a-text-bold, strong');
      if (!bold) return;
      const key = bold.textContent.replace(/[\u200e\u200f\s:]+$/g, '').trim();
      const clone = listItem.cloneNode(true);
      clone.querySelector('span.a-text-bold, strong')?.remove();
      clone.querySelectorAll('ul, script, style').forEach(el => el.remove());
      const val = clone.textContent.trim();
      if (key && val) specs[key] = val;
    });

    return specs;
  }

  // ===== Parsed Document Extraction =====

  static extractTitleFromDoc(doc) {
    const selectors = ['#productTitle', '#title', 'h1.a-size-large'];
    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) return element.textContent.trim();
    }
    return null;
  }

  static extractPriceFromDoc(doc) {
    // CRITICAL: Only look for prices within the core price display container
    // This prevents picking up incorrect prices from other parts of the page
    // Use querySelector to get the FIRST occurrence (in case of duplicates)
    const corePriceDisplay = doc.querySelector('#corePriceDisplay_desktop_feature_div');

    if (corePriceDisplay) {
      // Strategy 0: Look for .aok-offscreen (Amazon's accessibility class for screen readers)
      const aokOffscreen = corePriceDisplay.querySelector('.aok-offscreen');
      if (aokOffscreen) {
        const priceText = aokOffscreen.textContent.trim();
        // Validate it's a proper price format
        if (priceText && /^\$\d+(\,\d{3})*\.\d{2}$/.test(priceText)) {
          return priceText;
        }
      }

      // Strategy 1: Look for .priceToPay with .a-price-whole (most reliable for current price)
      const priceToPayWhole = corePriceDisplay.querySelector('.priceToPay .a-price-whole');
      if (priceToPayWhole) {
        const wholePart = priceToPayWhole.textContent.replace(/[^0-9]/g, '');
        const fractionPart = corePriceDisplay.querySelector('.priceToPay .a-price-fraction');
        if (wholePart) {
          const fraction = fractionPart ? fractionPart.textContent.trim() : '00';
          return `$${wholePart}.${fraction}`;
        }
      }

      // Strategy 2: Look for .priceToPay .a-offscreen (current/deal price) within core display
      const priceToPay = corePriceDisplay.querySelector('.priceToPay .a-offscreen');
      if (priceToPay && priceToPay.textContent.trim()) {
        const priceText = priceToPay.textContent.trim();
        if (priceText && /^\$\d+(\,\d{3})*\.\d{2}$/.test(priceText)) {
          return priceText;
        }
      }

      // Strategy 3: Look for .basisPrice (typical/list price) within core display
      const basisPrice = corePriceDisplay.querySelector('.basisPrice .a-offscreen');
      if (basisPrice && basisPrice.textContent.trim()) {
        const priceText = basisPrice.textContent.trim();
        if (priceText && /^\$\d+(\,\d{3})*\.\d{2}$/.test(priceText)) {
          return priceText;
        }
      }

      // Strategy 4: Look for any .a-offscreen within core display that has a valid price
      const offscreenPrices = corePriceDisplay.querySelectorAll('.a-offscreen');
      for (const offscreen of offscreenPrices) {
        const priceText = offscreen.textContent.trim();
        // Match valid price format like $10.49 or $1,234.56
        if (priceText && /^\$\d+(\,\d{3})*\.\d{2}$/.test(priceText)) {
          return priceText;
        }
      }

      // Strategy 5: Build price from .a-price-whole and .a-price-fraction within core display
      const priceWhole = corePriceDisplay.querySelector('.a-price-whole');
      if (priceWhole) {
        const wholePart = priceWhole.textContent.replace(/[^0-9]/g, '');
        const fractionElement = priceWhole.parentElement?.querySelector('.a-price-fraction');
        if (wholePart) {
          const fraction = fractionElement ? fractionElement.textContent.trim() : '00';
          return `$${wholePart}.${fraction}`;
        }
      }
    }

    // Fallback: Legacy selectors (only if core price display not found)
    const legacySelectors = ['#priceblock_ourprice', '#priceblock_dealprice', '#price_inside_buybox'];
    for (const selector of legacySelectors) {
      const element = doc.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  static isUnitPriceContainerFromDoc(priceContainer) {
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

  static extractDeliveryFeeFromDoc(doc) {
    const selectors = [
      '#deliveryMessageMirId span[data-csa-c-delivery-price]',
      '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE .a-color-success',
      '#mir-layout-DELIVERY_BLOCK-slot-SECONDARY_DELIVERY_MESSAGE_LARGE',
      '#ourprice_shippingmessage',
      '#price-shipping-message',
      '#price_shipping_message',
      '#delivery-message',
      '#ddmDeliveryMessage',
      '#fulfillerInfoFeature_feature_div .a-color-success',
      '#deliveryBlockMessage',
      '[data-feature-name="delivery"] .a-color-price',
      '#buybox-see-all-buying-choices span.a-color-secondary'
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();
        if (text.match(/free\s+(delivery|shipping)/i)) {
          return 'FREE';
        }
        const priceMatch = text.match(/[\+]?\s*\$[\d.]+/);
        if (priceMatch) {
          return priceMatch[0].trim();
        }
      }
    }

    const primeElement = doc.querySelector('#priceBadging_feature_div, .prime-logo, [aria-label*="Prime"]');
    if (primeElement) {
      const primeText = primeElement.textContent || primeElement.getAttribute('aria-label') || '';
      if (primeText.match(/prime/i)) {
        return 'FREE (Prime)';
      }
    }

    return null;
  }

  static extractPrimeEligibilityFromDoc(doc) {
    // Check within a-box-inner containers near pricing first
    const boxInnerElements = doc.querySelectorAll('.a-box-inner');
    for (const box of boxInnerElements) {
      const boxText = box.textContent || '';
      if (boxText.match(/prime/i)) {
        // Verify it's near price information
        const hasPriceInfo = boxText.match(/\$[\d,]+\.?\d*/);
        if (hasPriceInfo) {
          return true;
        }
      }
    }

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

  static extractImagesFromDoc(doc) {
    const images = [];
    const mainImage = doc.querySelector('#landingImage, #imgBlkFront');
    if (mainImage) {
      const src = mainImage.getAttribute('data-old-hires') || mainImage.getAttribute('src');
      if (src && this._isValidImageUrl(src)) images.push(src);
    }

    const thumbnails = doc.querySelectorAll('#altImages img, .imageThumbnail img');
    thumbnails.forEach(img => {
      const src = img.getAttribute('src');
      if (src && !images.includes(src)) {
        const highRes = src.replace(/\._.*_\./, '.');
        if (this._isValidImageUrl(highRes)) images.push(highRes);
      }
    });

    return images.slice(0, 10);
  }

  static extractDeliveryDateFromDoc(doc) {
    const selectors = [
      '#deliveryMessageMirId',
      '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE',
      '#mir-layout-DELIVERY_BLOCK-slot-SECONDARY_DELIVERY_MESSAGE_LARGE',
      '#delivery-message',
      '#ddmDeliveryMessage'
    ];
    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();
        const dateMatch = text.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/i);
        if (dateMatch) return dateMatch[0];
      }
    }
    return null;
  }

  static extractVariationsFromDoc(doc) {
    const result = {
      hasVariations: false,
      parentAsin: null,
      dimensions: [],
      validCombinations: [],
      colorImages: {},
      sizeChart: null
    };

    const dimensionUls = doc.querySelectorAll('ul[data-a-button-group]');
    if (!dimensionUls.length) return result;

    const dimensions = [];
    for (const ul of dimensionUls) {
      let groupData;
      try {
        groupData = JSON.parse(ul.getAttribute('data-a-button-group') || '{}');
      } catch (e) { continue; }
      const dimName = groupData.name;
      if (!dimName) continue;
      const cleanName = dimName.replace(/_name$/, '');
      const items = [...ul.querySelectorAll('li[data-asin]')];
      if (!items.length) continue;

      const values = [];
      for (const li of items) {
        const asin = li.getAttribute('data-asin');
        if (!asin) continue;
        const isSelected = li.getAttribute('data-initiallyselected') === 'true';
        const isUnavailable = li.getAttribute('data-initiallyunavailable') === 'true';
        const entry = { asin, available: !isUnavailable };
        if (isSelected) entry.selected = true;

        const priceLabel = li.querySelector('.apex-pricetopay-accessibility-label');
        if (priceLabel) {
          const m = priceLabel.textContent.match(/\$[\d,]+\.\d{2}/);
          if (m) entry.price = m[0];
        }

        if (cleanName === 'color') {
          const img = li.querySelector('img.swatch-image');
          if (img) {
            entry.value = img.getAttribute('alt') || '';
            const src = img.getAttribute('src') || '';
            entry.swatchImageUrl = src.replace(/\._[A-Z]{2}\d+_\./g, '.').replace(/\._AC_\./, '.');
          }
        } else {
          const textEl = li.querySelector('.swatch-title-text-display');
          entry.value = textEl ? textEl.textContent.trim() : '';
        }
        if (entry.value) values.push(entry);
      }
      if (values.length > 0) dimensions.push({ name: cleanName, values });
    }

    if (!dimensions.length) return result;
    result.hasVariations = true;
    result.dimensions = dimensions;

    // hiRes colorImages from ImageBlockBTF inline script
    const allScripts = [...doc.querySelectorAll('script:not([src])')];
    const imgScript = allScripts.find(s =>
      s.textContent.includes('"colorImages"') && s.textContent.includes('jQuery.parseJSON')
    );
    if (imgScript) {
      try {
        const m = imgScript.textContent.match(/jQuery\.parseJSON\('([\s\S]+?)'\s*\)/);
        if (m) {
          const data = JSON.parse(m[1].replace(/\\'/g, "'"));
          if (data.colorImages) {
            for (const [color, imgs] of Object.entries(data.colorImages)) {
              const hiRes = imgs.filter(i => i.hiRes).map(i => i.hiRes);
              if (hiRes.length) result.colorImages[color] = hiRes;
            }
          }
        }
      } catch (e) {}
    }

    // Fallback: swatch thumbnail URLs for colors not in script data
    const colorDim = dimensions.find(d => d.name === 'color');
    if (colorDim) {
      for (const v of colorDim.values) {
        if (v.swatchImageUrl && !result.colorImages[v.value]) {
          result.colorImages[v.value] = [v.swatchImageUrl];
        }
      }
    }

    // parentAsin
    const parentScript = allScripts.find(s => s.textContent.includes('parentAsin'));
    if (parentScript) {
      const m = parentScript.textContent.match(/parentAsin=([A-Z0-9]{10})/);
      if (m) result.parentAsin = m[1];
    }

    // Valid combinations from twister data
    const twisterEl = doc.getElementById('twister-js-init-dpx-data');
    if (twisterEl) {
      try {
        const twisterData = JSON.parse(twisterEl.textContent.trim());
        const dims = twisterData.sortedDimValuesForAllDims;
        const sortedVars = twisterData.sortedVariations || [];
        if (dims && sortedVars.length > 0) {
          const dimKeys = Object.keys(dims);
          let orderedKeys = [...dimKeys];
          if (dimKeys.length === 2) {
            const maxIdx0 = Math.max(...sortedVars.map(c => c[0]));
            if (maxIdx0 >= dims[dimKeys[0]].length) orderedKeys = [dimKeys[1], dimKeys[0]];
          }
          result.validCombinations = sortedVars.map(combo => {
            const combination = {};
            combo.forEach((dimValueIdx, pos) => {
              const dimKey = orderedKeys[pos];
              const val = dims[dimKey]?.[dimValueIdx];
              if (val) combination[dimKey.replace('_name', '')] = val.dimensionValueDisplayText;
            });
            return combination;
          });
        }
      } catch (e) {}
    }

    // Fallback validCombinations: cross-product of available values
    if (!result.validCombinations.length) {
      if (dimensions.length >= 2) {
        const dim0 = dimensions[0];
        const dim1 = dimensions[1];
        for (const v0 of dim0.values.filter(v => v.available)) {
          for (const v1 of dim1.values.filter(v => v.available)) {
            result.validCombinations.push({ [dim0.name]: v0.value, [dim1.name]: v1.value });
          }
        }
      } else {
        const dim = dimensions[0];
        result.validCombinations = dim.values
          .filter(v => v.available)
          .map(v => ({ [dim.name]: v.value }));
      }
    }

    result.sizeChart = this.extractSizeChartFromDoc(doc);
    return result;
  }

  static extractSizeChartFromDoc(doc) {
    const wrapper = doc.querySelector(
      '#sizeChartV2Data_feature_div .fit-sizechartv2-tables-wrapper, ' +
      '#a-popover-sizeGuide .fit-sizechartv2-tables-wrapper, ' +
      '.fit-sizechartv2-tables-wrapper'
    );
    if (wrapper) {
      const charts = this._parseSizeChartTables(wrapper);
      if (charts.length) return { type: 'table', data: charts };
    }
    const chartImg = doc.querySelector(
      '#sizeChartV2Data_feature_div img[src*="media-amazon"], ' +
      '[id^="a-popover-content"] img[src*="media-amazon"]'
    );
    if (chartImg) return { type: 'image', url: chartImg.src };
    return null;
  }

  static extractDescriptionFromDoc(doc) {
    const descDiv = doc.querySelector('#productDescription');
    if (descDiv) {
      const paragraphs = [...descDiv.querySelectorAll('p')]
        .map(p => p.textContent.trim())
        .filter(Boolean);
      if (paragraphs.length) return paragraphs.join('\n\n');
      const text = descDiv.textContent.trim();
      if (text) return text;
    }
    const featureBullets = doc.querySelector('#feature-bullets');
    if (featureBullets) return featureBullets.textContent.trim();
    for (const el of doc.querySelectorAll('.a-section.a-spacing-medium')) {
      if (el.closest('#nile-inline-btf_feature_div') || el.id === 'nile-inline-btf_feature_div') continue;
      const text = el.textContent.trim();
      if (text) return text;
    }
    return '';
  }

  static extractBulletPointsFromDoc(doc) {
    const bullets = [];

    // Text bullets — try multiple selectors
    let items = doc.querySelectorAll(
      '#feature-bullets ul li span.a-list-item, ' +
      '#featurebullets_feature_div ul li span.a-list-item'
    );
    if (!items.length) {
      items = doc.querySelectorAll(
        'ul.a-unordered-list.a-vertical.a-spacing-small li span.a-list-item.a-size-base'
      );
    }
    if (!items.length) {
      items = doc.querySelectorAll('#feature-bullets li, #featurebullets_feature_div li');
    }
    items.forEach(el => {
      const text = el.textContent.trim();
      if (text && !bullets.includes(text)) bullets.push(text);
    });

    // A+ content images — reconstruct full CDN URL from path to fix truncated domains
    const aplusPath = '/images/S/aplus-media-library-service-media/';
    const seenUrls = new Set();
    doc.querySelectorAll('.aplus-v2 img, #aplus img').forEach(img => {
      if (img.closest('.premium-aplus-module-5')) return;
      let src = (img.getAttribute('data-src') || img.getAttribute('src') || '').trim();
      if (!src || src.startsWith('data:')) return;
      const pathIdx = src.indexOf(aplusPath);
      if (pathIdx !== -1) src = 'https://m.media-amazon.com' + src.slice(pathIdx);
      if (!src.includes('amazon.com')) return;
      if (this._isValidImageUrl(src) && !seenUrls.has(src)) {
        seenUrls.add(src);
        bullets.push(`[IMAGE]: ${src}`);
      }
    });

    return bullets;
  }

  static extractSpecificationsFromDoc(doc) {
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

  static extractProductLinksFromPage() {
    const productLinks = [];
    const seenAsins = new Set();

    const selectors = [
      '[data-asin]:not([data-asin=""]) h2 a',
      '[data-asin]:not([data-asin=""]) .a-link-normal[href*="/dp/"]',
      '.zg-grid-general-faceout a[href*="/dp/"]',
      '.zg-item-immersion a[href*="/dp/"]',
      'a[href*="/dp/"]'
    ];

    selectors.forEach(selector => {
      const links = document.querySelectorAll(selector);
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;

        const asinMatch = href.match(/\/dp\/([A-Z0-9]{10})/);
        if (asinMatch && !seenAsins.has(asinMatch[1])) {
          seenAsins.add(asinMatch[1]);
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
}
