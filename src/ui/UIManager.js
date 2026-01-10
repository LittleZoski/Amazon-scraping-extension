/**
 * UI Manager
 * Handles all UI components: buttons, modals, notifications, progress indicators
 */
import { DOMHelpers } from '../utils/DOMHelpers.js';

export class UIManager {
  static showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10001;
      padding: 15px 25px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  static createProgressIndicator(total) {
    const progressContainer = document.createElement('div');
    progressContainer.id = 'amazon-scraper-progress';
    progressContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10002;
      background: white;
      border-radius: 12px;
      padding: 25px 30px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      min-width: 350px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    progressContainer.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 24px; margin-bottom: 10px;">📦</div>
        <div style="font-size: 18px; font-weight: 600; color: #333;">Scraping Products</div>
      </div>

      <div style="margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; color: #666;">
          <span id="progress-text">0 / ${total}</span>
          <span id="progress-percent">0%</span>
        </div>
        <div style="background: #e0e0e0; border-radius: 10px; height: 20px; overflow: hidden;">
          <div id="progress-bar" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 100%; width: 0%; transition: width 0.3s ease;"></div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-around; font-size: 13px; color: #666;">
        <div>
          <span style="color: #10b981; font-weight: 600;" id="success-count">0</span> Success
        </div>
        <div>
          <span style="color: #f59e0b; font-weight: 600;" id="skipped-count">0</span> Skipped
        </div>
        <div>
          <span style="color: #ef4444; font-weight: 600;" id="fail-count">0</span> Failed
        </div>
      </div>

      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
        <div style="font-size: 12px; color: #999; text-align: center; margin-bottom: 15px;">
          Currently scraping: <span id="current-item" style="color: #667eea; font-weight: 500;">Product 0</span>
        </div>
        <button id="stop-scraping-btn" style="width: 100%; padding: 10px; background: #ef4444; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px; transition: all 0.2s;">
          ⏸ Stop Scraping
        </button>
      </div>
    `;

    const stopBtn = progressContainer.querySelector('#stop-scraping-btn');
    stopBtn.addEventListener('mouseenter', () => {
      stopBtn.style.background = '#dc2626';
      stopBtn.style.transform = 'scale(1.02)';
    });
    stopBtn.addEventListener('mouseleave', () => {
      stopBtn.style.background = '#ef4444';
      stopBtn.style.transform = 'scale(1)';
    });

    return progressContainer;
  }

  static updateProgressIndicator(progressUI, current, total, successCount, failCount, skippedCount = 0) {
    const percent = Math.round((current / total) * 100);
    progressUI.querySelector('#progress-text').textContent = `${current} / ${total}`;
    progressUI.querySelector('#progress-percent').textContent = `${percent}%`;
    progressUI.querySelector('#progress-bar').style.width = `${percent}%`;
    progressUI.querySelector('#success-count').textContent = successCount;
    progressUI.querySelector('#skipped-count').textContent = skippedCount;
    progressUI.querySelector('#fail-count').textContent = failCount;
    progressUI.querySelector('#current-item').textContent = `Product ${current}`;
  }

  static injectStyles() {
    if (document.getElementById('amazon-scraper-styles')) return;

    const style = document.createElement('style');
    style.id = 'amazon-scraper-styles';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
}
