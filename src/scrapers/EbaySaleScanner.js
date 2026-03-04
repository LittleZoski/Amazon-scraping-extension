/**
 * EbaySaleScanner
 * Scans an eBay seller's active listings and extracts sold count, watching count,
 * and revision history link from each individual item page.
 *
 * Injected on eBay seller store pages: https://www.ebay.com/str/STORENAME
 */

export class EbaySaleScanner {
  constructor() {
    this.sellerId = null;
    this.storeBaseUrl = null; // e.g. https://www.ebay.com/usr/syimt_76
    this.button = null;
    this.overlayModal = null;
    this.scannedItems = []; // Items where soldCount > 0 or watchingCount > 0
    this.isScanning = false;
    this.stopRequested = false;
    this.totalLinks = 0;
    this.processedCount = 0;
  }

  // ─── Init ────────────────────────────────────────────────────────────────────

  init() {
    this.sellerId = this.extractSellerId();
    if (!this.sellerId) {
      console.log('[EbaySaleScanner] Could not detect seller ID from page URL');
      return;
    }
    // Store the canonical base URL for this store so we can paginate it.
    // Strip any category sub-path — pagination always uses the root store URL.
    this.storeBaseUrl = this.computeStoreBaseUrl();
    console.log('[EbaySaleScanner] Seller:', this.sellerId, '| Base URL:', this.storeBaseUrl);
    this.injectButton();
  }

  computeStoreBaseUrl() {
    const { pathname } = window.location;
    if (pathname.startsWith('/str/')) {
      const name = pathname.slice('/str/'.length).split('/')[0].split('?')[0];
      if (name) return `https://www.ebay.com/str/${name}`;
    }
    if (pathname.startsWith('/usr/')) {
      const name = pathname.slice('/usr/'.length).split('/')[0].split('?')[0];
      if (name) return `https://www.ebay.com/usr/${name}`;
    }
    // _ssn search page fallback — will use sch/i.html pagination
    return null;
  }

  extractSellerId() {
    const pathname = window.location.pathname;

    // 1. URL path: /str/STORENAME
    if (pathname.startsWith('/str/')) {
      const segment = pathname.slice('/str/'.length).split('/')[0].split('?')[0];
      if (segment) return segment;
    }

    // 2. URL path: /usr/USERNAME
    if (pathname.startsWith('/usr/')) {
      const segment = pathname.slice('/usr/'.length).split('/')[0].split('?')[0];
      if (segment) return segment;
    }

    // 3. URL query param: ?_ssn=SELLER (seller-filtered search pages)
    const ssn = new URLSearchParams(window.location.search).get('_ssn');
    if (ssn) return ssn;

    // 4. DOM fallback: try seller identity elements eBay renders on store/user pages
    const domSelectors = [
      '.str-seller-card__name a',
      '.str-seller-card__name',
      '.seller-persona a',
      '[data-seller-name]',
      '.mbg-nw a',         // user page username link
      '.mbg-nw',           // user page username element
      '.member-profile a',
      '[data-track*="seller"] a',
    ];
    for (const sel of domSelectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const text = (el.getAttribute('data-seller-name') || el.textContent || '').trim();
      if (text) return text;
    }

    return null;
  }

  // ─── Button ──────────────────────────────────────────────────────────────────

  injectButton() {
    if (document.getElementById('ebay-sale-scanner-btn')) return;

    this.button = document.createElement('button');
    this.button.id = 'ebay-sale-scanner-btn';
    this.button.textContent = 'Sale Scanner';
    this.button.style.cssText = [
      'position:fixed', 'top:80px', 'right:20px', 'z-index:10000',
      'padding:10px 18px',
      'background:linear-gradient(135deg,#d32f2f 0%,#b71c1c 100%)',
      'color:white', 'border:none', 'border-radius:8px',
      'font-size:14px', 'font-weight:600', 'cursor:pointer',
      'box-shadow:0 4px 12px rgba(183,28,28,0.45)',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      'letter-spacing:0.2px', 'transition:transform 0.15s,box-shadow 0.15s',
    ].join(';');

    this.button.addEventListener('mouseenter', () => {
      this.button.style.transform = 'scale(1.05)';
      this.button.style.boxShadow = '0 6px 18px rgba(183,28,28,0.55)';
    });
    this.button.addEventListener('mouseleave', () => {
      this.button.style.transform = '';
      this.button.style.boxShadow = '0 4px 12px rgba(183,28,28,0.45)';
    });
    this.button.addEventListener('click', () => {
      if (!this.isScanning) {
        this.showConfigModal();
      } else if (this.overlayModal) {
        this.overlayModal.style.display = 'flex';
      }
    });

    document.body.appendChild(this.button);
  }

  // ─── Config Modal ────────────────────────────────────────────────────────────

  showConfigModal() {
    const overlay = document.createElement('div');
    overlay.id = 'ebay-scanner-config-overlay';
    overlay.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
      'background:rgba(0,0,0,0.55)', 'z-index:10020',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    ].join(';');

    overlay.innerHTML = `
      <div style="background:white;border-radius:14px;padding:28px;width:420px;
                  box-shadow:0 20px 50px rgba(0,0,0,0.35);">
        <h2 style="margin:0 0 6px;font-size:20px;color:#1a1a1a;">Sale Scanner</h2>
        <p style="margin:0 0 22px;font-size:13px;color:#888;">
          Seller: <strong style="color:#0064d2;">${this.escapeHtml(this.sellerId)}</strong>
        </p>

        <div style="margin-bottom:18px;">
          <label style="display:block;font-size:13px;color:#555;margin-bottom:6px;font-weight:600;">
            Max items to scan
          </label>
          <select id="max-items-select" style="width:100%;padding:8px 12px;
              border:1px solid #d0d0d0;border-radius:8px;font-size:14px;
              color:#222;background:white;">
            <option value="200">200 items (recommended, ~2 min)</option>
            <option value="500">500 items (~5 min)</option>
            <option value="1000">1,000 items (~10 min)</option>
            <option value="9999">All items (may be very slow)</option>
          </select>
        </div>

        <div style="background:#fff8e1;border:1px solid #ffd54f;border-radius:8px;
                    padding:12px;margin-bottom:22px;">
          <p style="margin:0;font-size:12px;color:#795548;line-height:1.5;">
            <strong>Note:</strong> Each item requires a separate page fetch to get sold count
            and watcher data. Only items with at least 1 sale or 1 watcher are shown in results.
          </p>
        </div>

        <div style="display:flex;gap:10px;">
          <button id="start-scan-btn" style="flex:1;padding:11px;
              background:linear-gradient(135deg,#d32f2f 0%,#b71c1c 100%);
              color:white;border:none;border-radius:8px;
              font-size:15px;font-weight:600;cursor:pointer;">
            Start Scan
          </button>
          <button id="cancel-config-btn" style="flex:0 0 auto;padding:11px 18px;
              background:#f0f0f0;color:#555;border:none;border-radius:8px;
              font-size:14px;font-weight:500;cursor:pointer;">
            Cancel
          </button>
        </div>
      </div>
    `;

    const startBtn = overlay.querySelector('#start-scan-btn');
    const cancelBtn = overlay.querySelector('#cancel-config-btn');

    startBtn.addEventListener('click', () => {
      const maxItems = parseInt(overlay.querySelector('#max-items-select').value, 10);
      overlay.remove();
      this.startScan(maxItems);
    });
    cancelBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    document.body.appendChild(overlay);
  }

  // ─── Main Scan Logic ─────────────────────────────────────────────────────────

  async startScan(maxItems = 200) {
    this.isScanning = true;
    this.stopRequested = false;
    this.scannedItems = [];
    this.processedCount = 0;
    this.totalLinks = 0;

    this.button.textContent = 'Scanning...';
    this.button.style.background = 'linear-gradient(135deg,#ef6c00 0%,#e65100 100%)';
    this.button.style.boxShadow = '0 4px 12px rgba(230,81,0,0.45)';

    this.createOverlayModal();

    try {
      // Phase 1: collect listing URLs from the seller's search results pages
      this.setPhaseStatus('Collecting seller listings...');
      const allLinks = await this.collectListingLinks(maxItems);

      if (this.stopRequested) {
        this.endScan();
        return;
      }

      this.totalLinks = allLinks.length;
      this.setPhaseStatus(`Found ${allLinks.length} listings — fetching item details...`);

      // Phase 2: fetch each item page in small concurrent batches
      const BATCH_SIZE = 3;
      for (let i = 0; i < allLinks.length && !this.stopRequested; i += BATCH_SIZE) {
        const batch = allLinks.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(link => this.fetchItemDetails(link))
        );

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            const item = result.value;
            if (item.soldCount > 0 || item.watchingCount > 0) {
              this.scannedItems.push(item);
              this.appendLiveRow(item);
            }
          }
          this.processedCount++;
        }

        this.updateProgressBar(this.processedCount, allLinks.length);
        this.updateScanStats();

        if (i + BATCH_SIZE < allLinks.length && !this.stopRequested) {
          await this.sleep(this.randomDelay(180, 380));
        }
      }
    } catch (err) {
      console.error('[EbaySaleScanner] Scan error:', err);
    }

    this.endScan();
  }

  endScan() {
    this.isScanning = false;
    const found = this.scannedItems.length;
    this.setPhaseStatus(
      this.stopRequested
        ? `Scan stopped. Found ${found} items with sales activity.`
        : `Scan complete. Found ${found} items with sales activity.`
    );
    this.updateProgressBar(this.processedCount, this.totalLinks || 1);

    const stopBtn = this.overlayModal?.querySelector('#scanner-stop-btn');
    if (stopBtn) {
      stopBtn.textContent = 'Close';
      stopBtn.style.background = '#0064d2';
      stopBtn.disabled = false;
      // Replace stop handler with close handler
      const newBtn = stopBtn.cloneNode(true);
      stopBtn.parentNode.replaceChild(newBtn, stopBtn);
      newBtn.addEventListener('click', () => {
        if (this.overlayModal) this.overlayModal.style.display = 'none';
      });
    }

    this.button.textContent = `Sale Scanner (${found} found)`;
    this.button.style.background = 'linear-gradient(135deg,#2e7d32 0%,#1b5e20 100%)';
    this.button.style.boxShadow = '0 4px 12px rgba(27,94,32,0.45)';

    // Persist results and reveal Export button
    if (found > 0) {
      this.persistScannedItems().then(() => {
        this.setPhaseStatus(
          this.stopRequested
            ? `Scan stopped. ${found} items saved to Scanned Items tab.`
            : `Scan complete. ${found} items saved to Scanned Items tab.`
        );
      });
    }

    const exportBtn = this.overlayModal?.querySelector('#scanner-export-btn');
    if (exportBtn && found > 0) {
      exportBtn.style.visibility = 'visible';
      exportBtn.addEventListener('click', () => this.exportScannedResults());
    }
  }

  // ─── Listing Collection ───────────────────────────────────────────────────────

  async collectListingLinks(maxItems) {
    const links = [];
    let page = 1;

    // Store pages (/usr/ and /str/) max out at 72 items per page.
    // If we have no store base URL (e.g. _ssn search page), fall back to sch/i.html.
    const useStorePage = !!this.storeBaseUrl;

    while (links.length < maxItems && !this.stopRequested) {
      let url;
      if (useStorePage) {
        // e.g. https://www.ebay.com/usr/syimt_76?_pgn=2&_ipg=72
        url = `${this.storeBaseUrl}?_pgn=${page}&_ipg=72`;
      } else {
        // _ssn search page fallback (240 items/page)
        url = `https://www.ebay.com/sch/i.html?_ssn=${encodeURIComponent(this.sellerId)}&_ipg=240&_pgn=${page}&_sop=10`;
      }

      try {
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) break;

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const pageItems = this.parseItemLinksFromPage(doc);

        if (pageItems.length === 0) break;

        links.push(...pageItems);
        this.setPhaseStatus(
          `Collecting listings — page ${page} (${links.length} found so far)...`
        );

        // Next page detection:
        // On store pages, the next control is an <a class="pagination__next"> when
        // there are more pages, or a disabled <button> when on the last page.
        // We only continue if we find an actual <a> (anchor) element.
        const nextAnchor = doc.querySelector('a.pagination__next');
        if (!nextAnchor) break;

        page++;
        await this.sleep(this.randomDelay(280, 450));
      } catch (err) {
        console.error(`[EbaySaleScanner] Error fetching listing page ${page}:`, err);
        break;
      }
    }

    return links.slice(0, maxItems);
  }

  // Parses item links from fetched HTML.
  // Handles both store page format (article.str-item-card) and
  // search results format (li.s-item) as fallback.
  parseItemLinksFromPage(doc) {
    const items = [];

    // ── Store page format ──────────────────────────────────────────────────────
    // Real selectors confirmed from live HTML dump:
    //   article.str-item-card  with  data-testid="ig-ITEMID"
    //   a.str-item-card__link  →  href contains /itm/ITEMID
    //   h3.str-card-title .str-text-span  →  title text
    //   .str-item-card__property-displayPrice  →  price
    //   img[data-testid="str-img"]  →  thumbnail
    const storeCards = doc.querySelectorAll('article.str-item-card, article[data-testid^="ig-"]');

    if (storeCards.length > 0) {
      for (const card of storeCards) {
        // Primary: item ID from data-testid="ig-ITEMID"
        const testId = card.getAttribute('data-testid') || '';
        let itemId = testId.startsWith('ig-') ? testId.slice(3) : '';

        // Fallback: parse from the link href
        if (!itemId || !/^\d+$/.test(itemId)) {
          const href = card.querySelector('a[href*="/itm/"]')?.getAttribute('href') || '';
          itemId = href.match(/\/itm\/(\d+)/)?.[1] || '';
        }
        if (!itemId) continue;

        const titleEl = card.querySelector(
          'h3.str-card-title .str-text-span, .str-item-card__property-title .str-text-span'
        );
        const priceEl = card.querySelector(
          '.str-item-card__property-displayPrice, [class*="displayPrice"]'
        );
        const imgEl = card.querySelector('img[data-testid="str-img"], picture img, img');

        items.push({
          itemId,
          url: `https://www.ebay.com/itm/${itemId}`,
          title: titleEl?.textContent?.trim() || '',
          priceText: priceEl?.textContent?.trim() || '',
          image: imgEl?.src || imgEl?.getAttribute('data-src') || '',
        });
      }
      return items;
    }

    // ── Search results fallback (li.s-item) ────────────────────────────────────
    const searchItems = doc.querySelectorAll('li.s-item:not(.s-item--placeholder)');
    for (const li of searchItems) {
      const link = li.querySelector('a.s-item__link');
      if (!link) continue;
      const href = link.getAttribute('href') || '';
      const itemId = href.match(/\/itm\/(\d+)/)?.[1];
      if (!itemId) continue;

      const title = li.querySelector('.s-item__title')?.textContent?.trim() || '';
      if (title === 'Shop on eBay') continue;

      const priceText = li.querySelector('.s-item__price')?.textContent?.trim() || '';
      const imgEl = li.querySelector('img');
      items.push({
        itemId,
        url: `https://www.ebay.com/itm/${itemId}`,
        title,
        priceText,
        image: imgEl?.src || imgEl?.getAttribute('data-src') || '',
      });
    }

    return items;
  }

  // ─── Item Detail Fetching ─────────────────────────────────────────────────────

  async fetchItemDetails(itemData) {
    try {
      const response = await fetch(itemData.url, { credentials: 'include' });
      if (!response.ok) return null;

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      return {
        ...itemData,
        soldCount: this.parseSoldCount(doc),
        watchingCount: this.parseWatchingCount(doc),
        revisionUrl: this.parseRevisionUrl(doc, itemData.itemId),
      };
    } catch (err) {
      console.error(`[EbaySaleScanner] Error fetching item ${itemData.itemId}:`, err);
      return null;
    }
  }

  parseSoldCount(doc) {
    // Try targeted containers first (most reliable)
    const containers = [
      doc.querySelector('#qtySubTxt'),
      doc.querySelector('.x-quantity__availability'),
      doc.querySelector('.d-quantity__availability'),
      doc.querySelector('[class*="quantity__availability"]'),
      doc.querySelector('.x-purchase-section'),
      doc.querySelector('[data-testid*="quantity"]'),
      doc.querySelector('.vi-quantity'),
      doc.querySelector('.qtyAvailThreshold'),
    ];

    for (const el of containers) {
      if (!el) continue;
      const m = el.textContent.match(/(\d[\d,]*)\s*sold/i);
      if (m) return parseInt(m[1].replace(/,/g, ''), 10);
    }

    return 0;
  }

  parseWatchingCount(doc) {
    // Older eBay: #why2buy .w2b-cnt
    const w2b = doc.querySelector('#why2buy .w2b-cnt, .w2b-cnt');
    if (w2b) {
      const m = w2b.textContent.match(/(\d[\d,]*)/);
      if (m) return parseInt(m[1].replace(/,/g, ''), 10);
    }

    // Modern eBay: various watcher containers
    const watchContainers = [
      doc.querySelector('[class*="watch"][class*="count"]'),
      doc.querySelector('[id*="watch"]'),
      doc.querySelector('.x-wishlist, [data-testid*="watch"]'),
      doc.querySelector('#why2buy'),
      doc.querySelector('.vi-w2b'),
    ];

    for (const el of watchContainers) {
      if (!el) continue;
      const m = el.textContent.match(/(\d[\d,]*)\s*(?:people?\s+are?\s+)?watch(?:ing|ers?)\b/i);
      if (m) return parseInt(m[1].replace(/,/g, ''), 10);
    }

    return 0;
  }

  parseRevisionUrl(doc, itemId) {
    // Prefer an explicit link in the DOM
    const links = doc.querySelectorAll('a[href*="/rvh/"]');
    for (const link of links) {
      if (link.href) return link.href;
    }
    // Fallback: construct a plain revision URL
    return `https://www.ebay.com/rvh/${itemId}?rt=nc`;
  }

  // ─── Overlay Modal (progress + live results) ─────────────────────────────────

  createOverlayModal() {
    if (this.overlayModal) this.overlayModal.remove();

    this.overlayModal = document.createElement('div');
    this.overlayModal.id = 'ebay-scanner-overlay';
    this.overlayModal.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
      'background:rgba(0,0,0,0.6)', 'z-index:10015',
      'display:flex', 'align-items:flex-start', 'justify-content:center',
      'padding-top:36px', 'box-sizing:border-box',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
    ].join(';');

    this.overlayModal.innerHTML = `
      <div style="
        background:white; border-radius:14px;
        width:92vw; max-width:1200px;
        height:calc(100vh - 72px); max-height:860px;
        display:flex; flex-direction:column;
        box-shadow:0 20px 60px rgba(0,0,0,0.45); overflow:hidden;
      ">
        <!-- Header -->
        <div style="
          padding:16px 24px; border-bottom:1px solid #e0e0e0;
          display:flex; align-items:center; justify-content:space-between;
          background:#f9f9f9; flex-shrink:0;
        ">
          <div>
            <h2 style="margin:0;font-size:18px;color:#1a1a1a;font-weight:700;">
              Sale Scanner &mdash;
              <span style="color:#0064d2;">${this.escapeHtml(this.sellerId)}</span>
            </h2>
            <div style="display:flex;align-items:center;gap:16px;margin-top:6px;">
              <span id="phase-status" style="font-size:13px;color:#888;">Initializing...</span>
              <span id="scan-stats" style="font-size:13px;color:#444;font-weight:600;"></span>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
          <button id="scanner-export-btn" style="
              padding:8px 18px; background:#2e7d32; color:white;
              border:none; border-radius:8px; font-size:13px;
              font-weight:600; cursor:pointer; white-space:nowrap;
              visibility:hidden;
            ">Export</button>
          <button id="scanner-stop-btn" style="
              padding:8px 18px; background:#d32f2f; color:white;
              border:none; border-radius:8px; font-size:13px;
              font-weight:600; cursor:pointer; white-space:nowrap;
            ">Stop Scan</button>
        </div>
        </div>

        <!-- Progress bar -->
        <div style="height:4px;background:#eee;flex-shrink:0;">
          <div id="scanner-progress-bar" style="
            height:100%; width:0%;
            background:linear-gradient(90deg,#d32f2f,#ef5350);
            transition:width 0.3s;
          "></div>
        </div>

        <!-- Filters -->
        <div style="
          padding:10px 24px; border-bottom:1px solid #efefef;
          display:flex; gap:14px; align-items:center; flex-wrap:wrap;
          background:#fafafa; flex-shrink:0;
        ">
          <span style="font-size:13px;color:#555;font-weight:600;">Filters:</span>

          <div style="display:flex;align-items:center;gap:6px;">
            <label style="font-size:12px;color:#777;white-space:nowrap;">Min Sold:</label>
            <input type="number" id="filter-min-sold" min="0" value="1"
              style="width:58px;padding:4px 8px;border:1px solid #ccc;
                     border-radius:6px;font-size:13px;color:#222;">
          </div>

          <div style="display:flex;align-items:center;gap:6px;">
            <label style="font-size:12px;color:#777;white-space:nowrap;">Min Watching:</label>
            <input type="number" id="filter-min-watching" min="0" value="0"
              style="width:58px;padding:4px 8px;border:1px solid #ccc;
                     border-radius:6px;font-size:13px;color:#222;">
          </div>

          <div style="display:flex;align-items:center;gap:6px;">
            <label style="font-size:12px;color:#777;white-space:nowrap;">Sort:</label>
            <select id="sort-select" style="
              padding:4px 8px;border:1px solid #ccc;border-radius:6px;
              font-size:13px;background:white;color:#222;">
              <option value="sold-desc">Most Sold</option>
              <option value="sold-asc">Least Sold</option>
              <option value="watching-desc">Most Watching</option>
              <option value="watching-asc">Least Watching</option>
            </select>
          </div>

          <button id="apply-filters-btn" style="
            padding:5px 14px; background:#0064d2; color:white;
            border:none; border-radius:6px; font-size:13px;
            font-weight:600; cursor:pointer;
          ">Apply</button>

          <span id="filter-count" style="font-size:12px;color:#aaa;margin-left:auto;"></span>
        </div>

        <!-- Table -->
        <div style="flex:1;overflow-y:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#f5f5f5;position:sticky;top:0;z-index:2;">
                <th style="width:58px;padding:10px 12px;text-align:left;
                    border-bottom:2px solid #e0e0e0;color:#555;font-weight:600;"></th>
                <th style="padding:10px 12px;text-align:left;
                    border-bottom:2px solid #e0e0e0;color:#555;font-weight:600;">Title</th>
                <th style="width:110px;padding:10px 12px;text-align:center;
                    border-bottom:2px solid #e0e0e0;color:#555;font-weight:600;
                    white-space:nowrap;">Price</th>
                <th style="width:82px;padding:10px 12px;text-align:center;
                    border-bottom:2px solid #e0e0e0;color:#555;font-weight:600;">Sold</th>
                <th style="width:96px;padding:10px 12px;text-align:center;
                    border-bottom:2px solid #e0e0e0;color:#555;font-weight:600;">Watching</th>
                <th style="width:110px;padding:10px 12px;text-align:center;
                    border-bottom:2px solid #e0e0e0;color:#555;font-weight:600;">Revisions</th>
              </tr>
            </thead>
            <tbody id="results-tbody">
              <tr id="placeholder-row">
                <td colspan="6" style="
                  text-align:center;padding:70px 0;
                  color:#ccc;font-size:15px;
                ">Scan in progress — results appear here as items are found...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Stop button
    const stopBtn = this.overlayModal.querySelector('#scanner-stop-btn');
    stopBtn.addEventListener('click', () => {
      this.stopRequested = true;
      stopBtn.textContent = 'Stopping...';
      stopBtn.disabled = true;
      stopBtn.style.background = '#9e9e9e';
    });

    // Filter button
    this.overlayModal.querySelector('#apply-filters-btn')
      .addEventListener('click', () => this.applyFiltersAndRender());

    // Enter key on number inputs also applies filters
    ['#filter-min-sold', '#filter-min-watching'].forEach(sel => {
      this.overlayModal.querySelector(sel)
        ?.addEventListener('keydown', e => {
          if (e.key === 'Enter') this.applyFiltersAndRender();
        });
    });

    document.body.appendChild(this.overlayModal);
  }

  // Append one item row live during scanning
  appendLiveRow(item) {
    const tbody = this.overlayModal?.querySelector('#results-tbody');
    if (!tbody) return;

    // Remove placeholder on first result
    tbody.querySelector('#placeholder-row')?.remove();

    // Check against current filter values before appending
    const minSold = parseInt(
      this.overlayModal.querySelector('#filter-min-sold')?.value || '1', 10
    );
    const minWatch = parseInt(
      this.overlayModal.querySelector('#filter-min-watching')?.value || '0', 10
    );
    if (item.soldCount < minSold || item.watchingCount < minWatch) return;

    const tr = this.buildTableRow(item);
    tbody.appendChild(tr);

    const countEl = this.overlayModal.querySelector('#filter-count');
    if (countEl) countEl.textContent = `${tbody.children.length} items shown`;
  }

  // Re-render the whole table from scannedItems using current filter state
  applyFiltersAndRender() {
    const tbody = this.overlayModal?.querySelector('#results-tbody');
    if (!tbody) return;

    const minSold = parseInt(
      this.overlayModal.querySelector('#filter-min-sold')?.value || '1', 10
    );
    const minWatch = parseInt(
      this.overlayModal.querySelector('#filter-min-watching')?.value || '0', 10
    );
    const sortVal = this.overlayModal.querySelector('#sort-select')?.value || 'sold-desc';

    let filtered = this.scannedItems.filter(
      item => item.soldCount >= minSold && item.watchingCount >= minWatch
    );

    switch (sortVal) {
      case 'sold-desc':     filtered.sort((a, b) => b.soldCount - a.soldCount); break;
      case 'sold-asc':      filtered.sort((a, b) => a.soldCount - b.soldCount); break;
      case 'watching-desc': filtered.sort((a, b) => b.watchingCount - a.watchingCount); break;
      case 'watching-asc':  filtered.sort((a, b) => a.watchingCount - b.watchingCount); break;
    }

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="6" style="
          text-align:center;padding:70px 0;color:#ccc;font-size:15px;
        ">No items match the current filters.</td></tr>
      `;
    } else {
      for (const item of filtered) {
        tbody.appendChild(this.buildTableRow(item));
      }
    }

    const countEl = this.overlayModal.querySelector('#filter-count');
    if (countEl) {
      countEl.textContent = `Showing ${filtered.length} of ${this.scannedItems.length}`;
    }
  }

  buildTableRow(item) {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #f0f0f0';
    tr.addEventListener('mouseenter', () => { tr.style.background = '#f5f8ff'; });
    tr.addEventListener('mouseleave', () => { tr.style.background = ''; });

    const imgHtml = item.image
      ? `<img src="${this.escapeHtml(item.image)}"
              style="width:50px;height:50px;object-fit:contain;
                     border-radius:4px;border:1px solid #eee;"
              loading="lazy">`
      : `<div style="width:50px;height:50px;background:#f5f5f5;border-radius:4px;"></div>`;

    const titleEsc = this.escapeHtml(item.title || '');
    const priceEsc = this.escapeHtml(item.priceText || '—');
    const urlEsc   = this.escapeHtml(item.url);
    const revEsc   = this.escapeHtml(item.revisionUrl);

    const soldBadge = `
      <span style="
        display:inline-block;padding:2px 10px;border-radius:12px;
        font-weight:700;font-size:13px;
        background:${item.soldCount > 0 ? '#e8f5e9' : '#f5f5f5'};
        color:${item.soldCount > 0 ? '#2e7d32' : '#aaa'};
      ">${item.soldCount}</span>`;

    const watchBadge = `
      <span style="
        display:inline-block;padding:2px 10px;border-radius:12px;
        font-weight:700;font-size:13px;
        background:${item.watchingCount > 0 ? '#e3f2fd' : '#f5f5f5'};
        color:${item.watchingCount > 0 ? '#1565c0' : '#aaa'};
      ">${item.watchingCount}</span>`;

    tr.innerHTML = `
      <td style="padding:8px 12px;">${imgHtml}</td>
      <td style="padding:8px 12px;max-width:0;">
        <a href="${urlEsc}" target="_blank" rel="noopener"
           style="color:#0064d2;text-decoration:none;font-weight:500;
                  display:block;overflow:hidden;text-overflow:ellipsis;
                  white-space:nowrap;"
           title="${titleEsc}">${titleEsc}</a>
        <span style="font-size:11px;color:#ccc;">#${item.itemId}</span>
      </td>
      <td style="padding:8px 12px;text-align:center;font-weight:600;
                 color:#222;white-space:nowrap;">${priceEsc}</td>
      <td style="padding:8px 12px;text-align:center;">${soldBadge}</td>
      <td style="padding:8px 12px;text-align:center;">${watchBadge}</td>
      <td style="padding:8px 12px;text-align:center;">
        <a href="${revEsc}" target="_blank" rel="noopener"
           style="color:#666;font-size:12px;padding:4px 10px;
                  background:#f0f0f0;border-radius:5px;
                  text-decoration:none;white-space:nowrap;
                  display:inline-block;">
          View History
        </a>
      </td>
    `;

    return tr;
  }

  // ─── Progress helpers ─────────────────────────────────────────────────────────

  setPhaseStatus(text) {
    const el = this.overlayModal?.querySelector('#phase-status');
    if (el) el.textContent = text;
  }

  updateScanStats() {
    const el = this.overlayModal?.querySelector('#scan-stats');
    if (el) {
      el.textContent =
        `${this.processedCount}/${this.totalLinks} scanned` +
        ` · ${this.scannedItems.length} with activity`;
    }
  }

  updateProgressBar(current, total) {
    const bar = this.overlayModal?.querySelector('#scanner-progress-bar');
    if (bar && total > 0) {
      bar.style.width = `${Math.min(100, Math.round((current / total) * 100))}%`;
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────────────────

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str || '');
    return div.innerHTML;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ─── Persistence ──────────────────────────────────────────────────────────────

  persistScannedItems() {
    const now = new Date().toISOString();
    const enriched = this.scannedItems.map(item => ({
      ...item,
      seller: this.sellerId,
      scannedAt: now,
    }));

    return new Promise(resolve => {
      chrome.storage.local.get(['scannedItems'], (result) => {
        const existing = result.scannedItems || [];
        // Merge: newer scan data replaces older data for the same item
        const byId = new Map(existing.map(i => [i.itemId, i]));
        for (const item of enriched) {
          byId.set(item.itemId, item);
        }
        const merged = Array.from(byId.values());
        chrome.storage.local.set({ scannedItems: merged }, resolve);
      });
    });
  }

  exportScannedResults() {
    if (this.scannedItems.length === 0) return;

    const exportData = {
      exportedAt: new Date().toISOString(),
      seller: this.sellerId,
      totalItems: this.scannedItems.length,
      items: this.scannedItems,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const blobUrl = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `ebay-scan-${this.sellerId}-${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }

  // Called by ebay-content.js on page navigation cleanup
  cleanup() {
    this.stopRequested = true;
    this.isScanning = false;
    this.button?.remove();
    this.overlayModal?.remove();
  }
}
