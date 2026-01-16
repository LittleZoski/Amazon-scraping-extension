/**
 * YAMI IMAGE DEBUG SCRIPT
 * Run this in the browser console on a Yami product page
 * to see what images are available in the DOM
 */

(function() {
  console.log('=== YAMI IMAGE DEBUG SCRIPT ===\n');

  // 1. Check JSON-LD
  console.log('1. JSON-LD IMAGES:');
  const scripts = document.querySelectorAll('script');
  for (let i = 0; i < scripts.length; i++) {
    const content = scripts[i].textContent.trim();
    if (content.includes('"@type":"Product"') || content.includes('"@type": "Product"')) {
      try {
        const jsonld = JSON.parse(content);
        console.log('  JSON-LD image array:', jsonld.image);
        console.log('  Count:', jsonld.image?.length || 0);
      } catch (e) {
        console.error('  Error parsing JSON-LD:', e);
      }
      break;
    }
  }

  // 2. Check image gallery DOM structure
  console.log('\n2. IMAGE GALLERY DOM:');

  const gallery1 = document.querySelector('[data-observetrack="goods_image"] .item-preview__list');
  console.log('  Gallery selector 1 found:', !!gallery1);
  if (gallery1) {
    const items = gallery1.querySelectorAll('li');
    console.log('  Number of li items:', items.length);
    console.log('  First 5 li items:');
    items.forEach((li, idx) => {
      if (idx < 5) {
        console.log(`    Li ${idx}:`, li.outerHTML.substring(0, 200) + '...');
        const imgs = li.querySelectorAll('img');
        console.log(`      Images in li ${idx}:`, imgs.length);
        imgs.forEach((img, imgIdx) => {
          console.log(`        Img ${imgIdx} src:`, img.src);
          console.log(`        Img ${imgIdx} data-src:`, img.getAttribute('data-src'));
          console.log(`        Img ${imgIdx} data-lazy:`, img.getAttribute('data-lazy'));
          console.log(`        Img ${imgIdx} data-original:`, img.getAttribute('data-original'));
        });
      }
    });
  }

  const gallery2 = document.querySelector('.item-preview__wrapper .item-preview__list');
  console.log('\n  Gallery selector 2 found:', !!gallery2);
  if (gallery2 && gallery2 !== gallery1) {
    const items = gallery2.querySelectorAll('li');
    console.log('  Number of li items:', items.length);
  }

  // 3. Check all img tags in the page
  console.log('\n3. ALL IMG TAGS WITH "item" OR "product" IN URL:');
  const allImgs = document.querySelectorAll('img');
  let productImages = [];
  allImgs.forEach(img => {
    const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy') || '';
    if ((src.includes('/item/') || src.includes('/product/')) && !src.includes('logo') && !src.includes('lazy.svg')) {
      productImages.push({
        src: src,
        dataSrc: img.getAttribute('data-src'),
        dataLazy: img.getAttribute('data-lazy'),
        element: img
      });
    }
  });
  console.log('  Found', productImages.length, 'product images');
  console.log('  Unique URLs:', [...new Set(productImages.map(p => p.src))]);

  // 4. Check for data attributes in gallery
  console.log('\n4. CHECKING GALLERY FOR DATA ATTRIBUTES:');
  if (gallery1) {
    const items = gallery1.querySelectorAll('li');
    items.forEach((li, idx) => {
      console.log(`  Li ${idx} attributes:`, Object.keys(li.dataset).length > 0 ? li.dataset : 'none');
      const links = li.querySelectorAll('a');
      links.forEach((a, aIdx) => {
        console.log(`    Link ${aIdx} href:`, a.href);
        console.log(`    Link ${aIdx} data attributes:`, Object.keys(a.dataset).length > 0 ? a.dataset : 'none');
      });
    });
  }

  // 5. Look for any elements with data-src containing image URLs
  console.log('\n5. ELEMENTS WITH data-src ATTRIBUTE:');
  const elementsWithDataSrc = document.querySelectorAll('[data-src*="/item/"], [data-src*="/product/"]');
  console.log('  Found', elementsWithDataSrc.length, 'elements with data-src');
  elementsWithDataSrc.forEach((el, idx) => {
    if (idx < 10) {
      console.log(`  Element ${idx}:`, el.tagName, el.getAttribute('data-src'));
    }
  });

  // 6. Export for manual inspection
  window.YAMI_IMAGE_DEBUG = {
    gallery1,
    gallery2,
    productImages,
    jsonld: scripts
  };

  console.log('\n✓ Debug data saved to window.YAMI_IMAGE_DEBUG');
  console.log('=== END DEBUG SCRIPT ===');
})();
