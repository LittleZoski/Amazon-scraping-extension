// Amazon Price Diagnostic Script
// Paste this into your browser's developer console on any Amazon product page

(function() {
    console.clear();
    console.log('=== AMAZON PRICE DIAGNOSTIC SCRIPT ===\n');

    // 1. Check core price display container
    console.log('--- 1. CORE PRICE DISPLAY CONTAINER ---');
    const corePriceDisplay = document.getElementById('corePriceDisplay_desktop_feature_div');
    if (corePriceDisplay) {
        console.log('✓ Found #corePriceDisplay_desktop_feature_div');
        console.log('HTML:', corePriceDisplay.outerHTML.substring(0, 500) + '...');
        console.log('');
    } else {
        console.log('✗ #corePriceDisplay_desktop_feature_div NOT FOUND');
        console.log('');
    }

    // 2. Find all a-offscreen elements
    console.log('--- 2. ALL a-offscreen ELEMENTS ---');
    const offscreenElements = document.querySelectorAll('.a-offscreen');
    console.log(`Found ${offscreenElements.length} elements with class="a-offscreen"`);
    offscreenElements.forEach((el, index) => {
        console.log(`\n[${index}] Content: "${el.textContent.trim()}"`);
        console.log(`    Parent chain:`, getParentChain(el, 3));
        console.log(`    Nearby text:`, getNearbyText(el));
        console.log(`    HTML:`, el.outerHTML);
    });
    console.log('\n');

    // 3. Find all a-price-whole elements
    console.log('--- 3. ALL a-price-whole ELEMENTS ---');
    const priceWholeElements = document.querySelectorAll('.a-price-whole');
    console.log(`Found ${priceWholeElements.length} elements with class="a-price-whole"`);
    priceWholeElements.forEach((el, index) => {
        console.log(`\n[${index}] Content: "${el.textContent.trim()}"`);
        console.log(`    Parent chain:`, getParentChain(el, 3));
        console.log(`    Nearby text:`, getNearbyText(el));
        console.log(`    HTML:`, el.outerHTML);
    });
    console.log('\n');

    // 4. Check a-box-inner containers
    console.log('--- 4. a-box-inner CONTAINERS ---');
    const boxInnerElements = document.querySelectorAll('.a-box-inner');
    console.log(`Found ${boxInnerElements.length} elements with class="a-box-inner"`);
    boxInnerElements.forEach((el, index) => {
        const priceInfo = el.textContent.match(/\$[\d,]+\.?\d*/g);
        const hasPrime = el.textContent.toLowerCase().includes('prime');
        if (priceInfo || hasPrime) {
            console.log(`\n[${index}] Has price info: ${priceInfo ? priceInfo.join(', ') : 'None'}`);
            console.log(`    Has Prime: ${hasPrime}`);
            console.log(`    Text content:`, el.textContent.trim().substring(0, 200));
            console.log(`    HTML:`, el.outerHTML.substring(0, 300) + '...');
        }
    });
    console.log('\n');

    // 5. Analyze price structure within corePriceDisplay
    console.log('--- 5. PRICE STRUCTURE IN CORE DISPLAY ---');
    if (corePriceDisplay) {
        console.log('FULL HTML OF #corePriceDisplay_desktop_feature_div:');
        console.log(corePriceDisplay.outerHTML);
        console.log('\n');

        const pricesInCore = corePriceDisplay.querySelectorAll('.a-offscreen');
        console.log(`Found ${pricesInCore.length} a-offscreen elements in core price display:`);
        pricesInCore.forEach((el, index) => {
            console.log(`\n[${index}] "${el.textContent.trim()}"`);
            console.log(`    Parent classes:`, el.parentElement?.className);
            console.log(`    Parent ID:`, el.parentElement?.id);
            console.log(`    Parent HTML:`, el.parentElement?.outerHTML.substring(0, 200));
        });

        const wholeInCore = corePriceDisplay.querySelectorAll('.a-price-whole');
        console.log(`\nFound ${wholeInCore.length} a-price-whole elements in core price display:`);
        wholeInCore.forEach((el, index) => {
            console.log(`\n[${index}] "${el.textContent.trim()}"`);
            console.log(`    Parent classes:`, el.parentElement?.className);
            console.log(`    Full price parent:`, el.closest('.a-price')?.outerHTML.substring(0, 200));
        });

        console.log('\n--- DETAILED BREAKDOWN OF CORE PRICE DISPLAY ---');

        // Check for specific price-related classes
        const priceToPay = corePriceDisplay.querySelector('.priceToPay');
        if (priceToPay) {
            console.log('Found .priceToPay:');
            console.log(priceToPay.outerHTML);
        }

        const basisPrice = corePriceDisplay.querySelector('.basisPrice');
        if (basisPrice) {
            console.log('\nFound .basisPrice:');
            console.log(basisPrice.outerHTML);
        }

        const savingsPercentage = corePriceDisplay.querySelector('.savingsPercentage');
        if (savingsPercentage) {
            console.log('\nFound .savingsPercentage:');
            console.log(savingsPercentage.outerHTML);
        }

        // Get all direct child divs
        const childDivs = corePriceDisplay.querySelectorAll(':scope > div');
        console.log(`\n\nDirect child divs (${childDivs.length}):`);
        childDivs.forEach((div, index) => {
            console.log(`\n[${index}] Classes: ${div.className}`);
            console.log(`    ID: ${div.id}`);
            console.log(`    Text content: ${div.textContent.trim().substring(0, 100)}`);
            console.log(`    HTML:`, div.outerHTML.substring(0, 300) + '...');
        });
    } else {
        console.log('corePriceDisplay not found on this page');
    }
    console.log('\n');

    // 6. Find price by common patterns
    console.log('--- 6. PRICE PATTERN ANALYSIS ---');
    const pricePatterns = [
        { name: 'Main price (.a-price .a-offscreen)', selector: '.a-price .a-offscreen' },
        { name: 'Core price display offscreen', selector: '#corePriceDisplay_desktop_feature_div .a-offscreen' },
        { name: 'Price whole in core', selector: '#corePriceDisplay_desktop_feature_div .a-price-whole' },
        { name: 'Deal price', selector: '.priceToPay .a-offscreen' },
        { name: 'List price', selector: '.basisPrice .a-offscreen' },
        { name: 'Savings price', selector: '.savingsPercentage' },
    ];

    pricePatterns.forEach(pattern => {
        const elements = document.querySelectorAll(pattern.selector);
        if (elements.length > 0) {
            console.log(`\n${pattern.name}:`);
            elements.forEach((el, index) => {
                console.log(`  [${index}] "${el.textContent.trim()}"`);
            });
        }
    });
    console.log('\n');

    // 7. Prime information
    console.log('--- 7. PRIME INFORMATION ---');
    const primeElements = document.querySelectorAll('[aria-label*="Prime"], .prime-logo, [alt*="Prime"]');
    console.log(`Found ${primeElements.length} Prime-related elements`);
    primeElements.forEach((el, index) => {
        console.log(`\n[${index}] Tag: ${el.tagName}`);
        console.log(`    Aria-label: ${el.getAttribute('aria-label')}`);
        console.log(`    Alt: ${el.getAttribute('alt')}`);
        console.log(`    Classes: ${el.className}`);
        console.log(`    Parent context:`, getParentChain(el, 2));
    });
    console.log('\n');

    // 8. Summary and recommendations
    console.log('--- 8. SUMMARY ---');
    const summary = {
        'Total a-offscreen': offscreenElements.length,
        'Total a-price-whole': priceWholeElements.length,
        'Has corePriceDisplay': !!corePriceDisplay,
        'a-offscreen in core': corePriceDisplay ? corePriceDisplay.querySelectorAll('.a-offscreen').length : 0,
        'a-price-whole in core': corePriceDisplay ? corePriceDisplay.querySelectorAll('.a-price-whole').length : 0,
    };
    console.table(summary);

    console.log('\n--- RECOMMENDED SELECTORS ---');
    console.log('Primary price: #corePriceDisplay_desktop_feature_div .a-price-whole');
    console.log('OR: #corePriceDisplay_desktop_feature_div .a-offscreen (first occurrence)');
    console.log('List price: .basisPrice .a-offscreen');
    console.log('Deal price: .priceToPay .a-offscreen');

    // Helper functions
    function getParentChain(element, levels) {
        const chain = [];
        let current = element.parentElement;
        for (let i = 0; i < levels && current; i++) {
            const id = current.id ? `#${current.id}` : '';
            const classes = current.className ? `.${current.className.split(' ').slice(0, 2).join('.')}` : '';
            chain.push(`${current.tagName}${id}${classes}`);
            current = current.parentElement;
        }
        return chain.join(' > ');
    }

    function getNearbyText(element) {
        const parent = element.parentElement;
        if (!parent) return '';
        return parent.textContent.trim().substring(0, 100).replace(/\s+/g, ' ');
    }

    console.log('\n=== END DIAGNOSTIC ===');
    console.log('Copy the output above and share it to help identify the correct selectors.');
})();
