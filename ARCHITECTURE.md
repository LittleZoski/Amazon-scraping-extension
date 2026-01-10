# Architecture Overview

## 📐 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                      AMAZON SCRAPER EXTENSION                        │
│                         (content.js)                                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       AmazonScraperApp                               │
│                    (Main Orchestrator)                               │
│                                                                       │
│  • Detects page type                                                 │
│  • Initializes appropriate modules                                   │
│  • Coordinates feature activation                                    │
└─────────────────────────────────────────────────────────────────────┘
       │                    │                      │
       ▼                    ▼                      ▼
┌─────────────┐    ┌─────────────┐      ┌──────────────────┐
│  Product    │    │    Bulk     │      │     Address      │
│  Scraper    │    │   Scraper   │      │    Importer      │
└─────────────┘    └─────────────┘      └──────────────────┘
       │                    │                      │
       └────────────────────┴──────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Data     │    │     UI      │    │   Storage   │
│  Extractor  │    │   Manager   │    │   Manager   │
└─────────────┘    └─────────────┘    └─────────────┘
        │                   │                   │
        └───────────────────┴───────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
┌─────────────────┐                  ┌──────────────────┐
│  Utilities      │                  │   Validators     │
│  - DOMHelpers   │                  │  - Product Val.  │
│  - Sanitizer    │                  │  - Delivery Val. │
└─────────────────┘                  └──────────────────┘
```

## 🔄 Data Flow Diagrams

### Single Product Scraping Flow

```
User visits Amazon Product Page
           │
           ▼
┌────────────────────────────┐
│ AmazonScraperApp.init()    │
│ Detects: Product Page      │
└────────────────────────────┘
           │
           ▼
┌────────────────────────────┐
│ ProductScraper.init()      │
│ Injects scrape button      │
└────────────────────────────┘
           │
           ▼ (user clicks)
┌────────────────────────────┐
│ DataExtractor              │
│ Extracts product data      │
│ from current page          │
└────────────────────────────┘
           │
           ▼
┌────────────────────────────┐
│ Validators                 │
│ Checks price, Prime, etc.  │
└────────────────────────────┘
           │
           ▼ (if valid)
┌────────────────────────────┐
│ DataSanitizer              │
│ Removes Amazon branding    │
└────────────────────────────┘
           │
           ▼
┌────────────────────────────┐
│ StorageManager             │
│ Saves to Chrome storage    │
└────────────────────────────┘
           │
           ▼
┌────────────────────────────┐
│ UIManager                  │
│ Shows success notification │
└────────────────────────────┘
```

### Bulk Scraping Flow

```
User visits Category/Listing Page
           │
           ▼
┌────────────────────────────┐
│ AmazonScraperApp.init()    │
│ Detects: Category Page     │
└────────────────────────────┘
           │
           ▼
┌────────────────────────────┐
│ BulkScraper.init()         │
│ Injects bulk scrape button │
└────────────────────────────┘
           │
           ▼ (user clicks)
┌────────────────────────────┐
│ UIManager                  │
│ Shows settings modal       │
│ (filters, count, etc.)     │
└────────────────────────────┘
           │
           ▼ (user starts)
┌────────────────────────────┐
│ DataExtractor              │
│ Extracts product links     │
│ from listing page          │
└────────────────────────────┘
           │
           ▼
┌────────────────────────────┐
│ Apply Filters              │
│ - Price range              │
│ - Prime only               │
│ - Max count                │
└────────────────────────────┘
           │
           ▼
┌────────────────────────────┐
│ Parallel Batch Processing  │
│ Fetch 3 products at a time │
└────────────────────────────┘
           │
           ▼
┌────────────────────────────┐
│ For each product:          │
│ 1. Fetch HTML              │
│ 2. Parse with DOMParser    │
│ 3. Extract data            │
│ 4. Validate                │
│ 5. Sanitize                │
│ 6. Save                    │
└────────────────────────────┘
           │
           ▼
┌────────────────────────────┐
│ UIManager                  │
│ Update progress indicator  │
│ in real-time               │
└────────────────────────────┘
```

### Address Import Flow

```
User visits Amazon Addresses Page
           │
           ▼
┌────────────────────────────┐
│ AmazonScraperApp.init()    │
│ Detects: Address Page      │
└────────────────────────────┘
           │
           ▼
┌────────────────────────────┐
│ AddressImporter.init()     │
│ Injects import button      │
└────────────────────────────┘
           │
           ▼ (user clicks)
┌────────────────────────────┐
│ UIManager                  │
│ Shows file upload modal    │
└────────────────────────────┘
           │
           ▼ (user uploads JSON)
┌────────────────────────────┐
│ AddressImporter            │
│ Parses eBay orders JSON    │
│ Extracts unique addresses  │
└────────────────────────────┘
           │
           ▼
┌────────────────────────────┐
│ Store in sessionStorage    │
│ - All addresses            │
│ - Current index            │
└────────────────────────────┘
           │
           ▼
┌────────────────────────────┐
│ Navigate to                │
│ "Add Address" page         │
└────────────────────────────┘
           │
           ▼
┌────────────────────────────┐
│ Auto-fill form fields:     │
│ - Name                     │
│ - Address lines            │
│ - City, State, ZIP         │
│ - Phone (formatted)        │
└────────────────────────────┘
           │
           ▼
┌────────────────────────────┐
│ Auto-submit form           │
│ (after 1.5s delay)         │
└────────────────────────────┘
           │
           ▼
┌────────────────────────────┐
│ Amazon processes & saves   │
│ Redirects to success page  │
└────────────────────────────┘
           │
           ▼
┌────────────────────────────┐
│ Detect success             │
│ Increment index            │
│ Load next address          │
└────────────────────────────┘
           │
           ▼
    (Repeat until all done)
```

## 🏗️ Module Dependencies

```
AmazonScraperApp
    │
    ├─► ProductScraper
    │       ├─► DataExtractor
    │       ├─► DataSanitizer
    │       ├─► Validators
    │       ├─► StorageManager
    │       └─► UIManager
    │
    ├─► BulkScraper
    │       ├─► DataExtractor
    │       ├─► DataSanitizer
    │       ├─► Validators
    │       ├─► DOMHelpers
    │       ├─► StorageManager
    │       └─► UIManager
    │
    └─► AddressImporter
            ├─► DOMHelpers
            └─► UIManager

Dependencies (no dependencies on other modules):
    • DOMHelpers
    • DataSanitizer
    • Validators
    • StorageManager
    • UIManager
    • DataExtractor (depends only on DOMHelpers)
```

## 📦 Module Interfaces

### DOMHelpers
```javascript
Static Methods:
  • sleep(ms)                      → Promise
  • isProductPage()                → boolean
  • isCategoryPage()               → boolean
  • isAddressPage()                → boolean
  • getVisibleProductCount()       → number
  • extractASIN()                  → string
  • parsePrice(priceText)          → number
  • formatPhoneNumber(phone)       → string
```

### DataExtractor
```javascript
Static Methods:
  // Current page extraction
  • extractProductData()           → ProductData
  • getTitle()                     → string
  • getPrice()                     → string
  • getImages()                    → string[]
  • getDescription()               → string
  • getBulletPoints()              → string[]
  • getSpecifications()            → object
  • isPrimeEligible()              → boolean

  // Document extraction (for fetched pages)
  • extractTitleFromDoc(doc)       → string
  • extractPriceFromDoc(doc)       → string
  • extractImagesFromDoc(doc)      → string[]
  • extractProductLinksFromPage()  → ProductLink[]
```

### ProductScraper
```javascript
Instance Methods:
  • init()                         → void
  • injectScrapeButton()           → void
  • scrapeProduct()                → Promise<void>
```

### BulkScraper
```javascript
Instance Methods:
  • init()                         → void
  • injectBulkScrapeButton()       → void
  • showBulkScrapeSettings()       → void
  • createSettingsModal(products)  → HTMLElement
  • bulkScrapeFromPage(...)        → Promise<void>
  • scrapeProductFromLink(link)    → Promise<ProductData>
```

### AddressImporter
```javascript
Instance Methods:
  • init()                         → void
  • injectAddressImportButton()    → void
  • showAddressImportModal()       → void
  • extractAddressesFromOrders()   → Address[]
  • startAddressImport(orders)     → void
  • fillAddressForm(address)       → void
  • submitAddressAndNext()         → void
```

### UIManager
```javascript
Static Methods:
  • showNotification(msg, type)    → void
  • createProgressIndicator(total) → HTMLElement
  • updateProgressIndicator(...)   → void
  • injectStyles()                 → void
```

### StorageManager
```javascript
Static Methods:
  • saveProduct(productData)       → Promise<void>
  • saveToLocalStorage(data)       → void
  • getPrimeOnlyMode()             → Promise<boolean>
  • setPrimeOnlyMode(value)        → Promise<void>
```

## 🎯 Design Patterns Used

### 1. **Module Pattern**
Each file is a self-contained module with clear exports

### 2. **Singleton Pattern**
Static utility classes (DOMHelpers, UIManager, etc.)

### 3. **Strategy Pattern**
Different scrapers for different page types

### 4. **Observer Pattern**
Event listeners for user interactions

### 5. **Factory Pattern**
Creating UI elements (modals, progress bars)

### 6. **Facade Pattern**
StorageManager hides complexity of Chrome storage + localStorage

## 🔐 Separation of Concerns

```
┌─────────────────────────────────────────────────┐
│                  PRESENTATION LAYER              │
│              (UI Components)                     │
│                                                  │
│  • UIManager                                     │
│  • Button injection                              │
│  • Modals                                        │
│  • Notifications                                 │
│  • Progress indicators                           │
└─────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│               BUSINESS LOGIC LAYER               │
│          (Scrapers & Validators)                 │
│                                                  │
│  • ProductScraper                                │
│  • BulkScraper                                   │
│  • AddressImporter                               │
│  • Validators                                    │
│  • DataSanitizer                                 │
└─────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│                   DATA LAYER                     │
│           (Extraction & Storage)                 │
│                                                  │
│  • DataExtractor                                 │
│  • StorageManager                                │
└─────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│                UTILITY LAYER                     │
│              (Helpers)                           │
│                                                  │
│  • DOMHelpers                                    │
└─────────────────────────────────────────────────┘
```

## 📈 Scalability

### Adding a New Feature: Review Scraper

```
1. Create new file:
   src/scrapers/ReviewScraper.js

2. Add extraction methods:
   DataExtractor.extractReviews()

3. Update main app:
   if (needsReviewScraper) {
     this.reviewScraper = new ReviewScraper();
   }

4. Reuse existing:
   - UIManager for UI
   - StorageManager for saving
   - Validators for validation
```

No need to touch other modules!

---

This architecture ensures:
✅ Clear responsibilities
✅ Loose coupling
✅ High cohesion
✅ Easy testing
✅ Simple maintenance
✅ Straightforward scaling
