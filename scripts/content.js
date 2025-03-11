// Content script to detect and convert USD amounts to satoshis

// Configuration
const config = {
  // Amazon-specific price patterns
  amazonPricePatterns: [
    /\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/g,  // Basic price pattern
    /(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)(?:\s)?USD/g,  // USD format
  ],
  // Amazon-specific price selectors in order of priority
  amazonSelectors: [
    '.a-price .a-offscreen',  // Hidden price element containing clean price
    '.a-price-whole',         // Whole number part of price
    '.a-price-fraction',      // Decimal part of price
    '#priceblock_ourprice',   // Our price block
    '#priceblock_dealprice',  // Deal price block
    '.a-color-price',         // Generic price color class
    '.p13n-sc-price',         // Product grid prices
    '.a-text-price',          // Text-based prices
    '.a-price',               // Generic price wrapper
    '.a-price-range',         // Price ranges
    '[data-a-color="price"]'  // Price color attribute
  ],
  // Elements to exclude from conversion
  excludeSelectors: `
    input, textarea, script, style, noscript, iframe, form, select, option, button,
    .satsify-converted, [data-satsify-converted="true"], [data-satsify-processed="true"],
    script:not([type="application/ld+json"]), .hidden, [hidden], [aria-hidden="true"],
    meta, link, style, head, title, [style*="display: none"], [style*="visibility: hidden"],
    [class*="hidden"], [id*="hidden"], pre, code, .a-button
  `.trim().replace(/\s+/g, ','),
  // Styling for converted elements
  convertedStyle: 'color: #f7931a !important; font-weight: bold !important; cursor: help !important; text-decoration: none !important; display: inline-block !important;',
  // Tooltip styling
  tooltipStyle: 'position: absolute; background: #f7f7f7; border: 1px solid #ddd; padding: 5px; border-radius: 4px; font-size: 12px; z-index: 10000; max-width: 200px;'
};

// State management
let state = {
  autoConvert: false,
  btcRate: null,
  convertedElements: new WeakMap(),
  processedElements: new WeakMap(),
  tooltipElement: null,
  pendingConversion: false,
  observer: null
};

// Initialize
(async function init() {
  // Only run on Amazon domains
  if (!window.location.hostname.includes('amazon.')) {
    return;
  }
  
  await loadSettings();
  await ensureBtcRate();
  
  if (state.autoConvert) {
    convertPricesOnPage();
  }
  
  setupMutationObserver();
  setupMessageListener();
  setupTooltip();
})();

// Load user settings from storage
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['autoConvert', 'btcRate'], (result) => {
      state.autoConvert = result.autoConvert || false;
      state.btcRate = result.btcRate;
      resolve();
    });
  });
}

// Ensure we have a BTC rate
async function ensureBtcRate() {
  if (!state.btcRate) {
    try {
      state.btcRate = await window.bitcoinAPI.getCachedBitcoinPrice();
      if (!state.btcRate) {
        state.btcRate = await window.bitcoinAPI.updateBitcoinPrice();
      }
    } catch (error) {
      console.error('Failed to get BTC rate:', error);
      state.btcRate = 50000; // Fallback default
    }
  }
  return state.btcRate;
}

// Main function to convert prices on the page
function convertPricesOnPage() {
  if (state.pendingConversion) return;
  state.pendingConversion = true;
  
  requestAnimationFrame(() => {
    try {
      clearPreviousConversions();
      processAmazonPrices();
    } finally {
      state.pendingConversion = false;
    }
  });
}

// Clear previous conversions
function clearPreviousConversions() {
  document.querySelectorAll('.satsify-converted, [data-satsify-converted="true"]').forEach(elem => {
    try {
      if (elem.hasAttribute('data-original-price')) {
        const originalPrice = elem.getAttribute('data-original-price');
        elem.textContent = originalPrice;
        elem.removeAttribute('data-original-price');
        elem.removeAttribute('data-sats-value');
        elem.removeAttribute('style');
        elem.classList.remove('satsify-converted');
        elem.removeAttribute('data-satsify-converted');
      }
    } catch (error) {
      console.error('Error clearing conversion:', error);
    }
  });
  
  state.convertedElements = new WeakMap();
  state.processedElements = new WeakMap();
}

// Process Amazon prices
function processAmazonPrices() {
  config.amazonSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (shouldProcessElement(element)) {
          convertAmazonPrice(element);
        }
      });
    } catch (error) {
      console.error('Error processing Amazon prices:', error);
    }
  });
}

// Check if element should be processed
function shouldProcessElement(element) {
  if (!element || !element.nodeType) return false;
  
  // Skip if already processed
  if (state.processedElements.has(element) ||
      element.classList.contains('satsify-converted') ||
      element.hasAttribute('data-satsify-converted')) {
    return false;
  }
  
  // Skip if matches exclude selectors
  try {
    if (element.matches(config.excludeSelectors)) return false;
  } catch (e) {
    // If matches throws an error, skip this check
  }
  
  return true;
}

// Convert Amazon price element
function convertAmazonPrice(element) {
  try {
    // Mark as processed to prevent double processing
    state.processedElements.set(element, true);
    
    let priceText = element.textContent.trim();
    let match = null;
    
    // Try each price pattern
    for (const pattern of config.amazonPricePatterns) {
      pattern.lastIndex = 0; // Reset regex state
      match = pattern.exec(priceText);
      if (match) break;
    }
    
    if (!match || !match[1]) return;
    
    const amountStr = match[1].replace(/,/g, '');
    const usdAmount = parseFloat(amountStr);
    
    if (isNaN(usdAmount)) return;
    
    const satsAmount = window.bitcoinAPI.usdToSats(usdAmount, state.btcRate);
    const formattedSats = window.bitcoinAPI.formatSats(satsAmount);
    
    // Create wrapper for converted price
    const wrapper = document.createElement('span');
    wrapper.setAttribute('data-original-price', priceText);
    wrapper.setAttribute('data-sats-value', satsAmount);
    wrapper.setAttribute('data-satsify-converted', 'true');
    wrapper.classList.add('satsify-converted');
    wrapper.style.cssText = config.convertedStyle;
    wrapper.textContent = formattedSats;
    
    // Add tooltip events
    wrapper.addEventListener('mouseenter', showTooltip);
    wrapper.addEventListener('mouseleave', hideTooltip);
    
    // Special handling for price components
    if (element.classList.contains('a-price-whole') || element.classList.contains('a-price-fraction')) {
      // For split price components, only convert the whole number part
      if (element.classList.contains('a-price-whole')) {
        element.textContent = formattedSats;
        element.setAttribute('data-original-price', priceText);
        element.setAttribute('data-satsify-converted', 'true');
        element.classList.add('satsify-converted');
        element.style.cssText = config.convertedStyle;
      }
    } else {
      // Replace content for other price elements
      element.textContent = '';
      element.appendChild(wrapper);
    }
    
    state.convertedElements.set(element, true);
  } catch (error) {
    console.error('Error converting Amazon price:', error);
  }
}

// Set up mutation observer
function setupMutationObserver() {
  if (state.observer) {
    state.observer.disconnect();
  }
  
  state.observer = new MutationObserver((mutations) => {
    if (!state.autoConvert || state.pendingConversion) return;
    
    const shouldProcess = mutations.some(mutation => {
      return mutation.addedNodes.length > 0 || 
             (mutation.type === 'attributes' && mutation.target.matches(config.amazonSelectors.join(',')));
    });
    
    if (shouldProcess) {
      convertPricesOnPage();
    }
  });
  
  state.observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-a-color']
  });
}

// Set up message listener
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'convertNow':
        convertPricesOnPage();
        sendResponse({ success: true });
        break;
      case 'toggleAutoConvert':
        state.autoConvert = message.enabled;
        if (state.autoConvert) {
          convertPricesOnPage();
        } else {
          clearPreviousConversions();
        }
        sendResponse({ success: true });
        break;
      case 'getBtcRate':
        sendResponse({ btcRate: state.btcRate });
        break;
    }
    return true;
  });
}

// Set up tooltip
function setupTooltip() {
  if (state.tooltipElement) return;
  
  state.tooltipElement = document.createElement('div');
  state.tooltipElement.setAttribute('style', config.tooltipStyle);
  state.tooltipElement.style.display = 'none';
  document.body.appendChild(state.tooltipElement);
}

// Show tooltip
function showTooltip(event) {
  const element = event.target;
  const originalPrice = element.getAttribute('data-original-price');
  const rect = element.getBoundingClientRect();
  
  state.tooltipElement.textContent = `Original: ${originalPrice}`;
  state.tooltipElement.style.left = `${window.scrollX + rect.left}px`;
  state.tooltipElement.style.top = `${window.scrollY + rect.bottom + 5}px`;
  state.tooltipElement.style.display = 'block';
}

// Hide tooltip
function hideTooltip() {
  state.tooltipElement.style.display = 'none';
} 