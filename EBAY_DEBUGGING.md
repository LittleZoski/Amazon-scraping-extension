# eBay Order Scraper - Debugging Guide

## Quick Debugging Checklist

### 1. Reload the Extension
After making changes to the code:
1. Go to `chrome://extensions/`
2. Find "Amazon Product Scraper" extension
3. Click the **Reload** button (circular arrow icon)
4. Refresh the eBay page you're testing on

### 2. Check Browser Console
Open the browser console on the eBay page (F12 or Right-click → Inspect → Console tab) and look for:

**Expected logs if working:**
```
=== eBay Content Script Loaded ===
Script URL: chrome-extension://...
EbayOrderScraperApp instance created successfully
eBay Order Scraper initializing...
Current URL: https://www.ebay.com/...
Detecting page type for URL: ...
Detected eBay page type: order-details (or seller-hub)
OrderScraper initialized for order details page
Scrape button injected successfully
```

**If you see errors:**
- `Failed to load module script` → Module import issue
- `Cannot find module` → Path issue in imports
- No logs at all → Script not loading

### 3. Test URLs

**Order Details Page (Single Order):**
- Should show: **"Scrape Order for Export"** button
- Test URL pattern: `https://www.ebay.com/mesh/ord/details?...orderid=...`
- Test URL pattern: `https://www.ebay.com/sh/ord/details?...orderid=...`

**Seller Hub Orders List:**
- Should show: **"Scrape Multiple Orders"** button
- Test URL: `https://www.ebay.com/sh/ord`

### 4. Check Extension Permissions
In `chrome://extensions/` → Click "Details" on your extension:
- Verify "Site access" includes `ebay.com`
- Check "Permissions" shows storage, downloads, activeTab

### 5. Common Issues

**Issue: No button appears**
- Check console for errors
- Verify page type detection logs show correct type
- Manually test in console: `window.ebayScraperApp`

**Issue: Module import errors**
- Manifest must have `"type": "module"` for ebay-content.js
- All import paths must end with `.js`
- Files must exist at the specified paths

**Issue: Button appears but doesn't work**
- Check console for errors when clicking
- Verify Chrome storage permissions

### 6. Manual Testing in Console

Open console on eBay order page and run:
```javascript
// Check if script loaded
window.ebayScraperApp

// Check page detection
window.ebayScraperApp.detectPageType()

// Manually trigger initialization
window.ebayScraperApp.initializeScraper()
```

### 7. Extension Structure Check

Verify these files exist:
```
amazon-scraper-extension/
├── manifest.json
├── ebay-content.js
├── src/
│   ├── scrapers/
│   │   ├── OrderScraper.js
│   │   └── BulkOrderScraper.js
│   ├── extractors/
│   │   └── OrderDataExtractor.js
│   ├── utils/
│   │   ├── OrderValidators.js
│   │   └── OrderDataSanitizer.js
│   ├── storage/
│   │   └── OrderStorageManager.js
│   └── ui/
│       └── UIManager.js
```

### 8. Test Scraping Flow

1. Navigate to an eBay order details page
2. Open console (F12)
3. Look for "Scrape Order for Export" button (bottom-right)
4. Click the button
5. Check console for extraction logs
6. Open extension popup → Orders tab
7. Verify order appears in list

---

## Quick Fix Commands

If you make changes, run these in order:
1. Save all files
2. Go to `chrome://extensions/`
3. Click Reload on extension
4. Hard refresh eBay page (Ctrl+Shift+R or Cmd+Shift+R)
5. Check console for logs
