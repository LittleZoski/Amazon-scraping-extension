let allItems = [];

// ── Load data ─────────────────────────────────────────────────────────────────
chrome.storage.local.get(['scannedItems'], (result) => {
  allItems = result.scannedItems || [];
  buildSellerFilter();
  applyAndRender();
  document.getElementById('headerSubtitle').textContent =
    `${allItems.length} items from ${new Set(allItems.map(i => i.seller).filter(Boolean)).size} sellers`;
});

chrome.storage.onChanged.addListener((changes, ns) => {
  if (ns === 'local' && changes.scannedItems) {
    allItems = changes.scannedItems.newValue || [];
    buildSellerFilter();
    applyAndRender();
  }
});

// ── Seller filter dropdown ─────────────────────────────────────────────────────
function buildSellerFilter() {
  const sel = document.getElementById('sellerFilter');
  const current = sel.value;
  sel.innerHTML = '<option value="">All Sellers</option>';
  const sellers = [...new Set(allItems.map(i => i.seller).filter(Boolean))].sort();
  for (const s of sellers) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    if (s === current) opt.selected = true;
    sel.appendChild(opt);
  }
}

// ── Filter + Sort + Render ────────────────────────────────────────────────────
function applyAndRender() {
  const seller   = document.getElementById('sellerFilter').value;
  const minSold  = parseInt(document.getElementById('minSold').value || '0', 10);
  const minWatch = parseInt(document.getElementById('minWatching').value || '0', 10);
  const sort     = document.getElementById('sortSelect').value;

  let filtered = allItems.filter(item =>
    item.soldCount >= minSold &&
    item.watchingCount >= minWatch &&
    (!seller || item.seller === seller)
  );

  filtered.sort((a, b) => {
    switch (sort) {
      case 'sold-desc':     return b.soldCount - a.soldCount;
      case 'sold-asc':      return a.soldCount - b.soldCount;
      case 'watching-desc': return b.watchingCount - a.watchingCount;
      case 'watching-asc':  return a.watchingCount - b.watchingCount;
      case 'date-desc':     return (b.scannedAt || '').localeCompare(a.scannedAt || '');
      case 'date-asc':      return (a.scannedAt || '').localeCompare(b.scannedAt || '');
      case 'price-asc':     return parsePrice(a.priceText) - parsePrice(b.priceText);
      case 'price-desc':    return parsePrice(b.priceText) - parsePrice(a.priceText);
      default:              return 0;
    }
  });

  renderTable(filtered);

  document.getElementById('countDisplay').textContent =
    `Showing ${filtered.length} of ${allItems.length}`;
  document.getElementById('headerSubtitle').textContent =
    `${allItems.length} items from ${new Set(allItems.map(i => i.seller).filter(Boolean)).size} sellers`;
}

function parsePrice(text) {
  const m = String(text || '').match(/[\d,.]+/);
  return m ? parseFloat(m[0].replace(/,/g, '')) : 0;
}

function renderTable(items) {
  const tbody = document.getElementById('resultsBody');
  tbody.innerHTML = '';

  if (items.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="10" class="empty-state">No items match the current filters.</td>';
    tbody.appendChild(tr);
    return;
  }

  for (const item of items) {
    tbody.appendChild(buildRow(item));
  }
}

function buildRow(item) {
  const tr = document.createElement('tr');

  const thumb = item.image
    ? `<img class="thumb" src="${esc(item.image)}" loading="lazy">`
    : `<div class="thumb-placeholder"></div>`;

  const soldClass  = item.soldCount  > 0 ? 'badge-sold'  : 'badge-zero';
  const watchClass = item.watchingCount > 0 ? 'badge-watch' : 'badge-zero';

  const scannedDate = item.scannedAt
    ? new Date(item.scannedAt).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })
    : '—';

  tr.innerHTML = `
    <td>${thumb}</td>
    <td>
      <a class="item-title" href="${esc(item.url)}" target="_blank" rel="noopener"
         title="${esc(item.title || '')}">${esc(item.title || '—')}</a>
      <div class="item-id">#${esc(item.itemId)}</div>
    </td>
    <td><span class="seller-tag">${esc(item.seller || '—')}</span></td>
    <td style="font-weight:600;color:#222;">${esc(item.priceText || '—')}</td>
    <td style="text-align:center;"><span class="badge ${soldClass}">${item.soldCount}</span></td>
    <td style="text-align:center;"><span class="badge ${watchClass}">${item.watchingCount}</span></td>
    <td class="date-cell" style="text-align:center;">${scannedDate}</td>
    <td style="text-align:center;">
      <a class="link-btn" href="${esc(item.revisionUrl)}" target="_blank" rel="noopener">History</a>
    </td>
    <td style="text-align:center;">
      <a class="link-btn" href="https://www.amazon.com/s?k=${encodeURIComponent((item.title || '').slice(0, 120))}"
         target="_blank" rel="noopener"
         style="background:#fff3e0;color:#e65100;font-weight:700;">Find on Amazon</a>
    </td>
    <td style="text-align:center;">
      <button class="del-btn" data-id="${esc(item.itemId)}">Del</button>
    </td>
  `;

  tr.querySelector('.del-btn').addEventListener('click', () => deleteItem(item.itemId));
  return tr;
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str || '');
  return d.innerHTML;
}

// ── Delete ────────────────────────────────────────────────────────────────────
function deleteItem(itemId) {
  if (!confirm('Remove this item from the scanned list?')) return;
  allItems = allItems.filter(i => i.itemId !== itemId);
  chrome.storage.local.set({ scannedItems: allItems }, () => {
    buildSellerFilter();
    applyAndRender();
  });
}

document.getElementById('clearAllBtn').addEventListener('click', () => {
  if (allItems.length === 0) return;
  if (!confirm(`Clear all ${allItems.length} scanned items? This cannot be undone.`)) return;
  allItems = [];
  chrome.storage.local.set({ scannedItems: [] }, () => {
    buildSellerFilter();
    applyAndRender();
  });
});

// ── Apply filters ─────────────────────────────────────────────────────────────
document.getElementById('applyFiltersBtn').addEventListener('click', applyAndRender);
['minSold', 'minWatching'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') applyAndRender();
  });
});
document.getElementById('sellerFilter').addEventListener('change', applyAndRender);
document.getElementById('sortSelect').addEventListener('change', applyAndRender);

// ── Export JSON ───────────────────────────────────────────────────────────────
document.getElementById('exportJsonBtn').addEventListener('click', () => {
  if (allItems.length === 0) { alert('Nothing to export'); return; }

  const data = {
    exportedAt: new Date().toISOString(),
    totalItems: allItems.length,
    items: allItems,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  chrome.downloads.download({ url, filename: `ebay-scanned-items-${ts}.json`, saveAs: true }, () => {
    URL.revokeObjectURL(url);
  });
});

// ── Export CSV ────────────────────────────────────────────────────────────────
document.getElementById('exportCsvBtn').addEventListener('click', () => {
  if (allItems.length === 0) { alert('Nothing to export'); return; }

  const headers = ['Item ID', 'Title', 'Seller', 'Price', 'Sold', 'Watching', 'Scanned At', 'Item URL', 'Revision URL'];
  const rows = allItems.map(item => [
    item.itemId,
    item.title,
    item.seller,
    item.priceText,
    item.soldCount,
    item.watchingCount,
    item.scannedAt,
    item.url,
    item.revisionUrl,
  ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));

  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  chrome.downloads.download({ url, filename: `ebay-scanned-items-${ts}.csv`, saveAs: true }, () => {
    URL.revokeObjectURL(url);
  });
});
