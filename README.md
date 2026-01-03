# Amazon to eBay Product Scraper Extension

A browser extension for scraping Amazon product information to facilitate dropshipping arbitrage business on eBay.

## Features

- **One-Click Scraping**: Click the floating "Scrape for eBay" button on any Amazon product page
- **Bulk Scraping**: Scrape multiple products at once from category pages, bestsellers, and new releases
- **Visual Progress Indicator**: Beautiful real-time progress UI showing success/fail counts and completion percentage
- **Deep Scraping**: Fetches full product details including bulletPoints, specifications, and descriptions
- **Automatic Data Sanitization**: Removes all Amazon branding, URLs, and references from product descriptions
  - Keeps image URLs intact for eBay listing
  - Cleans title, description, bullet points, and specifications
  - Removes "Amazon", "Prime", "FBA", and Amazon-specific terms
- **Comprehensive Data Extraction**: Captures:
  - Product title (sanitized)
  - Price
  - Multiple product images (up to 10)
  - Description (sanitized)
  - Bullet points (sanitized)
  - Specifications (sanitized)
  - ASIN
  - Product URL
  - Rating (from category pages)
- **Smart Page Detection**: Automatically detects product pages vs category pages
- **Local Storage**: All scraped products are saved locally in the browser
- **Product Management**: View, manage, and delete scraped products via the extension popup
- **Export Functionality**: Export all scraped products as JSON for batch processing with eBay API
- **Auto-Clear**: Automatically clears scraped products after export to keep things organized
- **Multi-Region Support**: Works on Amazon.com, Amazon.co.uk, and Amazon.ca

## Installation

1. Open Chrome/Edge browser
2. Navigate to `chrome://extensions/` (or `edge://extensions/`)
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the `amazon-scraper-extension` folder

## Usage

### Scraping Individual Products

1. Navigate to any Amazon product page
2. Look for the floating "📦 Scrape for eBay" button on the right side
3. Click the button to scrape the product
4. Wait for the success notification

### Bulk Scraping from Category Pages

1. Navigate to any Amazon category page:
   - Search results (e.g., search for "wireless headphones")
   - Best Sellers (e.g., `/gp/bestsellers`)
   - New Releases (e.g., `/gp/new-releases`)
   - Movers & Shakers
   - Most Wished For
2. The button will automatically change to "📦 Scrape X Items" (showing item count)
3. Click to scrape all visible products on the page
4. Watch the progress: "⏳ Scraping 5/24..."
5. Get notification when complete

**Pro Tip**: Scroll down on category pages to load more products before scraping!

### Managing Scraped Products

1. Click the extension icon in your browser toolbar
2. View all scraped products with thumbnails and prices
3. Click "View Details" to open the original Amazon page
4. Click "Delete" to remove a product from your collection
5. Click "Export All" to download all products as JSON
   - Products are automatically cleared after export
6. Click "Clear All" to manually remove all scraped products

### Exported Data Format

Exported JSON structure:
```json
{
  "exportedAt": "2025-12-26T12:00:00.000Z",
  "totalProducts": 5,
  "products": [
    {
      "asin": "B08N5WRWNW",
      "title": "Product Title",
      "price": "$29.99",
      "images": ["url1", "url2", ...],
      "description": "Product description",
      "bulletPoints": ["Feature 1", "Feature 2", ...],
      "specifications": {"Brand": "...", "Model": "..."},
      "url": "https://www.amazon.com/...",
      "scrapedAt": "2025-12-26T12:00:00.000Z"
    }
  ]
}
```

## Next Steps

### Part 2: eBay Listing Application

The exported JSON files can be used by a separate application that:
1. Monitors a directory for exported JSON files
2. Reads product data
3. Uses eBay Developer API to create listings in batch
4. Maps Amazon product data to eBay listing format

## Development

### File Structure

```
amazon-scraper-extension/
├── manifest.json       # Extension configuration
├── content.js         # Content script (injected into Amazon pages)
├── popup.html         # Extension popup UI
├── popup.js           # Popup functionality
├── icon16.png         # Extension icon (16x16) - TODO
├── icon48.png         # Extension icon (48x48) - TODO
├── icon128.png        # Extension icon (128x128) - TODO
└── README.md          # This file
```

### Required Icons

You need to create three icon files (or use placeholder images):
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

You can create these using any image editor or online icon generator.

## Limitations

- Amazon's page structure may change, requiring updates to selectors
- Some product variations may not be captured
- Image URLs may be time-limited CDN links
- Chrome storage has quota limits (check if storing many products)

## Future Enhancements

- Add product category detection
- Support for Amazon product variations
- Duplicate detection improvements
- Image downloading and local storage
- Profit calculator (Amazon price vs eBay fees)
- Auto-refresh for price updates
- Filter and search in popup
- CSV export option

## Legal Notice

This tool is for personal use only. Ensure you comply with:
- Amazon's Terms of Service
- eBay's Terms of Service
- Dropshipping policies of both platforms
- Copyright and trademark laws
- Product resale restrictions

Use responsibly and ethically.
