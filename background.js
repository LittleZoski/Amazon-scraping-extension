/**
 * Background Service Worker for Amazon & Yami Product Scraper
 * Handles tab creation and management for bulk scraping
 */

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SCRAPE_PRODUCT_IN_BACKGROUND_TAB') {
    // Handle scraping a product in a background tab
    scrapeProductInBackgroundTab(message.url)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));

    return true; // Keep message channel open for async response
  }
});

/**
 * Open a product URL in a background tab, scrape it, and return the data
 * @param {string} url - Product URL to scrape
 * @returns {Promise<Object>} Scraped product data
 */
async function scrapeProductInBackgroundTab(url) {
  try {
    // Open product in a new background tab
    const tab = await chrome.tabs.create({
      url: url,
      active: false // Don't switch to the new tab
    });

    // Wait for the tab to fully load
    await waitForTabLoad(tab.id);

    // Send message to the tab's content script to scrape the product
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'SCRAPE_PRODUCT_IN_TAB'
    });

    // Close the tab after scraping
    await chrome.tabs.remove(tab.id);

    return response;

  } catch (error) {
    console.error('Error scraping product in background tab:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Wait for a tab to finish loading
 * @param {number} tabId - Tab ID
 * @returns {Promise<void>}
 */
async function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const checkStatus = () => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          resolve(); // Tab was closed or error occurred
          return;
        }

        if (tab.status === 'complete') {
          // Wait an additional 2 seconds for JavaScript and lazy loading to execute
          setTimeout(resolve, 2000);
        } else {
          // Check again in 100ms
          setTimeout(checkStatus, 100);
        }
      });
    };

    checkStatus();
  });
}
