/**
 * YAMI LAZY LOAD DEBUG SCRIPT
 * Run this IMMEDIATELY when page loads (before scrolling)
 * to see what data attributes the lazy-loaded images have
 */

(function() {
  console.log('=== YAMI LAZY LOAD DEBUG ===\n');

  const gallery = document.querySelector('[data-observetrack="goods_image"] .item-preview__list');
  if (!gallery) {
    console.error('Gallery not found!');
    return;
  }

  const lis = gallery.querySelectorAll('li');
  console.log(`Found ${lis.length} li items\n`);

  lis.forEach((li, idx) => {
    console.log(`--- Li ${idx} ---`);
    const img = li.querySelector('img');
    if (img) {
      console.log('  src:', img.src);
      console.log('  getAttribute("src"):', img.getAttribute('src'));
      console.log('  data-src:', img.getAttribute('data-src'));
      console.log('  data-lazy:', img.getAttribute('data-lazy'));
      console.log('  data-original:', img.getAttribute('data-original'));
      console.log('  dataset.src:', img.dataset.src);
      console.log('  dataset.lazy:', img.dataset.lazy);
      console.log('  dataset.original:', img.dataset.original);

      // Check parent elements for data attributes
      const parent = li;
      console.log('  parent (li) data-src:', parent.getAttribute('data-src'));
      console.log('  parent (li) dataset:', parent.dataset);

      // Check for any data- attributes
      const allAttrs = {};
      for (let attr of img.attributes) {
        if (attr.name.startsWith('data-')) {
          allAttrs[attr.name] = attr.value;
        }
      }
      console.log('  All data-* attributes on img:', allAttrs);
    }
    console.log('');
  });

  console.log('=== END DEBUG ===');
})();
