/**
 * Address Deleter
 * Handles bulk deletion of Amazon addresses
 */
import { DOMHelpers } from '../utils/DOMHelpers.js';
import { UIManager } from '../ui/UIManager.js';

export class AddressDeleter {
  constructor() {
    this.deleteButton = null;
    this.isDeleting = false;
  }

  init() {
    if (DOMHelpers.isAddressPage() && !DOMHelpers.isAddAddressPage()) {
      this.injectDeleteButton();
    }
  }

  injectDeleteButton() {
    if (document.getElementById('address-bulk-delete-btn')) return;

    this.deleteButton = document.createElement('button');
    this.deleteButton.id = 'address-bulk-delete-btn';
    this.deleteButton.innerHTML = '🗑️ Delete Existing Addresses';
    this.deleteButton.style.cssText = `
      position: fixed;
      top: 150px;
      right: 20px;
      z-index: 10000;
      padding: 12px 20px;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;
    `;

    this.deleteButton.addEventListener('mouseenter', () => {
      this.deleteButton.style.transform = 'scale(1.05)';
      this.deleteButton.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
    });

    this.deleteButton.addEventListener('mouseleave', () => {
      this.deleteButton.style.transform = 'scale(1)';
      this.deleteButton.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
    });

    this.deleteButton.addEventListener('click', () => this.showDeleteModal());
    document.body.appendChild(this.deleteButton);
  }

  extractAddressesFromPage() {
    const addresses = [];

    // Find all address cards - they are div elements with class "a-row a-spacing-micro"
    // But we need to be more specific - look for the address block containers
    const addressBlocks = document.querySelectorAll('div[id^="ya-myab-display-address-block-"]');

    addressBlocks.forEach((block, index) => {
      // Find the name field with class "id-addr-ux-search-text a-text-bold"
      const nameElement = block.querySelector('.id-addr-ux-search-text.a-text-bold');

      // Find all list items for address details
      const listItems = block.querySelectorAll('ul.a-unordered-list.a-nostyle.a-vertical li span.a-list-item');

      // Find the remove link
      const removeLink = block.closest('.address-column')?.querySelector('a.delete-link[id^="ya-myab-address-delete-btn-"]');

      if (nameElement) {
        const name = nameElement.textContent.trim();
        const addressLines = [];

        listItems.forEach(item => {
          const text = item.textContent.trim();
          if (text && text !== name) {
            addressLines.push(text);
          }
        });

        addresses.push({
          index: index,
          name: name,
          addressLines: addressLines,
          displayText: addressLines.join(', '),
          blockElement: block,
          removeLink: removeLink
        });
      }
    });

    return addresses;
  }

  showDeleteModal() {
    const addresses = this.extractAddressesFromPage();

    if (addresses.length === 0) {
      UIManager.showNotification('No addresses found on this page.', 'warning');
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'address-delete-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10003;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    modal.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 30px; max-width: 550px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <h2 style="margin: 0 0 20px 0; color: #333; font-size: 24px;">🗑️ Delete Existing Addresses</h2>

        <div style="margin-bottom: 20px; padding: 15px; background: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
          <p style="margin: 0; font-size: 13px; color: #991b1b; line-height: 1.5;">
            <strong>Warning:</strong> This will permanently delete the selected addresses from your Amazon account.
            This action cannot be undone.
          </p>
        </div>

        <div style="margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h3 style="margin: 0; font-size: 14px; color: #666;">Select Addresses to Delete:</h3>
            <div style="display: flex; gap: 10px;">
              <button id="select-all-delete-btn" style="padding: 4px 10px; background: #3b82f6; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 500;">Select All</button>
              <button id="deselect-all-delete-btn" style="padding: 4px 10px; background: #6b7280; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 500;">Deselect All</button>
            </div>
          </div>
          <div id="address-delete-list" style="font-size: 12px; color: #333; max-height: 300px; overflow-y: auto; background: #f9fafb; padding: 15px; border-radius: 8px;">
            ${addresses.map((addr, i) => `
              <label style="display: flex; align-items: flex-start; padding: 10px; margin-bottom: 8px; background: white; border-radius: 6px; cursor: pointer; transition: background 0.2s; border: 1px solid #e5e7eb;"
                     onmouseover="this.style.background='#fef2f2'; this.style.borderColor='#fecaca'"
                     onmouseout="this.style.background='white'; this.style.borderColor='#e5e7eb'">
                <input type="checkbox" class="address-delete-checkbox" data-index="${i}"
                       style="margin-right: 12px; margin-top: 3px; width: 18px; height: 18px; cursor: pointer; accent-color: #ef4444;">
                <span style="flex: 1;">
                  <strong style="color: #111; font-size: 14px;">${addr.name}</strong><br>
                  <span style="color: #666; font-size: 12px; line-height: 1.4;">${addr.displayText || 'No address details'}</span>
                </span>
              </label>
            `).join('')}
          </div>
          <div id="delete-selection-count" style="margin-top: 10px; font-size: 12px; color: #666; font-weight: 500;">0 of ${addresses.length} addresses selected</div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 25px;">
          <button id="start-delete-btn" disabled style="flex: 1; padding: 12px; background: #d1d5db; color: #6b7280; border: none; border-radius: 8px; font-weight: 600; cursor: not-allowed; font-size: 15px;">
            🗑️ Delete Selected
          </button>
          <button id="cancel-delete-btn" style="flex: 1; padding: 12px; background: #e0e0e0; color: #666; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 15px;">
            Cancel
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const addressList = modal.querySelector('#address-delete-list');
    const startBtn = modal.querySelector('#start-delete-btn');
    const cancelBtn = modal.querySelector('#cancel-delete-btn');
    const selectAllBtn = modal.querySelector('#select-all-delete-btn');
    const deselectAllBtn = modal.querySelector('#deselect-all-delete-btn');
    const selectionCount = modal.querySelector('#delete-selection-count');

    const updateSelectionCount = () => {
      const checkedCount = addressList.querySelectorAll('input[type="checkbox"]:checked').length;
      selectionCount.textContent = `${checkedCount} of ${addresses.length} addresses selected`;

      if (checkedCount > 0) {
        startBtn.disabled = false;
        startBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        startBtn.style.color = 'white';
        startBtn.style.cursor = 'pointer';
      } else {
        startBtn.disabled = true;
        startBtn.style.background = '#d1d5db';
        startBtn.style.color = '#6b7280';
        startBtn.style.cursor = 'not-allowed';
      }
    };

    // Add event listeners to checkboxes
    addressList.querySelectorAll('.address-delete-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', updateSelectionCount);
    });

    selectAllBtn.addEventListener('click', () => {
      addressList.querySelectorAll('.address-delete-checkbox').forEach(checkbox => {
        checkbox.checked = true;
      });
      updateSelectionCount();
    });

    deselectAllBtn.addEventListener('click', () => {
      addressList.querySelectorAll('.address-delete-checkbox').forEach(checkbox => {
        checkbox.checked = false;
      });
      updateSelectionCount();
    });

    startBtn.addEventListener('click', () => {
      const selectedIndices = Array.from(addressList.querySelectorAll('.address-delete-checkbox:checked'))
        .map(checkbox => parseInt(checkbox.dataset.index));

      if (selectedIndices.length === 0) {
        UIManager.showNotification('Please select at least one address to delete.', 'warning');
        return;
      }

      const selectedAddresses = selectedIndices.map(i => addresses[i]);
      modal.remove();
      this.startBulkDelete(selectedAddresses);
    });

    cancelBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  async startBulkDelete(addressesToDelete) {
    if (this.isDeleting) {
      UIManager.showNotification('Deletion already in progress.', 'warning');
      return;
    }

    this.isDeleting = true;
    const total = addressesToDelete.length;
    let successCount = 0;
    let failCount = 0;

    // Create progress UI
    const progressUI = this.createDeleteProgressUI(total);
    document.body.appendChild(progressUI);

    let shouldStop = false;
    const stopBtn = progressUI.querySelector('#stop-delete-btn');
    stopBtn.addEventListener('click', () => {
      shouldStop = true;
      stopBtn.textContent = '⏳ Stopping...';
      stopBtn.disabled = true;
    });

    for (let i = 0; i < addressesToDelete.length; i++) {
      if (shouldStop) {
        UIManager.showNotification(`Deletion stopped. ${successCount} deleted, ${failCount} failed.`, 'warning');
        break;
      }

      const address = addressesToDelete[i];
      this.updateDeleteProgress(progressUI, i + 1, total, successCount, failCount, address.name);

      try {
        // Re-find the remove link since DOM may have changed after deletions
        const success = await this.deleteAddress(address, i);

        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error('Error deleting address:', error);
        failCount++;
      }

      // Wait between deletions to allow DOM to update
      if (i < addressesToDelete.length - 1 && !shouldStop) {
        await DOMHelpers.sleep(1500);
      }
    }

    progressUI.remove();
    this.isDeleting = false;

    if (successCount > 0) {
      UIManager.showNotification(`✅ Deleted ${successCount} address(es). ${failCount > 0 ? `${failCount} failed.` : ''}`, 'success');
      // Reload page to refresh the address list
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } else {
      UIManager.showNotification(`❌ Failed to delete addresses. Please try again.`, 'error');
    }
  }

  async deleteAddress(address, originalIndex) {
    // Find the remove link by looking for delete links and matching by index or re-scanning
    const deleteLinks = document.querySelectorAll('a.delete-link[id^="ya-myab-address-delete-btn-"]');

    // Try to find the correct delete link
    let removeLink = null;

    // First try: find by the original block element if it still exists
    if (address.blockElement && document.contains(address.blockElement)) {
      const parentColumn = address.blockElement.closest('.address-column');
      if (parentColumn) {
        removeLink = parentColumn.querySelector('a.delete-link[id^="ya-myab-address-delete-btn-"]');
      }
    }

    // Second try: find by name match
    if (!removeLink) {
      const addressBlocks = document.querySelectorAll('div[id^="ya-myab-display-address-block-"]');
      for (const block of addressBlocks) {
        const nameElement = block.querySelector('.id-addr-ux-search-text.a-text-bold');
        if (nameElement && nameElement.textContent.trim() === address.name) {
          const parentColumn = block.closest('.address-column');
          if (parentColumn) {
            removeLink = parentColumn.querySelector('a.delete-link[id^="ya-myab-address-delete-btn-"]');
            break;
          }
        }
      }
    }

    if (!removeLink) {
      console.error('Could not find remove link for address:', address.name);
      return false;
    }

    // Click the remove link to trigger the modal
    removeLink.click();

    // Wait for the confirmation modal to appear
    await DOMHelpers.sleep(500);

    // Find and click the confirm button in the modal
    const confirmed = await this.confirmDeletion(removeLink.id);

    return confirmed;
  }

  async confirmDeletion(deleteBtnId) {
    // The modal ID is based on the delete button ID
    // e.g., ya-myab-address-delete-btn-0 -> deleteAddressModal-0
    const modalIndex = deleteBtnId.replace('ya-myab-address-delete-btn-', '');

    // Try multiple selectors to find the confirm button
    const confirmSelectors = [
      // Primary selector based on modal naming convention
      `#deleteAddressModal-${modalIndex}-confirm-btn`,
      `#a-popover-deleteAddressModal-${modalIndex} .a-button-primary`,
      // Generic selectors for confirmation buttons
      '.a-popover:not(.a-popover-hidden) .a-button-primary input',
      '.a-popover:not(.a-popover-hidden) .a-button-primary button',
      '.a-popover:not(.a-popover-hidden) input[type="submit"]',
      '.a-popover:not(.a-popover-hidden) button[name="submit"]',
      // Look for Yes/Confirm text
      '.a-popover:not(.a-popover-hidden) span.a-button-text',
    ];

    // Wait a bit more for modal to fully load
    await DOMHelpers.sleep(300);

    for (const selector of confirmSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        // Check if this is the right button (Yes, Confirm, Delete, etc.)
        const text = element.textContent?.toLowerCase() || '';
        const isConfirmButton = text.includes('yes') ||
                               text.includes('confirm') ||
                               text.includes('delete') ||
                               element.closest('.a-button-primary');

        if (isConfirmButton || element.closest('.a-button-primary')) {
          // Click the element or its parent button
          const clickTarget = element.tagName === 'SPAN' ?
            element.closest('.a-button')?.querySelector('input, button') || element :
            element;

          if (clickTarget) {
            clickTarget.click();
            console.log('Clicked confirm button:', clickTarget);

            // Wait for deletion to process
            await DOMHelpers.sleep(1000);
            return true;
          }
        }
      }
    }

    // Fallback: Look for any visible popover with a primary button
    const popovers = document.querySelectorAll('.a-popover-wrapper');
    for (const popover of popovers) {
      if (popover.offsetParent !== null) { // Check if visible
        const primaryBtn = popover.querySelector('.a-button-primary input, .a-button-primary button');
        if (primaryBtn) {
          primaryBtn.click();
          console.log('Clicked primary button in popover:', primaryBtn);
          await DOMHelpers.sleep(1000);
          return true;
        }
      }
    }

    console.error('Could not find confirmation button');

    // Try to close any open modal to prevent blocking
    const closeBtn = document.querySelector('.a-popover:not(.a-popover-hidden) .a-button-close, .a-popover-header .a-button-close');
    if (closeBtn) {
      closeBtn.click();
    }

    return false;
  }

  createDeleteProgressUI(total) {
    const progressContainer = document.createElement('div');
    progressContainer.id = 'address-delete-progress';
    progressContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10004;
      background: white;
      border-radius: 12px;
      padding: 25px 30px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      min-width: 400px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    progressContainer.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 24px; margin-bottom: 10px;">🗑️</div>
        <div style="font-size: 18px; font-weight: 600; color: #333;">Deleting Addresses</div>
      </div>

      <div style="margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; color: #666;">
          <span id="delete-progress-text">0 / ${total}</span>
          <span id="delete-progress-percent">0%</span>
        </div>
        <div style="background: #e0e0e0; border-radius: 10px; height: 20px; overflow: hidden;">
          <div id="delete-progress-bar" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); height: 100%; width: 0%; transition: width 0.3s ease;"></div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-around; font-size: 13px; color: #666; margin-bottom: 15px;">
        <div>
          <span style="color: #10b981; font-weight: 600;" id="delete-success-count">0</span> Deleted
        </div>
        <div>
          <span style="color: #ef4444; font-weight: 600;" id="delete-fail-count">0</span> Failed
        </div>
      </div>

      <div style="padding-top: 15px; border-top: 1px solid #e0e0e0;">
        <div style="font-size: 12px; color: #999; text-align: center; margin-bottom: 15px;">
          Currently deleting: <span id="current-delete-item" style="color: #ef4444; font-weight: 500;">...</span>
        </div>
        <button id="stop-delete-btn" style="width: 100%; padding: 10px; background: #6b7280; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px; transition: all 0.2s;">
          ⏸ Stop Deletion
        </button>
      </div>
    `;

    return progressContainer;
  }

  updateDeleteProgress(progressUI, current, total, successCount, failCount, currentName) {
    const percent = Math.round((current / total) * 100);
    progressUI.querySelector('#delete-progress-text').textContent = `${current} / ${total}`;
    progressUI.querySelector('#delete-progress-percent').textContent = `${percent}%`;
    progressUI.querySelector('#delete-progress-bar').style.width = `${percent}%`;
    progressUI.querySelector('#delete-success-count').textContent = successCount;
    progressUI.querySelector('#delete-fail-count').textContent = failCount;
    progressUI.querySelector('#current-delete-item').textContent = currentName || `Address ${current}`;
  }
}
