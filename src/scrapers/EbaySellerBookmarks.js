/**
 * EbaySellerBookmarks
 * Injects a persistent floating "Sellers" dropdown on all eBay pages.
 * Lets the user save, visit, and manage competitor seller URLs.
 */

export class EbaySellerBookmarks {
  constructor() {
    this.button = null;
    this.panel = null;
    this.sellers = [];
    this.panelOpen = false;
    this._outsideClickHandler = null;
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────

  init() {
    this.loadSellers().then(() => this.injectButton());

    // React to storage changes from other tabs/windows
    chrome.storage.onChanged.addListener((changes, ns) => {
      if (ns === 'local' && changes.savedSellers) {
        this.sellers = changes.savedSellers.newValue || [];
        if (this.panel) this.renderList(this.panel);
      }
    });
  }

  loadSellers() {
    return new Promise(resolve => {
      chrome.storage.local.get(['savedSellers'], result => {
        if (result.savedSellers && result.savedSellers.length > 0) {
          this.sellers = result.savedSellers;
        } else {
          // Seed with default competitor sellers
          this.sellers = [
            { name: 'syimt_76',          url: 'https://www.ebay.com/usr/syimt_76' },
            { name: 'alluneed1',         url: 'https://www.ebay.com/str/alluneed1' },
            { name: 'summitridgesupply', url: 'https://www.ebay.com/str/summitridgesupply' },
          ];
          chrome.storage.local.set({ savedSellers: this.sellers });
        }
        resolve();
      });
    });
  }

  saveSellers() {
    chrome.storage.local.set({ savedSellers: this.sellers });
  }

  // ─── Button ───────────────────────────────────────────────────────────────────

  injectButton() {
    if (document.getElementById('ebay-seller-bookmarks-btn')) return;

    this.button = document.createElement('button');
    this.button.id = 'ebay-seller-bookmarks-btn';
    this.button.textContent = 'Sellers \u25be';
    this.button.style.cssText = [
      'position:fixed', 'top:130px', 'right:20px', 'z-index:10000',
      'padding:9px 16px',
      'background:linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
      'color:white', 'border:none', 'border-radius:8px',
      'font-size:13px', 'font-weight:600', 'cursor:pointer',
      'box-shadow:0 4px 12px rgba(102,126,234,0.4)',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      'letter-spacing:0.2px', 'transition:transform 0.15s,box-shadow 0.15s',
    ].join(';');

    this.button.addEventListener('mouseenter', () => {
      this.button.style.transform = 'scale(1.05)';
      this.button.style.boxShadow = '0 6px 18px rgba(102,126,234,0.6)';
    });
    this.button.addEventListener('mouseleave', () => {
      this.button.style.transform = '';
      this.button.style.boxShadow = '0 4px 12px rgba(102,126,234,0.4)';
    });
    this.button.addEventListener('click', e => {
      e.stopPropagation();
      this.togglePanel();
    });

    document.body.appendChild(this.button);

    // Close panel on outside click
    this._outsideClickHandler = e => {
      if (this.panelOpen && !this.panel?.contains(e.target) && e.target !== this.button) {
        this.closePanel();
      }
    };
    document.addEventListener('click', this._outsideClickHandler, true);
  }

  // ─── Panel toggle ─────────────────────────────────────────────────────────────

  togglePanel() {
    if (this.panelOpen) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  openPanel() {
    if (this.panel) this.panel.remove();
    this.panel = this.buildPanel();
    document.body.appendChild(this.panel);
    this.panelOpen = true;
    this.button.textContent = 'Sellers \u25b4';
    // Focus the name input so user can start typing immediately
    this.panel.querySelector('#bm-name-input')?.focus();
  }

  closePanel() {
    this.panel?.remove();
    this.panel = null;
    this.panelOpen = false;
    this.button.textContent = 'Sellers \u25be';
  }

  // ─── Panel build ──────────────────────────────────────────────────────────────

  buildPanel() {
    // Auto-detect current seller URL to pre-fill
    const currentUrl  = window.location.href;
    const pathname    = window.location.pathname;
    let prefillUrl  = '';
    let prefillName = '';
    if (pathname.startsWith('/str/') || pathname.startsWith('/usr/')) {
      const seg = pathname.startsWith('/str/')
        ? pathname.slice('/str/'.length).split('/')[0]
        : pathname.slice('/usr/'.length).split('/')[0];
      if (seg) {
        prefillUrl  = `${window.location.origin}${pathname.startsWith('/str/') ? '/str/' : '/usr/'}${seg}`;
        prefillName = seg;
      }
    }

    const panel = document.createElement('div');
    panel.id = 'ebay-seller-bookmarks-panel';
    panel.style.cssText = [
      'position:fixed', 'top:168px', 'right:20px', 'z-index:10001',
      'width:308px',
      'background:white', 'border-radius:12px',
      'box-shadow:0 12px 44px rgba(0,0,0,0.22)',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      'overflow:hidden',
    ].join(';');

    panel.innerHTML = `
      <!-- Header -->
      <div style="
        padding:12px 16px 10px;
        background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
        color:white;
      ">
        <div style="font-size:14px;font-weight:700;letter-spacing:0.1px;">Competitor Sellers</div>
        <div id="bm-count" style="font-size:11px;opacity:0.75;margin-top:2px;">
          ${this.sellers.length} saved
        </div>
      </div>

      <!-- Seller list -->
      <div id="bm-list" style="
        max-height:240px; overflow-y:auto;
        border-bottom:1px solid #f0f0f0;
      "></div>

      <!-- Add seller form -->
      <div style="padding:12px 14px 14px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;
                    letter-spacing:0.06em;color:#667eea;margin-bottom:8px;">
          Add Seller
        </div>
        <input id="bm-name-input" type="text" placeholder="Display name"
          value="${this.escapeAttr(prefillName)}"
          style="width:100%;padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;
                 font-size:13px;margin-bottom:6px;box-sizing:border-box;
                 outline:none;color:#111;font-family:inherit;">
        <input id="bm-url-input" type="text"
          placeholder="https://www.ebay.com/usr/username"
          value="${this.escapeAttr(prefillUrl)}"
          style="width:100%;padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;
                 font-size:13px;margin-bottom:8px;box-sizing:border-box;
                 outline:none;color:#111;font-family:inherit;">
        <button id="bm-add-btn" style="
          width:100%;padding:8px;
          background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
          color:white;border:none;border-radius:7px;
          font-size:13px;font-weight:600;cursor:pointer;
          font-family:inherit;
        ">Add to List</button>
        <div id="bm-error" style="font-size:11px;color:#ef4444;margin-top:5px;display:none;"></div>
      </div>
    `;

    // Bind add button
    panel.querySelector('#bm-add-btn').addEventListener('click', () => {
      this.handleAdd(panel);
    });

    // Enter in name → focus URL
    panel.querySelector('#bm-name-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') panel.querySelector('#bm-url-input').focus();
    });
    // Enter in URL → submit
    panel.querySelector('#bm-url-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.handleAdd(panel);
    });

    this.renderList(panel);
    return panel;
  }

  // ─── List render ──────────────────────────────────────────────────────────────

  renderList(panel) {
    const list = panel.querySelector('#bm-list');
    const countEl = panel.querySelector('#bm-count');
    if (countEl) countEl.textContent = `${this.sellers.length} saved`;
    if (!list) return;

    if (this.sellers.length === 0) {
      list.innerHTML = `
        <div style="text-align:center;padding:22px 0;color:#ccc;font-size:13px;">
          No sellers saved yet
        </div>`;
      return;
    }

    list.innerHTML = '';
    this.sellers.forEach((seller, index) => {
      const row = document.createElement('div');
      row.style.cssText = [
        'display:flex', 'align-items:center', 'gap:8px',
        'padding:8px 14px', 'cursor:default',
        'transition:background 0.1s',
      ].join(';');
      row.addEventListener('mouseenter', () => { row.style.background = '#f7f5ff'; });
      row.addEventListener('mouseleave', () => { row.style.background = ''; });

      row.innerHTML = `
        <div style="flex:1;min-width:0;">
          <div style="
            font-size:13px;font-weight:600;color:#1a1a1a;
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
          ">${this.escapeHtml(seller.name)}</div>
          <div style="
            font-size:10px;color:#aaa;
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
            margin-top:1px;
          ">${this.escapeHtml(seller.url)}</div>
        </div>
        <a href="${this.escapeAttr(seller.url)}"
           style="
             flex-shrink:0;padding:4px 11px;
             background:#ede9ff;color:#5b21b6;
             text-decoration:none;border-radius:5px;
             font-size:12px;font-weight:600;white-space:nowrap;
           ">Visit</a>
        <button data-idx="${index}" title="Remove" style="
          flex-shrink:0;width:24px;height:24px;
          background:none;border:1px solid #e5e7eb;
          border-radius:5px;color:#9ca3af;font-size:14px;
          cursor:pointer;display:flex;align-items:center;
          justify-content:center;padding:0;line-height:1;
        ">&times;</button>
      `;

      row.querySelector('button').addEventListener('click', e => {
        e.stopPropagation();
        this.deleteSeller(index, panel);
      });

      list.appendChild(row);
    });
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  handleAdd(panel) {
    const nameEl  = panel.querySelector('#bm-name-input');
    const urlEl   = panel.querySelector('#bm-url-input');
    const errorEl = panel.querySelector('#bm-error');
    errorEl.style.display = 'none';

    const name = nameEl.value.trim();
    let url    = urlEl.value.trim();

    if (!name) {
      errorEl.textContent = 'Please enter a display name.';
      errorEl.style.display = 'block';
      nameEl.focus();
      return;
    }
    if (!url) {
      errorEl.textContent = 'Please enter the seller URL.';
      errorEl.style.display = 'block';
      urlEl.focus();
      return;
    }

    // Auto-prefix: if user typed just a username (no slashes), treat as /usr/
    if (!url.startsWith('http')) {
      url = `https://www.ebay.com/usr/${url}`;
    }

    // Dedup by URL — update name if already saved
    const existing = this.sellers.findIndex(s => s.url === url);
    if (existing >= 0) {
      this.sellers[existing].name = name;
    } else {
      this.sellers.push({ name, url });
    }

    this.saveSellers();
    this.renderList(panel);
    nameEl.value = '';
    urlEl.value  = '';
    nameEl.focus();
  }

  deleteSeller(index, panel) {
    this.sellers.splice(index, 1);
    this.saveSellers();
    this.renderList(panel);
  }

  // ─── Utilities ────────────────────────────────────────────────────────────────

  escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = String(str || '');
    return d.innerHTML;
  }

  escapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  cleanup() {
    this.button?.remove();
    this.panel?.remove();
    if (this._outsideClickHandler) {
      document.removeEventListener('click', this._outsideClickHandler, true);
    }
  }
}
