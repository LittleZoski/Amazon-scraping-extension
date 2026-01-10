/**
 * OrderDataExtractor - Extracts order data from eBay order detail pages
 * Uses robust fallback patterns and text extraction for maximum compatibility
 */
export class OrderDataExtractor {
  /**
   * Extract order data from the current eBay order details page
   * @returns {Object} Order data object with all extracted information
   */
  static extractOrderData() {
    console.log('Starting order data extraction...');

    const orderData = {
      orderId: this.getOrderId(),
      orderDate: this.getOrderDate(),
      buyerInfo: this.getBuyerInfo(),
      shippingAddress: this.getShippingAddress(),
      items: this.getOrderItems(),
      financials: this.getFinancials(),
      tracking: this.getTrackingInfo(),
      orderStatus: this.getOrderStatus(),
      url: window.location.href,
      scrapedAt: new Date().toISOString()
    };

    console.log('Extracted order data:', orderData);
    return orderData;
  }

  /**
   * Extract order ID from URL or page text
   * @returns {string} Order ID
   */
  static getOrderId() {
    // Try URL first (most reliable for eBay)
    const urlMatch = window.location.href.match(/orderid=([^&]+)/i);
    if (urlMatch) {
      console.log('Found order ID in URL:', urlMatch[1]);
      return urlMatch[1];
    }

    // Search page text for order number pattern
    const bodyText = document.body.innerText;
    const patterns = [
      /Order\s*(?:number|#|ID)[:\s]+(\d{2}-\d{5}-\d{5})/i,
      /(\d{2}-\d{5}-\d{5})/  // Just the pattern itself
    ];

    for (const pattern of patterns) {
      const match = bodyText.match(pattern);
      if (match) {
        console.log('Found order ID in page text:', match[1]);
        return match[1];
      }
    }

    console.warn('Could not find order ID');
    return 'Unknown';
  }

  /**
   * Extract order date from page text
   * @returns {string} Order date
   */
  static getOrderDate() {
    const bodyText = document.body.innerText;

    // Look for date patterns
    const patterns = [
      /(?:Order|Sold|Purchase)\s+date[:\s]+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i,
      /([A-Za-z]+\s+\d{1,2},\s+\d{4})/  // Generic date format
    ];

    for (const pattern of patterns) {
      const match = bodyText.match(pattern);
      if (match) {
        console.log('Found order date:', match[1]);
        return match[1];
      }
    }

    return new Date().toLocaleDateString();
  }

  /**
   * Extract buyer information
   * @returns {Object} Buyer info object
   */
  static getBuyerInfo() {
    return {
      username: this.getBuyerUsername(),
      email: null
    };
  }

  /**
   * Extract buyer username from page
   * @returns {string} Buyer username
   */
  static getBuyerUsername() {
    const bodyText = document.body.innerText;
    const match = bodyText.match(/(?:Buyer|Sold to)[:\s]+([^\n]+)/i);

    if (match) {
      console.log('Found buyer username:', match[1].trim());
      return match[1].trim();
    }

    return null;
  }

  /**
   * Extract shipping address - uses generic text extraction
   * @returns {Object} Shipping address object
   */
  static getShippingAddress() {
    // Target the specific shipping-info div
    const shippingDiv = document.querySelector('div.shipping-info');

    if (!shippingDiv) {
      console.warn('Could not find div.shipping-info');
      return {
        name: null,
        fullAddress: null,
        addressLine1: null,
        city: null,
        stateOrProvince: null,
        postalCode: null,
        phoneNumber: null
      };
    }

    console.log('Found shipping-info div:', shippingDiv);

    // Extract address components from the nested structure
    const addressDiv = shippingDiv.querySelector('div.shipping-address div.address');

    let address = {
      name: null,
      fullAddress: null,
      addressLine1: null,
      city: null,
      stateOrProvince: null,
      postalCode: null,
      phoneNumber: null
    };

    if (!addressDiv) {
      console.warn('Could not find div.address inside shipping-info');
      return address;
    }

    // Get all the clickable buttons (they contain the address parts)
    const addressButtons = addressDiv.querySelectorAll('button.tooltip__host');

    if (addressButtons.length >= 4) {
      // addressButtons[0] = Name (e.g., "Lynn Applegate")
      address.name = addressButtons[0].innerText.trim();

      // addressButtons[1] = Street (e.g., "3735 SE 53rd St")
      address.addressLine1 = addressButtons[1].innerText.trim();

      // addressButtons[2] = City (e.g., "Berryton")
      address.city = addressButtons[2].innerText.trim();

      // addressButtons[3] = State (e.g., "KS")
      address.stateOrProvince = addressButtons[3].innerText.trim();

      // addressButtons[4] = Zip (e.g., "66409-9217")
      if (addressButtons[4]) {
        address.postalCode = addressButtons[4].innerText.trim();
      }

      console.log('Extracted address components:', {
        name: address.name,
        street: address.addressLine1,
        city: address.city,
        state: address.stateOrProvince,
        zip: address.postalCode
      });
    }

    // Extract phone number from the phone dl element
    const phoneDl = shippingDiv.querySelector('dl.phone dd.info-value button');
    if (phoneDl) {
      address.phoneNumber = phoneDl.innerText.trim();
      console.log('Extracted phone:', address.phoneNumber);
    }

    // Build full address
    const addressParts = [
      address.name,
      address.addressLine1,
      `${address.city}, ${address.stateOrProvince} ${address.postalCode}`.trim()
    ].filter(p => p);

    address.fullAddress = addressParts.join(', ');

    console.log('Final extracted shipping address:', address);
    return address;
  }

  /**
   * Extract order items - simplified extraction
   * @returns {Array} Array of item objects
   */
  static getOrderItems() {
    const items = [];

    // Target the specific item-info div (note: ID is "itemInfo" not "iteminfo")
    let itemDiv = document.querySelector('div.item-info#itemInfo');

    // Fallback to just class if ID doesn't match
    if (!itemDiv) {
      itemDiv = document.querySelector('div.item-info');
    }

    if (!itemDiv) {
      console.warn('Could not find div.item-info');
      return [{ title: 'Order Item', quantity: 1, itemId: null, sku: null, soldPrice: null, imageUrl: null }];
    }

    console.log('Found item-info div:', itemDiv);

    // Extract item title from the link (based on HTML: <a href="...">Blissal Exfoliating Shower Towel...</a>)
    const titleLink = itemDiv.querySelector('a[href*="/itm/"]');
    const title = titleLink ? titleLink.innerText.trim() : null;

    // Extract item ID from the link
    let itemId = null;
    if (titleLink) {
      const itemIdMatch = titleLink.href.match(/\/itm\/(\d+)/);
      itemId = itemIdMatch ? itemIdMatch[1] : null;
    }

    // Extract SKU from lineItemCardInfo__sku div
    // HTML: <div class="lineItemCardInfo__sku spaceTop"><span class="sh-secondary">Custom label (SKU): </span><span class="sh-secondary">B0FZ9QB19R</span></div>
    let sku = null;
    const skuDiv = itemDiv.querySelector('div.lineItemCardInfo__sku');
    if (skuDiv) {
      const skuSpans = skuDiv.querySelectorAll('span.sh-secondary');
      if (skuSpans.length >= 2) {
        sku = skuSpans[1].innerText.trim();
      }
    }

    // Extract item ID again from lineItemCardInfo__itemId div (more reliable)
    const itemIdDiv = itemDiv.querySelector('div.lineItemCardInfo__itemId');
    if (itemIdDiv && !itemId) {
      const itemIdSpans = itemIdDiv.querySelectorAll('span.sh-secondary');
      if (itemIdSpans.length >= 2) {
        itemId = itemIdSpans[1].innerText.trim();
      }
    }

    // Extract quantity from quantity-and-price section
    // HTML: <div class="quantity__value"><span class="sh-bold">1</span>(9 available)</div>
    let quantity = 1;
    const quantityValue = itemDiv.querySelector('div.quantity__value span.sh-bold');
    if (quantityValue) {
      const qtyText = quantityValue.innerText.trim();
      const qtyMatch = qtyText.match(/(\d+)/);
      quantity = qtyMatch ? parseInt(qtyMatch[1]) : 1;
    }

    // Extract sold price from soldPrice section
    // HTML: <div class="soldPrice__value">$22.55</div>
    let soldPrice = null;
    const priceDiv = itemDiv.querySelector('div.soldPrice__value');
    if (priceDiv) {
      soldPrice = priceDiv.innerText.trim();
    }

    // Extract image URL
    const imageElement = itemDiv.querySelector('img.orders-image-control__image');
    const imageUrl = imageElement ? imageElement.src : null;

    const item = {
      title: title || 'Order Item',
      itemId: itemId,
      sku: sku,
      quantity: quantity,
      soldPrice: soldPrice,
      imageUrl: imageUrl
    };

    items.push(item);
    console.log('Extracted item:', item);

    return items;
  }

  /**
   * Extract item title from text
   * @param {string} text - Page text
   * @returns {string} Item title
   */
  static getItemTitleFromText(text) {
    // Look for product/item title patterns
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 10);

    // Find longest line that looks like a product title (not too short, not a label)
    for (const line of lines) {
      if (line.length > 20 && line.length < 200 && !line.includes(':') && !line.match(/^\d/)) {
        console.log('Found potential item title:', line);
        return line;
      }
    }

    return 'Order Item';
  }

  /**
   * Get first image from page
   * @returns {string} Image URL
   */
  static getFirstImage() {
    const img = document.querySelector('img[src*="ebayimg"]');
    return img ? img.src : null;
  }

  /**
   * Extract financial information from text
   * @returns {Object} Financial data object
   */
  static getFinancials() {
    // Target the specific payment-info div
    const paymentDiv = document.querySelector('div.payment-info');

    if (!paymentDiv) {
      console.warn('Could not find div.payment-info');
      return {
        totalSale: null,
        yourEarnings: null,
        ebayFees: null,
        shippingCost: null,
        paymentMethod: null
      };
    }

    console.log('Found payment-info div:', paymentDiv);

    // Extract "Order total" from the "What your buyer paid" section
    // HTML: <dl class="total"><dt class="label">...<dd class="amount"><div class="value"><span class="sh-bold">$24.32</span></div></dd></dl>
    let orderTotal = null;
    const buyerPaidSection = paymentDiv.querySelector('div.buyer-paid');
    if (buyerPaidSection) {
      const orderTotalDl = buyerPaidSection.querySelector('dl.total dd.amount div.value span.sh-bold');
      if (orderTotalDl) {
        orderTotal = orderTotalDl.innerText.trim();
        console.log('Extracted order total (buyer paid):', orderTotal);
      }
    }

    // Extract "Order earnings" from the "What you earned" section
    // This is in div.earnings > dl.total
    let yourEarnings = null;
    const earningsSection = paymentDiv.querySelector('div.earnings');
    if (earningsSection) {
      const earningsTotalDl = earningsSection.querySelector('dl.total dd.amount div.value span.sh-bold');
      if (earningsTotalDl) {
        yourEarnings = earningsTotalDl.innerText.trim();
        console.log('Extracted order earnings (what you earned):', yourEarnings);
      }
    }

    // Extract sales tax
    let salesTax = null;
    if (buyerPaidSection) {
      const salesTaxItem = Array.from(buyerPaidSection.querySelectorAll('div.data-item')).find(item => {
        const label = item.querySelector('dt.label');
        return label && label.innerText.includes('Sales tax');
      });
      if (salesTaxItem) {
        const taxValue = salesTaxItem.querySelector('dd.amount div.value');
        salesTax = taxValue ? taxValue.innerText.trim() : null;
      }
    }

    // Extract eBay fees (Transaction fees)
    let ebayFees = null;
    if (earningsSection) {
      const feesItem = Array.from(earningsSection.querySelectorAll('div.data-item')).find(item => {
        const label = item.querySelector('dt.label');
        return label && label.innerText.includes('Transaction fees');
      });
      if (feesItem) {
        const feesValue = feesItem.querySelector('dd.amount div.value span.sh-secondary');
        ebayFees = feesValue ? feesValue.innerText.trim() : null;
      }
    }

    // Extract shipping cost
    let shippingCost = null;
    if (buyerPaidSection) {
      const shippingItem = Array.from(buyerPaidSection.querySelectorAll('div.data-item')).find(item => {
        const label = item.querySelector('dt.label');
        return label && label.innerText.includes('Shipping');
      });
      if (shippingItem) {
        const shippingValue = shippingItem.querySelector('dd.amount div.value');
        shippingCost = shippingValue ? shippingValue.innerText.trim() : null;
      }
    }

    console.log('Extracted financials:', {
      orderTotal,
      yourEarnings,
      salesTax,
      ebayFees,
      shippingCost
    });

    return {
      totalSale: orderTotal,
      yourEarnings: yourEarnings,
      ebayFees: ebayFees,
      shippingCost: shippingCost,
      salesTax: salesTax,
      paymentMethod: null
    };
  }

  /**
   * Extract price from text using pattern
   * @param {string} text - Text to search
   * @param {RegExp} pattern - Regex pattern (optional)
   * @returns {string} Price string
   */
  static extractPriceFromText(text, pattern = null) {
    if (pattern) {
      const match = text.match(pattern);
      if (match) {
        console.log('Found price with pattern:', match[1]);
        return match[1];
      }
    }

    // Generic price pattern
    const priceMatch = text.match(/\$[\d,]+\.?\d*/);
    return priceMatch ? priceMatch[0] : null;
  }

  /**
   * Extract tracking information
   * @returns {Object} Tracking info object
   */
  static getTrackingInfo() {
    const bodyText = document.body.innerText;

    return {
      trackingNumber: this.extractTrackingNumber(bodyText),
      carrier: this.extractCarrier(bodyText),
      trackingUrl: null
    };
  }

  /**
   * Extract tracking number from text
   * @param {string} text - Page text
   * @returns {string} Tracking number
   */
  static extractTrackingNumber(text) {
    const patterns = [
      /Tracking[:\s]+([A-Z0-9]{10,})/i,
      /(?:USPS|UPS|FedEx)[:\s]+([A-Z0-9]{10,})/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        console.log('Found tracking number:', match[1]);
        return match[1];
      }
    }

    return null;
  }

  /**
   * Extract carrier from text
   * @param {string} text - Page text
   * @returns {string} Carrier name
   */
  static extractCarrier(text) {
    const carriers = ['USPS', 'UPS', 'FedEx', 'DHL'];

    for (const carrier of carriers) {
      if (text.includes(carrier)) {
        console.log('Found carrier:', carrier);
        return carrier;
      }
    }

    return null;
  }

  /**
   * Extract order status from text
   * @returns {string} Order status
   */
  static getOrderStatus() {
    const bodyText = document.body.innerText;

    const statuses = ['Completed', 'Shipped', 'Processing', 'Pending', 'Delivered', 'Cancelled'];

    for (const status of statuses) {
      if (bodyText.includes(status)) {
        console.log('Found order status:', status);
        return status;
      }
    }

    return 'Unknown';
  }

  /**
   * Extract order data from a fetched document (for bulk scraping)
   * @param {Document} doc - Parsed HTML document
   * @param {string} url - Order URL
   * @returns {Object} Order data object
   */
  static extractOrderDataFromDoc(doc, url) {
    // Similar extraction but from parsed document
    const bodyText = doc.body.innerText;

    return {
      orderId: url.match(/orderid=([^&]+)/i)?.[1] || 'Unknown',
      orderDate: bodyText.match(/([A-Za-z]+\s+\d{1,2},\s+\d{4})/)?.[1] || null,
      buyerInfo: { username: null, email: null },
      shippingAddress: { fullAddress: bodyText.match(/\d{5}(-\d{4})?/)?.[0] || null },
      items: [{ title: 'Order Item', quantity: 1 }],
      financials: {
        totalSale: bodyText.match(/\$[\d,]+\.?\d*/)?.[0],
        yourEarnings: null,
        ebayFees: null,
        shippingCost: null
      },
      tracking: { trackingNumber: null, carrier: null },
      orderStatus: 'Unknown',
      url: url,
      scrapedAt: new Date().toISOString()
    };
  }
}
