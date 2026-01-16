/**
 * YAMI DEBUG SCRIPT
 * Run this in the browser console on the Yami product page to find the exact selectors
 * URL: https://www.yami.com/en/p/fino-premium-touch-hair-mask-230g-repair-shampoo-550ml-conditioner-550ml-hair-oil-70ml/1024141581
 */

console.log('=== YAMI DOM STRUCTURE ANALYSIS ===\n');

// 1. FIND PRICE
console.log('1. PRICE ELEMENT:');
console.log('Searching for elements containing "$35.99" or "35.99"...\n');

const priceSearchText = '35.99';
const allElements = document.querySelectorAll('*');
const priceElements = [];

allElements.forEach(el => {
  const text = el.textContent;
  if (text && text.includes(priceSearchText) && !el.querySelector('*')) {
    // Leaf node containing the price
    priceElements.push({
      tag: el.tagName,
      classes: el.className,
      text: el.textContent.trim(),
      parent: el.parentElement ? {
        tag: el.parentElement.tagName,
        classes: el.parentElement.className
      } : null,
      grandparent: el.parentElement?.parentElement ? {
        tag: el.parentElement.parentElement.tagName,
        classes: el.parentElement.parentElement.className
      } : null
    });
  }
});

console.log('Found price elements:', priceElements);
console.log('\nDirect selector test:');
console.log('.bff-item__price--valid:', document.querySelector('.bff-item__price--valid')?.textContent.trim());
console.log('.red-price:', document.querySelector('.red-price')?.textContent.trim());
console.log('.item-price__valid:', document.querySelector('.item-price__valid')?.textContent.trim());

// 2. FIND PRODUCT HIGHLIGHTS
console.log('\n\n2. PRODUCT HIGHLIGHTS:');
console.log('Searching for headings containing "highlight"...\n');

const allHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
let highlightsSection = null;

allHeadings.forEach(h => {
  const text = h.textContent.toLowerCase();
  if (text.includes('highlight') || text.includes('product highlight')) {
    console.log('Found heading:', {
      tag: h.tagName,
      classes: h.className,
      text: h.textContent.trim()
    });

    // Find the next UL or OL
    let next = h.nextElementSibling;
    let depth = 0;
    while (next && depth < 5) {
      console.log(`  Next sibling ${depth}:`, {
        tag: next.tagName,
        classes: next.className
      });

      if (next.tagName === 'UL' || next.tagName === 'OL') {
        highlightsSection = next;
        console.log('  Found UL/OL:', {
          tag: next.tagName,
          classes: next.className,
          children: next.children.length
        });

        // Show first 3 LI items
        const lis = next.querySelectorAll('li');
        console.log(`  First 3 bullet points (out of ${lis.length}):`);
        for (let i = 0; i < Math.min(3, lis.length); i++) {
          console.log(`    ${i + 1}. "${lis[i].textContent.trim().substring(0, 80)}..."`);
        }
        break;
      }

      const ul = next.querySelector('ul, ol');
      if (ul) {
        highlightsSection = ul;
        console.log('  Found nested UL/OL:', {
          tag: ul.tagName,
          classes: ul.className,
          children: ul.children.length
        });
        break;
      }

      next = next.nextElementSibling;
      depth++;
    }
  }
});

if (!highlightsSection) {
  console.log('No "Product Highlights" heading found. Trying alternative selectors...');
  const alternatives = [
    '.item-desc__detail ul',
    '.product-highlights ul',
    '.highlights ul',
    '[data-qa="highlights"] ul'
  ];

  alternatives.forEach(sel => {
    const el = document.querySelector(sel);
    if (el) {
      console.log(`Found via selector "${sel}":`, {
        tag: el.tagName,
        classes: el.className,
        bullets: el.querySelectorAll('li').length
      });
    }
  });
}

// 3. FIND DETAILS/SPECIFICATIONS
console.log('\n\n3. DETAILS/SPECIFICATIONS:');
console.log('Searching for headings containing "detail" or "specification"...\n');

allHeadings.forEach(h => {
  const text = h.textContent.toLowerCase();
  if (text.includes('detail') || text.includes('specification') || text.includes('information')) {
    console.log('Found heading:', {
      tag: h.tagName,
      classes: h.className,
      text: h.textContent.trim()
    });

    // Find the next TABLE or DL
    let next = h.nextElementSibling;
    let depth = 0;
    while (next && depth < 5) {
      console.log(`  Next sibling ${depth}:`, {
        tag: next.tagName,
        classes: next.className
      });

      if (next.tagName === 'TABLE') {
        console.log('  Found TABLE:', {
          classes: next.className,
          rows: next.querySelectorAll('tr').length
        });

        const rows = next.querySelectorAll('tr');
        console.log('  First 3 rows:');
        for (let i = 0; i < Math.min(3, rows.length); i++) {
          const cells = rows[i].querySelectorAll('td, th');
          if (cells.length >= 2) {
            console.log(`    ${cells[0].textContent.trim()}: ${cells[1].textContent.trim()}`);
          }
        }
        break;
      }

      if (next.tagName === 'DL') {
        console.log('  Found DL (definition list):', {
          classes: next.className,
          terms: next.querySelectorAll('dt').length
        });

        const dts = next.querySelectorAll('dt');
        const dds = next.querySelectorAll('dd');
        console.log('  First 3 items:');
        for (let i = 0; i < Math.min(3, dts.length); i++) {
          console.log(`    ${dts[i].textContent.trim()}: ${dds[i]?.textContent.trim()}`);
        }
        break;
      }

      const table = next.querySelector('table');
      const dl = next.querySelector('dl');
      if (table || dl) {
        console.log('  Found nested structure:', table ? 'TABLE' : 'DL');
        break;
      }

      next = next.nextElementSibling;
      depth++;
    }
  }
});

// 4. CHECK JSON-LD
console.log('\n\n4. JSON-LD STRUCTURED DATA:');
const jsonldScripts = document.querySelectorAll('script[type="application/ld+json"]');
console.log(`Found ${jsonldScripts.length} JSON-LD script(s)`);

jsonldScripts.forEach((script, i) => {
  try {
    const data = JSON.parse(script.textContent);
    console.log(`\nJSON-LD ${i + 1}:`, {
      type: data['@type'],
      name: data.name?.substring(0, 50),
      price: data.offers?.price,
      brand: data.brand?.name,
      hasImage: !!data.image,
      hasDescription: !!data.description
    });

    if (data['@type'] === 'Product') {
      console.log('Full product data available:', data);
    }
  } catch (e) {
    console.log(`JSON-LD ${i + 1}: Parse error`, e.message);
  }
});

// 5. ANALYZE ITEM-DESC STRUCTURE
console.log('\n\n5. ITEM-DESC STRUCTURE ANALYSIS:');
console.log('Looking for div.item-desc__wrapper and div.item-desc__content...\n');

// Find item-desc__wrapper
const itemDescWrapper = document.querySelector('.item-desc__wrapper, .item-desc_wrapper');
if (itemDescWrapper) {
  console.log('✓ Found .item-desc__wrapper:', {
    classes: itemDescWrapper.className,
    childrenCount: itemDescWrapper.children.length
  });

  // Show all direct children
  console.log('\nDirect children of .item-desc__wrapper:');
  Array.from(itemDescWrapper.children).forEach((child, i) => {
    console.log(`  ${i + 1}. <${child.tagName}> class="${child.className}"`);

    // If it's a heading, show the text
    if (child.tagName.match(/^H[1-6]$/)) {
      console.log(`     Text: "${child.textContent.trim()}"`);
    }

    // If it has children, show first level
    if (child.children.length > 0) {
      console.log(`     Has ${child.children.length} children:`);
      Array.from(child.children).slice(0, 3).forEach((grandchild, j) => {
        console.log(`       - <${grandchild.tagName}> class="${grandchild.className}"`);
      });
      if (child.children.length > 3) {
        console.log(`       ... and ${child.children.length - 3} more`);
      }
    }
  });
} else {
  console.log('✗ .item-desc__wrapper NOT FOUND');
}

// Find item-desc__content
const itemDescContent = document.querySelector('.item-desc__content');
if (itemDescContent) {
  console.log('\n✓ Found .item-desc__content:', {
    classes: itemDescContent.className,
    childrenCount: itemDescContent.children.length
  });

  // Show all direct children
  console.log('\nDirect children of .item-desc__content:');
  Array.from(itemDescContent.children).forEach((child, i) => {
    console.log(`  ${i + 1}. <${child.tagName}> class="${child.className}"`);

    // If it's a heading, show the text
    if (child.tagName.match(/^H[1-6]$/)) {
      console.log(`     Text: "${child.textContent.trim()}"`);

      // Show what comes after the heading
      const next = child.nextElementSibling;
      if (next) {
        console.log(`     Next sibling: <${next.tagName}> class="${next.className}"`);

        // If it's a list, show items
        if (next.tagName === 'UL' || next.tagName === 'OL') {
          const items = next.querySelectorAll('li');
          console.log(`       Contains ${items.length} list items`);
          items.forEach((li, idx) => {
            if (idx < 2) {
              console.log(`         ${idx + 1}. "${li.textContent.trim().substring(0, 60)}..."`);
            }
          });
        }

        // If it's a table, show rows
        if (next.tagName === 'TABLE') {
          const rows = next.querySelectorAll('tr');
          console.log(`       Contains ${rows.length} table rows`);
          rows.forEach((tr, idx) => {
            if (idx < 3) {
              const cells = tr.querySelectorAll('td, th');
              if (cells.length >= 2) {
                console.log(`         ${cells[0].textContent.trim()}: ${cells[1].textContent.trim()}`);
              }
            }
          });
        }

        // If it's a div, show what's inside
        if (next.tagName === 'DIV') {
          console.log(`       DIV contains:`);
          console.log(`         Text length: ${next.textContent.trim().length} chars`);
          console.log(`         First 100 chars: "${next.textContent.trim().substring(0, 100)}..."`);
        }
      }
    }
  });
} else {
  console.log('✗ .item-desc__content NOT FOUND');
}

// 6. FIND ALL HEADINGS IN ITEM-DESC
console.log('\n\n6. ALL HEADINGS IN ITEM-DESC AREAS:');
const allItemDescHeadings = document.querySelectorAll('.item-desc__wrapper h1, .item-desc__wrapper h2, .item-desc__wrapper h3, .item-desc__wrapper h4, .item-desc__content h1, .item-desc__content h2, .item-desc__content h3, .item-desc__content h4');
console.log(`Found ${allItemDescHeadings.length} headings in item-desc areas:\n`);

allItemDescHeadings.forEach((h, i) => {
  console.log(`${i + 1}. <${h.tagName}> class="${h.className}"`);
  console.log(`   Text: "${h.textContent.trim()}"`);

  const next = h.nextElementSibling;
  if (next) {
    console.log(`   Followed by: <${next.tagName}> class="${next.className}"`);
  }
  console.log('');
});

// 7. SUMMARY
console.log('\n\n=== SUMMARY ===');
console.log('Run this script and copy the output to help debug the selectors.');
console.log('Then update YamiDataExtractor.js with the correct selectors.');
