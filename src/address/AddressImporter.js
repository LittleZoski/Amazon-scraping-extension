/**
 * Address Importer
 * Handles importing eBay order addresses into Amazon
 */
import { DOMHelpers } from '../utils/DOMHelpers.js';
import { UIManager } from '../ui/UIManager.js';

export class AddressImporter {
  constructor() {
    this.importButton = null;
  }

  init() {
    if (DOMHelpers.isAddressPage()) {
      if (DOMHelpers.isAddAddressPage()) {
        this.checkAndFillAddress();
      } else if (DOMHelpers.isAddressSuccessPage()) {
        this.continueImportAfterSuccess();
      } else {
        this.injectAddressImportButton();
      }
    }
  }

  injectAddressImportButton() {
    if (document.getElementById('ebay-address-import-btn')) return;

    this.importButton = document.createElement('button');
    this.importButton.id = 'ebay-address-import-btn';
    this.importButton.innerHTML = '📦 Import eBay Addresses';
    this.importButton.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 10000;
      padding: 12px 20px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;
    `;

    this.importButton.addEventListener('mouseenter', () => {
      this.importButton.style.transform = 'scale(1.05)';
      this.importButton.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
    });

    this.importButton.addEventListener('mouseleave', () => {
      this.importButton.style.transform = 'scale(1)';
      this.importButton.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
    });

    this.importButton.addEventListener('click', () => this.showAddressImportModal());
    document.body.appendChild(this.importButton);
  }

  showAddressImportModal() {
    const modal = document.createElement('div');
    modal.id = 'address-import-modal';
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
      <div style="background: white; border-radius: 16px; padding: 30px; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <h2 style="margin: 0 0 20px 0; color: #333; font-size: 24px;">📦 Import eBay Order Addresses</h2>

        <div style="margin-bottom: 20px; padding: 15px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 1.5;">
            Upload your eBay orders JSON file from the <code style="background: white; padding: 2px 6px; border-radius: 3px;">ebay_orders</code> folder.
            This will automatically add shipping addresses to your Amazon account.
          </p>
        </div>

        <div style="margin-bottom: 25px;">
          <label style="display: block; margin-bottom: 10px; font-weight: 600; color: #333;">
            Select eBay Orders JSON File:
          </label>
          <input type="file" id="ebay-orders-file-input" accept=".json,application/json"
            style="width: 100%; padding: 10px; border: 2px dashed #d1d5db; border-radius: 8px; cursor: pointer; font-size: 13px;">
        </div>

        <div id="address-preview" style="display: none; margin-bottom: 20px; max-height: 200px; overflow-y: auto; background: #f9fafb; padding: 15px; border-radius: 8px;">
          <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Addresses to Import:</h3>
          <div id="address-list" style="font-size: 12px; color: #333;"></div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 25px;">
          <button id="start-import-btn" disabled style="flex: 1; padding: 12px; background: #d1d5db; color: #6b7280; border: none; border-radius: 8px; font-weight: 600; cursor: not-allowed; font-size: 15px;">
            Start Import
          </button>
          <button id="cancel-import-btn" style="flex: 1; padding: 12px; background: #e0e0e0; color: #666; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 15px;">
            Cancel
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const fileInput = modal.querySelector('#ebay-orders-file-input');
    const startBtn = modal.querySelector('#start-import-btn');
    const cancelBtn = modal.querySelector('#cancel-import-btn');
    const addressPreview = modal.querySelector('#address-preview');
    const addressList = modal.querySelector('#address-list');

    let ordersData = null;

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        ordersData = JSON.parse(text);

        const addresses = this.extractAddressesFromOrders(ordersData);

        if (addresses.length === 0) {
          alert('No addresses found in the file.');
          return;
        }

        addressPreview.style.display = 'block';
        addressList.innerHTML = addresses.map((addr, i) => `
          <div style="padding: 8px; margin-bottom: 5px; background: white; border-radius: 4px;">
            ${i + 1}. ${addr.name} - ${addr.city}, ${addr.stateOrProvince} ${addr.postalCode}
          </div>
        `).join('');

        startBtn.disabled = false;
        startBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        startBtn.style.color = 'white';
        startBtn.style.cursor = 'pointer';

      } catch (error) {
        alert('Error reading file: ' + error.message);
        console.error('File read error:', error);
      }
    });

    startBtn.addEventListener('click', () => {
      if (!ordersData) return;
      modal.remove();
      this.startAddressImport(ordersData);
    });

    cancelBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  extractAddressesFromOrders(ordersData) {
    const addresses = [];
    const seen = new Set();

    if (!ordersData.orders || !Array.isArray(ordersData.orders)) {
      return addresses;
    }

    ordersData.orders.forEach(order => {
      if (order.shippingAddress) {
        const addr = order.shippingAddress;
        const key = `${addr.name}|${addr.addressLine1}|${addr.city}|${addr.postalCode}`;

        if (!seen.has(key)) {
          seen.add(key);
          addresses.push(addr);
        }
      }
    });

    return addresses;
  }

  async startAddressImport(ordersData) {
    const addresses = this.extractAddressesFromOrders(ordersData);

    if (addresses.length === 0) {
      UIManager.showNotification('No addresses to import', 'error');
      return;
    }

    sessionStorage.setItem('ebayAddressesToImport', JSON.stringify(addresses));
    sessionStorage.setItem('currentAddressIndex', '0');

    UIManager.showNotification(`Starting import of ${addresses.length} addresses...`, 'info');

    setTimeout(() => {
      window.location.href = 'https://www.amazon.com/a/addresses/add?ref=ebay_import';
    }, 1000);
  }

  continueImportAfterSuccess() {
    const addressesJSON = sessionStorage.getItem('ebayAddressesToImport');
    const currentIndex = parseInt(sessionStorage.getItem('currentAddressIndex') || '0');

    if (!addressesJSON) return;

    const addresses = JSON.parse(addressesJSON);

    if (currentIndex >= addresses.length) {
      sessionStorage.removeItem('ebayAddressesToImport');
      sessionStorage.removeItem('currentAddressIndex');
      UIManager.showNotification('✅ All addresses imported successfully!', 'success');
      return;
    }

    UIManager.showNotification(`Address saved! Loading next address...`, 'success');
    setTimeout(() => {
      window.location.href = 'https://www.amazon.com/a/addresses/add?ref=ebay_import';
    }, 1000);
  }

  checkAndFillAddress() {
    const addressesJSON = sessionStorage.getItem('ebayAddressesToImport');
    const currentIndex = parseInt(sessionStorage.getItem('currentAddressIndex') || '0');

    if (!addressesJSON) return;

    const addresses = JSON.parse(addressesJSON);

    if (currentIndex >= addresses.length) {
      sessionStorage.removeItem('ebayAddressesToImport');
      sessionStorage.removeItem('currentAddressIndex');
      UIManager.showNotification('✅ All addresses imported successfully!', 'success');

      setTimeout(() => {
        window.location.href = 'https://www.amazon.com/a/addresses';
      }, 2000);
      return;
    }

    const address = addresses[currentIndex];
    setTimeout(() => {
      this.fillAddressForm(address, currentIndex + 1, addresses.length);
    }, 1000);
  }

  fillAddressForm(address, current, total) {
    try {
      const fieldMappings = {
        fullName: ['address-ui-widgets-enterAddressFullName', 'address-ui-widgets-enterAddressFormContainer-fullName'],
        phoneNumber: ['address-ui-widgets-enterAddressPhoneNumber', 'address-ui-widgets-enterAddressFormContainer-phoneNumber'],
        addressLine1: ['address-ui-widgets-enterAddressLine1', 'address-ui-widgets-enterAddressFormContainer-addressLine1'],
        addressLine2: ['address-ui-widgets-enterAddressLine2', 'address-ui-widgets-enterAddressFormContainer-addressLine2'],
        city: ['address-ui-widgets-enterAddressCity', 'address-ui-widgets-enterAddressFormContainer-city'],
        state: ['address-ui-widgets-enterAddressStateOrRegion', 'address-ui-widgets-enterAddressFormContainer-stateOrRegion'],
        postalCode: ['address-ui-widgets-enterAddressPostalCode', 'address-ui-widgets-enterAddressFormContainer-postalCode']
      };

      const setValue = (fieldIds, value) => {
        for (const id of fieldIds) {
          const field = document.getElementById(id);
          if (field) {
            field.value = value;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;
      };

      const formattedPhone = DOMHelpers.formatPhoneNumber(address.phoneNumber || '');

      setValue(fieldMappings.fullName, address.name || '');
      setValue(fieldMappings.phoneNumber, formattedPhone);
      setValue(fieldMappings.addressLine1, address.addressLine1 || '');
      setValue(fieldMappings.addressLine2, address.addressLine2 || '');
      setValue(fieldMappings.city, address.city || '');
      setValue(fieldMappings.postalCode, address.postalCode || '');

      const countrySelect = document.getElementById('address-ui-widgets-enterAddressFormContainer-country-dropdown-nativeId');
      if (countrySelect && address.countryCode) {
        countrySelect.value = address.countryCode;
        countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      setTimeout(() => {
        this.setStateDropdown(address.stateOrProvince);
      }, 300);

      UIManager.showNotification(`Importing address ${current} of ${total}...`, 'info');

      setTimeout(() => {
        this.submitAddressAndNext();
      }, 1500);

    } catch (error) {
      console.error('Error filling form:', error);
      UIManager.showNotification('Error filling form. Please check the fields.', 'error');
    }
  }

  setStateDropdown(stateValue) {
    if (!stateValue) return;

    const stateSelectors = [
      '#address-ui-widgets-enterAddressStateOrRegion-dropdown-nativeId',
      'select[name="address-ui-widgets-enterAddressStateOrRegion"]',
      '[aria-labelledby*="State"] select',
      'select.a-native-dropdown'
    ];

    for (const selector of stateSelectors) {
      const dropdown = document.querySelector(selector);
      if (dropdown) {
        const options = Array.from(dropdown.options);
        const matchingOption = options.find(opt =>
          opt.value === stateValue ||
          opt.text === stateValue ||
          opt.value.toLowerCase() === stateValue.toLowerCase() ||
          opt.text.toLowerCase() === stateValue.toLowerCase()
        );

        if (matchingOption) {
          dropdown.value = matchingOption.value;
          dropdown.dispatchEvent(new Event('change', { bubbles: true }));
          dropdown.dispatchEvent(new Event('input', { bubbles: true }));

          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
          nativeInputValueSetter.call(dropdown, matchingOption.value);
          dropdown.dispatchEvent(new Event('change', { bubbles: true }));

          console.log('State set to:', matchingOption.value);
          return true;
        }
      }
    }

    console.warn('Could not set state dropdown for:', stateValue);
    return false;
  }

  submitAddressAndNext() {
    const submitSelectors = [
      '#address-ui-widgets-form-submit-button',
      'input[name="address-ui-widgets-form-submit-button"]',
      '#address-ui-widgets-form-submit-button-announce',
      'span.a-button-inner input[aria-labelledby*="submit"]',
      'span.a-button-inner input[type="submit"]',
      'button[type="submit"]',
      'input[type="submit"]',
      '.a-button-primary input',
      '.a-button-primary span input',
      'span.a-button-text'
    ];

    let submitBtn = null;
    let foundSelector = null;

    for (const selector of submitSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        if (element.tagName === 'SPAN') {
          const text = element.textContent.trim().toLowerCase();
          if (text.includes('add address') || text.includes('submit')) {
            const input = element.closest('.a-button-primary')?.querySelector('input[type="submit"]');
            if (input) {
              submitBtn = input;
              foundSelector = selector + ' -> input';
              break;
            }
          }
        } else {
          submitBtn = element;
          foundSelector = selector;
          break;
        }
      }
    }

    if (submitBtn) {
      console.log('Found submit button with selector:', foundSelector);

      const currentIndex = parseInt(sessionStorage.getItem('currentAddressIndex') || '0');
      sessionStorage.setItem('currentAddressIndex', (currentIndex + 1).toString());

      UIManager.showNotification('Submitting address...', 'info');

      submitBtn.click();
      submitBtn.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      }));

      return;
    }

    console.warn('Could not find submit button. Available buttons:');
    document.querySelectorAll('button, input[type="submit"]').forEach(btn => {
      console.log('Button found:', {
        tag: btn.tagName,
        type: btn.type,
        id: btn.id,
        name: btn.name,
        className: btn.className,
        text: btn.textContent?.substring(0, 50)
      });
    });

    UIManager.showNotification('Could not find submit button. Please submit manually and click "Skip".', 'warning');
  }
}
