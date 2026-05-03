/**
 * Yami Diagnostic Script
 * Paste this entire script into the browser console on a Yami product page.
 * It will tell you exactly what the current HTML exposes for price and images.
 */
(function yamiDiag() {
  const log = (label, value) => console.log(`%c[YAMI-DIAG] ${label}`, 'color:#f59e0b;font-weight:bold', value);
  const ok  = (label, value) => console.log(`%c[YAMI-DIAG] ✅ ${label}`, 'color:#10b981;font-weight:bold', value);
  const err = (label, value) => console.log(`%c[YAMI-DIAG] ❌ ${label}`, 'color:#ef4444;font-weight:bold', value);

  console.group('===== YAMI DIAGNOSTIC REPORT =====');

  // --- URL ---
  log('Current URL', window.location.href);

  // ============================
  // 1. JSON-LD
  // ============================
  console.group('1. JSON-LD scripts');
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  log('Count of ld+json scripts', scripts.length);
  scripts.forEach((s, i) => {
    try {
      const d = JSON.parse(s.textContent);
      log(`  Script[${i}] @type`, d['@type']);
      if (d['@type'] === 'Product') {
        ok('  Product JSON-LD found', '');
        log('  name', d.name);
        log('  offers', d.offers);
        log('  image', d.image);
      }
    } catch(e) {
      err(`  Script[${i}] parse error`, e.message);
    }
  });
  console.groupEnd();

  // Also check inline scripts (without type attribute) for Product schema
  console.group('1b. Inline <script> tags containing @type:Product');
  const allScripts = document.querySelectorAll('script:not([src])');
  let foundInline = false;
  allScripts.forEach((s, i) => {
    const t = s.textContent.trim();
    if (t.includes('"@type":"Product"') || t.includes('"@type": "Product"')) {
      foundInline = true;
      ok(`  Script[${i}] contains Product schema`, '');
      try {
        const d = JSON.parse(t);
        log('  offers', d.offers);
        log('  image', d.image);
      } catch(e) {
        err('  Could not parse as JSON', e.message.slice(0,100));
      }
    }
  });
  if (!foundInline) err('No inline Product schema found', '');
  console.groupEnd();

  // ============================
  // 2. Price selectors
  // ============================
  console.group('2. Price selectors');
  const priceSelectors = [
    '.price-shop.word-bold',
    '.price-shop',
    '.word-bold-price.red-price',
    '.word-bold-price',
    '[itemprop="price"]',
    '.item-price__valid',
    '.price-normal.price-valid.word-bold-price',
    '.price-valid',
    '[data-qa="price"]',
    '.price',
    // Newer possible selectors
    '.product-price',
    '.goods-price',
    '.sale-price',
    '.current-price',
  ];
  let priceFound = false;
  priceSelectors.forEach(sel => {
    const el = document.querySelector(sel);
    if (el) {
      ok(`Found: ${sel}`, el.textContent.trim());
      priceFound = true;
    }
  });
  if (!priceFound) err('No price selector matched', '');

  // Meta price
  const metaPrice = document.querySelector('meta[property="product:price:amount"]');
  if (metaPrice) ok('meta product:price:amount', metaPrice.getAttribute('content'));
  else err('meta product:price:amount', 'not found');
  console.groupEnd();

  // ============================
  // 3. Image selectors
  // ============================
  console.group('3. Image selectors');

  // Strategy 2: main gallery
  const gallery = document.querySelector('[data-observetrack="goods_image"] .item-preview__list');
  if (gallery) {
    const imgs = gallery.querySelectorAll('img');
    ok('[data-observetrack="goods_image"] .item-preview__list', `${imgs.length} img(s)`);
    imgs.forEach((img, i) => {
      const src = img.getAttribute('data-src') || img.getAttribute('src');
      log(`  img[${i}]`, src?.slice(0, 120));
    });
  } else {
    err('[data-observetrack="goods_image"] .item-preview__list', 'not found');
  }

  // Strategy 3: wrapper
  const wrapper = document.querySelector('.item-preview__wrapper .item-preview__list');
  if (wrapper) {
    ok('.item-preview__wrapper .item-preview__list', `found, ${wrapper.querySelectorAll('img').length} img(s)`);
  } else {
    err('.item-preview__wrapper .item-preview__list', 'not found');
  }

  // og:image
  const ogImg = document.querySelector('meta[property="og:image"]');
  if (ogImg) ok('meta og:image', ogImg.getAttribute('content')?.slice(0,120));
  else err('meta og:image', 'not found');

  // Look for ANY image element that looks like a product photo
  console.group('3b. All img elements on page (first 20, src contains yami CDN)');
  const allImgs = Array.from(document.querySelectorAll('img'))
    .filter(img => {
      const src = img.getAttribute('data-src') || img.getAttribute('src') || '';
      return src.includes('yami') || src.includes('yamibuy') || src.includes('cdn');
    })
    .slice(0, 20);
  log('Count', allImgs.length);
  allImgs.forEach((img, i) => {
    const src = img.getAttribute('data-src') || img.getAttribute('src');
    const cls = img.className;
    log(`  img[${i}] class="${cls}"`, src?.slice(0, 120));
  });
  console.groupEnd();

  // Look for the main product image container
  console.group('3c. Possible image container elements');
  const containerSelectors = [
    '[data-observetrack="goods_image"]',
    '.item-preview',
    '.item-preview__wrapper',
    '.goods-gallery',
    '.product-gallery',
    '.swiper-wrapper',
    '.image-gallery',
    '.product-images',
    '.goods-detail__gallery',
  ];
  containerSelectors.forEach(sel => {
    const el = document.querySelector(sel);
    if (el) ok(sel, `found (${el.querySelectorAll('img').length} imgs inside)`);
    else log(sel, 'not found');
  });
  console.groupEnd();

  console.groupEnd(); // image selectors

  // ============================
  // 4. Quick class scan around price area
  // ============================
  console.group('4. Elements with "price" in their class name');
  const priceEls = Array.from(document.querySelectorAll('[class*="price"]')).slice(0, 30);
  priceEls.forEach(el => {
    const text = el.textContent.trim().slice(0, 60);
    if (text) log(`  .${el.className.trim().replace(/\s+/g, '.')}`, text);
  });
  console.groupEnd();

  console.groupEnd(); // main group
  console.log('%c[YAMI-DIAG] Done. Share the output above to diagnose selector mismatches.', 'color:#6366f1;font-weight:bold');
})();
