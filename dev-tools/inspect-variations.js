// Amazon Variation Inspector - paste into browser console on the product page
// Logs all variation-related HTML sections for analysis

(function inspectVariations() {
  const sep = (label) => console.log(`\n${'='.repeat(60)}\n  ${label}\n${'='.repeat(60)}`);
  const sub = (label) => console.log(`\n--- ${label} ---`);

  sep('1. VARIATION FORM WRAPPER');
  const form = document.getElementById('twister-plus-main-component-id')
    || document.getElementById('twister_feature_div')
    || document.querySelector('#twister')
    || document.querySelector('[data-feature-name="twister"]')
    || document.querySelector('[data-feature-name="twister_plus"]');
  if (form) {
    console.log('Found wrapper:', form.id || form.className);
    console.log(form.outerHTML.slice(0, 3000));
  } else {
    console.warn('No twister wrapper found');
  }

  sep('2. VARIATION DIMENSIONS (each swatch group)');
  // Each dimension group (Color, Size, Style, etc.)
  const variationGroups = document.querySelectorAll('[class*="variation_"], [id*="variation_"]');
  variationGroups.forEach(el => {
    console.log(`\nID: ${el.id} | Tag: ${el.tagName} | Class: ${el.className}`);
    console.log(el.outerHTML.slice(0, 2000));
  });

  sep('3. INLINE TWISTER SWATCHES (new style)');
  const inlineTwister = document.querySelectorAll('.inline-twister-dim, .inline-twister-row');
  inlineTwister.forEach((el, i) => {
    console.log(`\n[${i}] ${el.className}`);
    console.log(el.outerHTML.slice(0, 2000));
  });

  sep('4. SIZE CHART TRIGGER / CONTAINER');
  const sizeChartSelectors = [
    '#size-chart-url',
    '[id*="size-chart"]',
    '[class*="size-chart"]',
    '[data-action*="size-chart"]',
    'a[href*="size-chart"]',
    '#variation_style_name',
    '.a-size-chart',
    '[data-csa-c-slot-id*="size"]',
  ];
  sizeChartSelectors.forEach(sel => {
    const els = document.querySelectorAll(sel);
    if (els.length) {
      els.forEach(el => {
        console.log(`\nSelector: ${sel}`);
        console.log('ID:', el.id, '| Class:', el.className);
        console.log(el.outerHTML.slice(0, 1000));
      });
    }
  });

  sep('5. SIZE CHART POPUP / MODAL (if already open, or hidden)');
  const modalSelectors = [
    '#a-popover-content-1',
    '[id^="a-popover-content"]',
    '.a-popover',
    '[data-action="size-chart-modal"]',
    '#sizechartPopupWrapper',
    '#size_chart',
  ];
  modalSelectors.forEach(sel => {
    const els = document.querySelectorAll(sel);
    if (els.length) {
      els.forEach(el => {
        console.log(`\nModal selector: ${sel}`);
        console.log(el.outerHTML.slice(0, 1500));
      });
    }
  });

  sep('6. SELECTED VARIATION / CURRENT ASIN DATA');
  // Amazon often stores variation data in a script tag or window variable
  const dataScripts = [...document.querySelectorAll('script')].filter(s =>
    s.textContent.includes('variationValues') ||
    s.textContent.includes('dimensionValuesData') ||
    s.textContent.includes('twister-js-init-dpx-data') ||
    s.textContent.includes('"colorImages"') ||
    s.textContent.includes('jQuery.parseJSON')
  );
  console.log(`Found ${dataScripts.length} script tags with variation data`);
  dataScripts.slice(0, 3).forEach((s, i) => {
    console.log(`\nScript[${i}]:`, s.textContent.slice(0, 3000));
  });

  sep('7. window.P.register / dataLayer variation data');
  // Check for inline JSON data
  const allScripts = [...document.querySelectorAll('script:not([src])')];
  const varScript = allScripts.find(s =>
    s.textContent.includes('variationValues') ||
    s.textContent.includes('asinVariationValues')
  );
  if (varScript) {
    console.log(varScript.textContent.slice(0, 5000));
  } else {
    console.warn('No variationValues script found');
  }

  sep('8. SWATCH ITEMS (individual color/size buttons)');
  const swatchItems = document.querySelectorAll(
    'li[id*="color_name_"], li[id*="size_name_"], ' +
    '[data-dp-url], .swatch-list .swatch-item, ' +
    '.twister-plus-buying-options-price-data, ' +
    'li.swatchAvailable, li.swatchUnavailable, li.swatchSelected'
  );
  console.log(`Found ${swatchItems.length} swatch items`);
  swatchItems.forEach((el, i) => {
    if (i < 20) {
      console.log(`\n[${i}] ID: ${el.id}`);
      console.log(`  data-dp-url: ${el.dataset.dpUrl || 'none'}`);
      console.log(`  data-defaultasin: ${el.dataset.defaultasin || 'none'}`);
      console.log(el.outerHTML.slice(0, 500));
    }
  });

  sep('9. PRICE BLOCK (current selection)');
  const priceEls = document.querySelectorAll(
    '#priceblock_ourprice, #priceblock_dealprice, ' +
    '.a-price .a-offscreen, #corePrice_feature_div, ' +
    '#apex_offerDisplay_desktop, #corePriceDisplay_desktop_feature_div'
  );
  priceEls.forEach(el => {
    console.log(`\n${el.id || el.className}:`);
    console.log(el.outerHTML.slice(0, 800));
  });

  sep('10. RAW twister-js-init DATA (variation map)');
  const twisterInit = document.getElementById('twister-js-init-dpx-data');
  if (twisterInit) {
    console.log(twisterInit.textContent.slice(0, 8000));
  } else {
    // try script with twister data
    const ts = allScripts.find(s => s.textContent.includes('twister'));
    if (ts) console.log(ts.textContent.slice(0, 5000));
    else console.warn('No twister init data element found');
  }

  console.log('\n\nINSPECTION COMPLETE');
})();
