document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const autoConvertToggle = document.getElementById('auto-convert');
  const convertNowBtn = document.getElementById('convert-now');
  const btcRateElement = document.getElementById('btc-rate');
  const lastUpdatedElement = document.getElementById('last-updated');

  // Load saved preferences
  chrome.storage.local.get(['autoConvert', 'btcRate', 'lastUpdated'], (result) => {
    // Set toggle state
    if (result.autoConvert !== undefined) {
      autoConvertToggle.checked = result.autoConvert;
    }

    // Display BTC rate
    if (result.btcRate) {
      btcRateElement.textContent = `$${result.btcRate.toLocaleString()}`;
    }

    // Display last updated time
    if (result.lastUpdated) {
      const date = new Date(result.lastUpdated);
      lastUpdatedElement.textContent = formatDate(date);
    }
  });

  // Save auto-convert preference when toggle changes
  autoConvertToggle.addEventListener('change', () => {
    const isEnabled = autoConvertToggle.checked;
    chrome.storage.local.set({ autoConvert: isEnabled });

    // Send message to content script about the state change
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'toggleAutoConvert', 
          enabled: isEnabled 
        });
      }
    });
  });

  // Handle convert now button click
  convertNowBtn.addEventListener('click', () => {
    // Update the button UI to show it's working
    convertNowBtn.textContent = 'Converting...';
    convertNowBtn.disabled = true;

    // Send message to content script to convert USD on the page
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'convertNow' }, () => {
          // Reset button after a short delay
          setTimeout(() => {
            convertNowBtn.textContent = 'Convert Now';
            convertNowBtn.disabled = false;
          }, 500);
        });
      }
    });
  });

  // Refresh BTC rate
  checkAndUpdateBtcRate();

  // Helper to format date
  function formatDate(date) {
    const now = new Date();
    const diff = (now - date) / 1000; // Seconds

    if (diff < 60) {
      return 'Just now';
    } else if (diff < 3600) {
      const minutes = Math.floor(diff / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diff < 86400) {
      const hours = Math.floor(diff / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleString();
    }
  }

  // Check and update BTC rate
  function checkAndUpdateBtcRate() {
    chrome.storage.local.get(['btcRate', 'lastUpdated'], (result) => {
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      // If no rate or last update was more than 5 minutes ago
      if (!result.btcRate || !result.lastUpdated || (now - result.lastUpdated > fiveMinutes)) {
        // Fetch fresh rate - message the background script to do this
        chrome.runtime.sendMessage({ action: 'fetchBtcRate' }, (response) => {
          if (response && response.btcRate) {
            btcRateElement.textContent = `$${response.btcRate.toLocaleString()}`;
            lastUpdatedElement.textContent = 'Just now';
          }
        });
      }
    });
  }
}); 