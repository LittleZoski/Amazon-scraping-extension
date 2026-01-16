/**
 * YAMI FETCH DEBUG SCRIPT
 * Debug what's available when we fetch a page via fetch() (like bulk scraping does)
 * Run this in console on ANY Yami page
 */

(async function() {
  console.log('=== YAMI FETCH DEBUG ===\n');

  // Get current URL
  const url = window.location.href;
  console.log('Fetching:', url);

  try {
    const response = await fetch(url);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    console.log('\n1. CHECKING GALLERY IN FETCHED HTML:');
    const gallery = doc.querySelector('[data-observetrack="goods_image"] .item-preview__list');
    if (gallery) {
      const lis = gallery.querySelectorAll('li');
      console.log(`  Found ${lis.length} li items in gallery`);

      lis.forEach((li, idx) => {
        if (idx < 3) {
          const img = li.querySelector('img');
          if (img) {
            console.log(`  Li ${idx}:`);
            console.log(`    src: ${img.getAttribute('src')}`);
            console.log(`    data-src: ${img.getAttribute('data-src')}`);
          }
        }
      });
    } else {
      console.log('  Gallery NOT found in fetched HTML');
    }

    console.log('\n2. CHECKING JSON-LD IN FETCHED HTML:');
    const scripts = doc.querySelectorAll('script');
    let foundProductSchema = false;

    for (let i = 0; i < scripts.length; i++) {
      const content = scripts[i].textContent.trim();
      if (content.includes('"@type":"Product"') || content.includes('"@type": "Product"')) {
        try {
          const jsonld = JSON.parse(content);
          foundProductSchema = true;
          console.log('  Found JSON-LD Product schema');
          console.log('  jsonld.image:', jsonld.image);
          console.log('  Is array?', Array.isArray(jsonld.image));
          console.log('  Count:', Array.isArray(jsonld.image) ? jsonld.image.length : 1);

          // Check for other possible image fields
          console.log('\n  Checking other possible image fields:');
          console.log('  jsonld.images:', jsonld.images);
          console.log('  jsonld.gallery:', jsonld.gallery);
          console.log('  jsonld.photo:', jsonld.photo);
          console.log('  jsonld.photos:', jsonld.photos);

          // Dump the entire object to see what's available
          console.log('\n  Full JSON-LD object keys:', Object.keys(jsonld));
          console.log('  Full JSON-LD object:', jsonld);
        } catch (e) {
          console.error('  Error parsing JSON-LD:', e);
        }
        break;
      }
    }

    if (!foundProductSchema) {
      console.log('  No JSON-LD Product schema found in fetched HTML');
    }

    console.log('\n3. CHECKING __NUXT__ DATA (Vue SSR state):');
    const nuxtScript = Array.from(scripts).find(s => s.textContent.includes('window.__NUXT__'));
    if (nuxtScript) {
      console.log('  Found __NUXT__ data!');
      console.log('  This contains the Vue SSR state with all product data');
      console.log('  First 500 chars:', nuxtScript.textContent.substring(0, 500));

      // Try to extract and parse it
      try {
        const nuxtMatch = nuxtScript.textContent.match(/window\.__NUXT__\s*=\s*({.+})/);
        if (nuxtMatch) {
          // This is complex to parse, but might contain all images
          console.log('  __NUXT__ data exists and might contain all gallery images');
          console.log('  Search for "757x757" or image hashes in the raw data');
        }
      } catch (e) {
        console.error('  Error parsing __NUXT__:', e);
      }
    } else {
      console.log('  No __NUXT__ data found');
    }

    console.log('\n=== END FETCH DEBUG ===');

  } catch (error) {
    console.error('Error:', error);
  }
})();
