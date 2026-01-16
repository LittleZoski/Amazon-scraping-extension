/**
 * YAMI BULK PAGE DEBUG SCRIPT
 * Run this in the browser console on a Yami category/search page
 * to identify the correct selectors for bulk scraping
 */

(function() {
  console.log('=== YAMI BULK PAGE DEBUG SCRIPT ===\n');

  // Helper function to parse price
  function parsePrice(text) {
    if (!text) return null;
    const cleaned = text.replace(/[^0-9.]/g, '');
    const price = parseFloat(cleaned);
    return isNaN(price) ? null : price;
  }

  // 1. Find all product cards
  console.log('1. SEARCHING FOR PRODUCT CARDS...\n');

  const cardSelectors = [
    '.bff-item',
    '.product-card',
    '[class*="product"]',
    '[class*="item"]',
    'li[class*="item"]',
    'div[class*="product"]'
  ];

  let productCards = [];
  for (const selector of cardSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`✓ Found ${elements.length} elements with selector: ${selector}`);
      if (productCards.length === 0) {
        productCards = Array.from(elements);
      }
    }
  }

  if (productCards.length === 0) {
    console.error('❌ No product cards found! Please check the page structure.');
    return;
  }

  console.log(`\nUsing ${productCards.length} product cards for analysis.\n`);

  // 2. Analyze first 3 product cards
  console.log('2. ANALYZING PRODUCT CARDS...\n');

  const results = [];

  for (let i = 0; i < Math.min(3, productCards.length); i++) {
    const card = productCards[i];
    console.log(`--- CARD ${i + 1} ---`);
    console.log('Card HTML:', card.outerHTML.substring(0, 500) + '...');

    const result = {
      cardIndex: i,
      productID: null,
      productURL: null,
      title: null,
      price: null,
      priceText: null,
      priceSelectors: [],
      linkSelectors: []
    };

    // Find product link and ID
    const linkSelectors = [
      'a[href*="/p/"]',
      'a[href*="/product/"]',
      'a[href*="/item/"]',
      'a'
    ];

    for (const selector of linkSelectors) {
      const link = card.querySelector(selector);
      if (link && link.href) {
        const href = link.getAttribute('href');

        // Try to extract product ID from URL
        // Yami URLs are like: /p/{slug}/{id}
        const idMatch = href.match(/\/p\/[^\/]+\/(\d+)/);
        if (idMatch) {
          result.productID = idMatch[1];
          result.productURL = link.href;
          result.linkSelectors.push(selector);
          console.log(`  ✓ Product ID: ${result.productID}`);
          console.log(`  ✓ Product URL: ${result.productURL}`);
          console.log(`  ✓ Link selector: ${selector}`);
          break;
        }
      }
    }

    // Find product title
    const titleSelectors = [
      '.bff-item__title',
      '.product-title',
      'a[href*="/p/"]',
      '.title',
      'h2',
      'h3',
      'a'
    ];

    for (const selector of titleSelectors) {
      const titleEl = card.querySelector(selector);
      if (titleEl && titleEl.textContent.trim().length > 0) {
        result.title = titleEl.textContent.trim();
        console.log(`  ✓ Title: ${result.title.substring(0, 50)}...`);
        break;
      }
    }

    // Find product price (MOST IMPORTANT)
    const priceSelectors = [
      '.bff-item__price--valid',
      '.red-price',
      '.item-price__valid',
      '.price',
      '[class*="price"]',
      'span[class*="price"]',
      'div[class*="price"]'
    ];

    console.log('  Searching for price...');
    for (const selector of priceSelectors) {
      const priceElements = card.querySelectorAll(selector);
      priceElements.forEach(priceEl => {
        const text = priceEl.textContent.trim();
        const price = parsePrice(text);
        if (price && price > 0) {
          result.priceSelectors.push({
            selector: selector,
            text: text,
            parsed: price,
            element: priceEl
          });
        }
      });
    }

    if (result.priceSelectors.length > 0) {
      // Use the first valid price found
      const bestPrice = result.priceSelectors[0];
      result.price = bestPrice.parsed;
      result.priceText = bestPrice.text;
      console.log(`  ✓ Price found: ${result.priceText} (${result.price})`);
      console.log(`  ✓ Price selector: ${bestPrice.selector}`);
      console.log(`  Price element:`, bestPrice.element);

      // Show all price selectors found
      if (result.priceSelectors.length > 1) {
        console.log(`  Note: Found ${result.priceSelectors.length} price elements in this card:`);
        result.priceSelectors.forEach((p, idx) => {
          console.log(`    ${idx + 1}. ${p.selector}: ${p.text} (${p.parsed})`);
        });
      }
    } else {
      console.error(`  ❌ NO PRICE FOUND for card ${i + 1}!`);
      console.log('  Dumping all text content in card:');
      console.log(card.textContent);
    }

    results.push(result);
    console.log('');
  }

  // 3. Summary and Recommendations
  console.log('3. SUMMARY AND RECOMMENDATIONS\n');

  const allProductIDs = results.filter(r => r.productID).map(r => r.productID);
  const allPrices = results.filter(r => r.price).map(r => r.price);
  const allPriceSelectors = results.flatMap(r => r.priceSelectors.map(p => p.selector));

  console.log(`Products with IDs: ${allProductIDs.length}/${results.length}`);
  console.log(`Products with prices: ${allPrices.length}/${results.length}`);
  console.log('');

  if (allPrices.length > 0) {
    console.log('✓ RECOMMENDED PRICE SELECTORS:');
    const selectorCounts = {};
    allPriceSelectors.forEach(s => {
      selectorCounts[s] = (selectorCounts[s] || 0) + 1;
    });
    const sortedSelectors = Object.entries(selectorCounts).sort((a, b) => b[1] - a[1]);
    sortedSelectors.forEach(([selector, count]) => {
      console.log(`  ${selector} (found in ${count} cards)`);
    });
  } else {
    console.error('❌ NO PRICES FOUND! Need to investigate page structure.');
  }

  console.log('');
  console.log('4. MANUAL INSPECTION\n');
  console.log('Please manually inspect the first product card:');
  console.log(productCards[0]);
  console.log('');
  console.log('Look for price elements and provide the CSS selector.');

  // 4. Test YamiDataExtractor.extractProductLinksFromPage()
  console.log('\n5. TESTING YamiDataExtractor.extractProductLinksFromPage()...\n');

  if (typeof YamiDataExtractor !== 'undefined') {
    try {
      const extractedProducts = YamiDataExtractor.extractProductLinksFromPage();
      console.log(`YamiDataExtractor found ${extractedProducts.length} products`);
      if (extractedProducts.length > 0) {
        console.log('First product:', extractedProducts[0]);
        console.log('Product element:', extractedProducts[0].element);
      }
    } catch (error) {
      console.error('Error testing YamiDataExtractor:', error);
    }
  } else {
    console.log('YamiDataExtractor not loaded - skipping this test');
  }

  // Export results to global scope for further inspection
  window.YAMI_DEBUG_RESULTS = {
    productCards,
    results,
    recommendations: {
      priceSelectors: allPriceSelectors
    }
  };

  console.log('\n✓ Debug results saved to window.YAMI_DEBUG_RESULTS');
  console.log('You can inspect individual cards: window.YAMI_DEBUG_RESULTS.productCards[0]');
  console.log('\n=== END DEBUG SCRIPT ===');
})();
