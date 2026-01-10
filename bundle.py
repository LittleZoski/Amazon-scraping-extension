#!/usr/bin/env python3
"""
Bundle all modular JavaScript files into a single content script
Since Chrome extensions don't support ES6 modules in content scripts yet
"""

import os
import re

# Define the order of modules (dependencies first)
MODULES = [
    # Utils first (no dependencies)
    'src/utils/DOMHelpers.js',
    'src/utils/DataSanitizer.js',
    'src/utils/Validators.js',

    # Storage and UI (no dependencies on other custom modules)
    'src/storage/StorageManager.js',
    'src/ui/UIManager.js',

    # Extractors (depends on utils)
    'src/extractors/DataExtractor.js',

    # Scrapers (depend on extractors, utils, storage, UI)
    'src/scrapers/ProductScraper.js',
    'src/scrapers/BulkScraper.js',

    # Address (depends on utils, UI)
    'src/address/AddressImporter.js',
]

def remove_imports_exports(content):
    """Remove ES6 import/export statements"""
    # Remove import statements
    content = re.sub(r'^import\s+.*?from\s+[\'"].*?[\'"];?\s*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'^import\s+{[^}]*}\s+from\s+[\'"].*?[\'"];?\s*$', '', content, flags=re.MULTILINE)

    # Remove export statements
    content = re.sub(r'^export\s+', '', content, flags=re.MULTILINE)

    return content

def bundle_modules():
    """Bundle all modules into one file"""
    output = []

    # Add header
    output.append('''/**
 * Amazon Scraper Extension - Bundled Refactored Version
 * All modules combined into a single file for Chrome extension compatibility
 *
 * Original structure:
 * - src/utils/        (DOMHelpers, DataSanitizer, Validators)
 * - src/extractors/   (DataExtractor)
 * - src/scrapers/     (ProductScraper, BulkScraper)
 * - src/address/      (AddressImporter)
 * - src/ui/           (UIManager)
 * - src/storage/      (StorageManager)
 */

"use strict";

''')

    # Read and bundle each module
    for module_path in MODULES:
        if not os.path.exists(module_path):
            print(f"Warning: {module_path} not found, skipping...")
            continue

        with open(module_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Remove imports/exports
        content = remove_imports_exports(content)

        # Remove leading/trailing empty lines
        content = content.strip()

        # Add module section
        module_name = os.path.basename(module_path).replace('.js', '')
        output.append(f'\n// ========================================')
        output.append(f'// {module_name.upper()} MODULE')
        output.append(f'// ========================================\n')
        output.append(content)
        output.append('\n')

    # Add main app initialization
    output.append('''
// ========================================
// MAIN APPLICATION
// ========================================

class AmazonScraperApp {
  constructor() {
    this.productScraper = null;
    this.bulkScraper = null;
    this.addressImporter = null;
    this.init();
  }

  async init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initializeFeatures());
    } else {
      this.initializeFeatures();
    }

    UIManager.injectStyles();
  }

  async initializeFeatures() {
    if (DOMHelpers.isProductPage()) {
      this.productScraper = new ProductScraper();
      await this.productScraper.init();
    }
    else if (DOMHelpers.isCategoryPage()) {
      this.bulkScraper = new BulkScraper();
      await this.bulkScraper.init();
    }

    if (DOMHelpers.isAddressPage()) {
      this.addressImporter = new AddressImporter();
      this.addressImporter.init();
    }
  }
}

// Initialize the application
new AmazonScraperApp();
''')

    # Write bundled file
    bundled_content = '\n'.join(output)

    with open('content-refactored.js', 'w', encoding='utf-8') as f:
        f.write(bundled_content)

    print(f"Successfully bundled {len(MODULES)} modules into content-refactored.js")
    print(f"Total size: {len(bundled_content)} characters")

if __name__ == '__main__':
    bundle_modules()
