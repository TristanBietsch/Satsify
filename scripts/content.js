// Content script to detect and convert USD amounts to satoshis

// Configuration
const config = {
  // Match various USD patterns
  usdRegexPatterns: [
    /\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/g,                   // $10.99
    /(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)(?:\s)?USD/g,           // 10.99 USD
    /USD(?:\s)?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/g,           // USD 10.99
    /(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)(?:\s)?(?:dollars|dollar)/gi, // 10.99 dollars
    /(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)(?:\s)?US(?:\s)?dollars/gi,   // 10.99 US dollars
  ],
  // Exclude these elements from conversion
  excludeSelectors: 'input, textarea, [contenteditable="true"], script, style, noscript, iframe',
  // CSS for the converted elements
  convertedStyle: 'color: #f7931a; font-weight: bold; cursor: help;',
  // Original value tooltip style
  tooltipStyle: 'position: absolute; background: #f7f7f7; border: 1px solid #ddd; padding: 5px; border-radius: 4px; font-size: 12px; z-index: 10000; max-width: 200px;'
};

// State
let state = {
  autoConvert: false,
  btcRate: null,
  convertedElements: new WeakMap(),
  tooltipElement: null,
  pendingConversion: false,
  observer: null
};

// Initialize
(async function init() {
  await loadSettings();
  await ensureBtcRate();
  
  if (state.autoConvert) {
    convertUsdOnPage();
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

// Convert USD amounts to sats on the page
function convertUsdOnPage() {
  if (state.pendingConversion) return;
  state.pendingConversion = true;
  
  // Use requestAnimationFrame to avoid blocking the main thread
  requestAnimationFrame(() => {
    scanAndConvertTextNodes(document.body);
    state.pendingConversion = false;
  });
}

// Scan and convert text nodes
function scanAndConvertTextNodes(rootNode) {
  // Skip excluded elements
  if (rootNode.matches && rootNode.matches(config.excludeSelectors)) {
    return;
  }

  // Handle text nodes
  if (rootNode.nodeType === Node.TEXT_NODE && rootNode.textContent.trim() !== '') {
    convertTextNode(rootNode);
    return;
  }

  // Recursively process child nodes
  const childNodes = Array.from(rootNode.childNodes);
  childNodes.forEach(node => scanAndConvertTextNodes(node));
}

// Convert a single text node
function convertTextNode(textNode) {
  if (state.convertedElements.has(textNode)) {
    return; // Already converted
  }

  let text = textNode.textContent;
  let matches = false;
  
  // Check for USD patterns
  for (const regex of config.usdRegexPatterns) {
    if (regex.test(text)) {
      matches = true;
      break;
    }
  }
  
  if (!matches) return;

  // Create a document fragment to replace the text node
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;

  // Process each pattern
  for (const regex of config.usdRegexPatterns) {
    regex.lastIndex = 0; // Reset regex state
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      // Get the full match and the captured amount
      const fullMatch = match[0];
      const amount = match[1];
      const matchIndex = match.index;
      
      // Add text before the match
      if (matchIndex > lastIndex) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex, matchIndex)));
      }
      
      // Create element for the converted amount
      const amountStr = amount.replace(/,/g, ''); // Remove commas
      const usdAmount = parseFloat(amountStr);
      const satsAmount = window.bitcoinAPI.usdToSats(usdAmount, state.btcRate);
      const formattedSats = window.bitcoinAPI.formatSats(satsAmount);
      
      const convertedSpan = document.createElement('span');
      convertedSpan.textContent = formattedSats;
      convertedSpan.setAttribute('style', config.convertedStyle);
      convertedSpan.setAttribute('data-original-usd', fullMatch);
      convertedSpan.setAttribute('data-sats-value', satsAmount);
      convertedSpan.classList.add('satsify-converted');
      
      // Add hover events for tooltip
      convertedSpan.addEventListener('mouseenter', showTooltip);
      convertedSpan.addEventListener('mouseleave', hideTooltip);
      
      fragment.appendChild(convertedSpan);
      
      lastIndex = matchIndex + fullMatch.length;
    }
    
    // Reset regex state
    regex.lastIndex = 0;
  }
  
  // Add any remaining text
  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
  }
  
  // Only replace if we made changes
  if (lastIndex > 0) {
    // Mark as converted to avoid re-processing
    state.convertedElements.set(textNode, true);
    
    // Replace the original text node with our fragment
    textNode.parentNode.replaceChild(fragment, textNode);
  }
}

// Set up mutation observer to handle dynamic content
function setupMutationObserver() {
  // Disconnect any existing observer
  if (state.observer) {
    state.observer.disconnect();
  }

  // Create a new mutation observer
  state.observer = new MutationObserver((mutations) => {
    if (!state.autoConvert) return;
    
    // Process mutations debounced to avoid excessive processing
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            scanAndConvertTextNodes(node);
          });
        } else if (mutation.type === 'characterData') {
          convertTextNode(mutation.target);
        }
      });
    }, 200);
  });

  // Start observing
  state.observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

// Set up message listener for popup communication
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'convertNow':
        convertUsdOnPage();
        sendResponse({ success: true });
        break;
        
      case 'toggleAutoConvert':
        state.autoConvert = message.enabled;
        if (state.autoConvert) {
          convertUsdOnPage();
        } else {
          restoreOriginalValues();
        }
        sendResponse({ success: true });
        break;
        
      case 'getBtcRate':
        sendResponse({ btcRate: state.btcRate });
        break;
    }
    return true; // Keep the message channel open for async responses
  });
}

// Restore original USD values on the page
function restoreOriginalValues() {
  const convertedElements = document.querySelectorAll('.satsify-converted');
  convertedElements.forEach(element => {
    const originalUsd = element.getAttribute('data-original-usd');
    const textNode = document.createTextNode(originalUsd);
    element.parentNode.replaceChild(textNode, element);
  });
  
  // Clear the converted elements tracking
  state.convertedElements = new WeakMap();
}

// Set up the tooltip element
function setupTooltip() {
  if (state.tooltipElement) return;
  
  state.tooltipElement = document.createElement('div');
  state.tooltipElement.setAttribute('style', config.tooltipStyle);
  state.tooltipElement.style.display = 'none';
  document.body.appendChild(state.tooltipElement);
}

// Show tooltip with original USD value
function showTooltip(event) {
  const element = event.target;
  const originalUsd = element.getAttribute('data-original-usd');
  const rect = element.getBoundingClientRect();
  
  state.tooltipElement.textContent = `Original: ${originalUsd}`;
  state.tooltipElement.style.left = `${window.scrollX + rect.left}px`;
  state.tooltipElement.style.top = `${window.scrollY + rect.bottom + 5}px`;
  state.tooltipElement.style.display = 'block';
}

// Hide tooltip
function hideTooltip() {
  state.tooltipElement.style.display = 'none';
} 