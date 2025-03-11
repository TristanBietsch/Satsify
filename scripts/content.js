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
    /\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\/mo(?:nth)?/gi,      // $10.99/mo or $10.99/month
    /\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\/year/gi,            // $10.99/year
    /\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*-\s*\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/g, // $10.99 - $20.99 range
    /(?:price|cost|fee)(?:[^\w\d]*):?\s*\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/gi, // price: $10.99
    /\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)(?:\s*each|\s*per\s*item)?/gi, // $10.99 each or per item
    /(?:starting at|from)\s*\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/gi, // starting at $10.99
    /(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s+USD\s+\/\s+mo(?:nth)?/gi, // 10.99 USD / month
    /(?:for just|only)\s+\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/gi,  // for just $10.99
    /(?:sale|price)[^\w\d]*\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/gi, // sale: $10.99
    /(?:from|starting|beginning|low as)(?:\s+at)?\s+\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/gi, // from $10.99
    /^(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)$/g, // Just a number by itself (in price context)
    /(?:deal|offer|special)[^\w\d]*\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/gi, // deal: $10.99
    /(?:book|reserve|pay)(?:[^\w\d]*):?\s*\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/gi, // book: $10.99
    /(?:total|subtotal)[^\w\d]*\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/gi, // total: $10.99
  ],
  // Match dollar sign with number combinations specifically for Amazon
  amazonRegexPattern: /\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/g,
  // Pattern to detect already converted sat values to prevent duplication
  alreadyConvertedPattern: /(\d{1,3}(?:\.\d{1})?)(?:K|M)?\s*sats/gi,
  // Exclude these elements from conversion
  excludeSelectors: 'input, textarea, [contenteditable="true"], script, style, noscript, iframe, form, select, option, button, .satsify-converted, [data-satsify-converted="true"]',
  // CSS for the converted elements
  convertedStyle: 'color: #f7931a; font-weight: bold; cursor: help;',
  // Original value tooltip style
  tooltipStyle: 'position: absolute; background: #f7f7f7; border: 1px solid #ddd; padding: 5px; border-radius: 4px; font-size: 12px; z-index: 10000; max-width: 200px;',
  // Selectors for special page types
  specialSelectors: {
    // Amazon specific price selectors
    amazon: [
      '.a-price .a-offscreen', 
      '.a-price-whole', 
      '.a-price-fraction',
      '.p13n-sc-price',
      '.a-color-price',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.offer-price',
      '.a-text-price'
    ],
    // SaaS/pricing page specific selectors
    saas: [
      '.pricing-value',
      '.price-value',
      '.price-amount',
      '.pricing-table .price',
      '.pricing-tier .price',
      '[class*="price"]:not(body):not(html)',
      '[class*="pricing"]:not(body):not(html)',
      '[id*="price"]:not(body):not(html)',
      '.plan-price',
      '.subscription-price'
    ],
    // Travel website specific selectors
    travel: [
      '.price-text',
      '.fare-price',
      '.display-price',
      '.total-price',
      '.discounted-price',
      '.deal-price',
      '[class*="price"]:not(body):not(html)',
      '[data-price]',
      '[id*="price"]:not(body):not(html)',
      '.booking-price',
      '.offer-price',
      '.ticket-price',
      '.room-price'
    ]
  }
};

// State
let state = {
  autoConvert: false,
  btcRate: null,
  convertedElements: new WeakMap(),
  processedTextNodes: new WeakMap(),
  tooltipElement: null,
  pendingConversion: false,
  observer: null,
  pageType: detectPageType() // Detect if we're on Amazon, SaaS, etc.
};

// Detect page type for specialized handling
function detectPageType() {
  const url = window.location.href.toLowerCase();
  if (url.includes('amazon.')) {
    return 'amazon';
  } else if (
    url.includes('pricing') || 
    url.includes('subscribe') || 
    url.includes('plans') ||
    /\.io\/(pricing|plans)/.test(url) ||
    /\.com\/(pricing|plans)/.test(url)
  ) {
    return 'saas';
  } else if (
    url.includes('travel') ||
    url.includes('flight') ||
    url.includes('hotel') ||
    url.includes('booking') ||
    url.includes('expedia') ||
    url.includes('airbnb') ||
    url.includes('kayak') ||
    url.includes('priceline') ||
    url.includes('orbitz') ||
    url.includes('tripadvisor') ||
    url.includes('travelocity') ||
    url.includes('hotels.') ||
    url.includes('.travel')
  ) {
    return 'travel';
  }
  return 'general';
}

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
    // Clear any previous conversions to prevent duplication
    clearPreviousConversions();
    
    // First try direct element targeting for known page types
    if (state.pageType === 'amazon' || state.pageType === 'saas' || state.pageType === 'travel') {
      processSpecialPageElements();
    }
    
    // Then do general text node scan
    scanAndConvertTextNodes(document.body);
    state.pendingConversion = false;
  });
}

// Clear previous conversions to prevent duplication
function clearPreviousConversions() {
  // Reset tracking maps
  state.convertedElements = new WeakMap();
  state.processedTextNodes = new WeakMap();
  
  // Find and remove any elements that might have been partially converted
  const partialConversions = document.querySelectorAll('[data-sats-value]');
  partialConversions.forEach(elem => {
    if (elem.textContent.match(/\d+(\.\d+)?[KM]?\s*sats\d+(\.\d+)?[KM]?\s*sats/)) {
      // This element has duplicate conversions - restore original
      if (elem.hasAttribute('data-original-usd')) {
        elem.textContent = elem.getAttribute('data-original-usd');
      }
    }
  });
}

// Process elements on special pages like Amazon, SaaS, or travel sites
function processSpecialPageElements() {
  const selectors = config.specialSelectors[state.pageType];
  if (!selectors) return;

  selectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        // Skip if already converted
        if (state.convertedElements.has(element)) return;
        if (element.hasAttribute('data-satsify-converted')) return;
        if (element.classList.contains('satsify-converted')) return;
        
        // Skip if element contains already converted values
        if (element.textContent.match(config.alreadyConvertedPattern)) return;
        
        // Handle Amazon's hidden price elements
        if (selector.includes('a-offscreen')) {
          const priceText = element.textContent.trim();
          const match = config.amazonRegexPattern.exec(priceText);
          if (match && match[1]) {
            const amountStr = match[1].replace(/,/g, '');
            const usdAmount = parseFloat(amountStr);
            // Only process the visible sibling elements
            const parentPriceElement = element.closest('.a-price');
            if (parentPriceElement) {
              const visibleElements = parentPriceElement.querySelectorAll('.a-price-whole, .a-price-fraction');
              visibleElements.forEach(visElem => {
                convertSpecialElement(visElem, usdAmount, priceText);
              });
            }
          }
        } else {
          let priceText = element.textContent.trim();
          // Try to extract price from the element
          for (const regex of config.usdRegexPatterns) {
            regex.lastIndex = 0; // Reset regex state
            const match = regex.exec(priceText);
            if (match && match[1]) {
              const amountStr = match[1].replace(/,/g, '');
              const usdAmount = parseFloat(amountStr);
              convertSpecialElement(element, usdAmount, priceText);
              break;
            }
          }
        }
      });
    } catch (error) {
      console.error(`Error processing ${state.pageType} elements:`, error);
    }
  });
}

// Convert a special element found through dedicated selectors
function convertSpecialElement(element, usdAmount, originalText) {
  if (state.convertedElements.has(element) || isNaN(usdAmount)) return;
  
  // Skip already converted elements
  if (element.hasAttribute('data-satsify-converted') || 
      element.classList.contains('satsify-converted') ||
      element.textContent.match(config.alreadyConvertedPattern)) {
    return;
  }
  
  const satsAmount = window.bitcoinAPI.usdToSats(usdAmount, state.btcRate);
  const formattedSats = window.bitcoinAPI.formatSats(satsAmount);
  
  // Store original content
  const originalHTML = element.innerHTML;
  const originalDisplay = window.getComputedStyle(element).display;
  
  // Create wrapper with original value as data attribute
  const wrapper = document.createElement('span');
  wrapper.setAttribute('data-original-usd', originalText);
  wrapper.setAttribute('data-original-html', originalHTML);
  wrapper.setAttribute('data-original-display', originalDisplay);
  wrapper.setAttribute('data-sats-value', satsAmount);
  wrapper.setAttribute('data-satsify-converted', 'true');
  wrapper.classList.add('satsify-converted');
  wrapper.style.cssText = config.convertedStyle;
  wrapper.textContent = formattedSats;
  
  // Add hover events for tooltip
  wrapper.addEventListener('mouseenter', showTooltip);
  wrapper.addEventListener('mouseleave', hideTooltip);
  
  // Replace content
  element.innerHTML = '';
  element.appendChild(wrapper);
  
  // Mark as converted
  state.convertedElements.set(element, true);
}

// Scan and convert text nodes
function scanAndConvertTextNodes(rootNode) {
  // Skip excluded elements
  if (rootNode.matches && rootNode.matches(config.excludeSelectors)) {
    return;
  }

  // Skip already converted elements
  if (rootNode.classList && rootNode.classList.contains('satsify-converted')) {
    return;
  }
  
  if (rootNode.hasAttribute && rootNode.hasAttribute('data-satsify-converted')) {
    return;
  }
  
  // Skip elements that contain already converted sats values
  if (rootNode.textContent && rootNode.textContent.match(config.alreadyConvertedPattern)) {
    // Check if it's a duplicated conversion like "10K sats10K sats"
    const duplicateMatch = rootNode.textContent.match(/(\d+(\.\d+)?[KM]?\s*sats)\1/);
    if (duplicateMatch) {
      // Attempt to fix duplicate conversions by keeping just one instance
      rootNode.textContent = rootNode.textContent.replace(/(\d+(\.\d+)?[KM]?\s*sats)\1/, '$1');
    }
    return;
  }

  // Handle text nodes
  if (rootNode.nodeType === Node.TEXT_NODE && rootNode.textContent.trim() !== '') {
    // Skip if already processed
    if (state.processedTextNodes.has(rootNode)) return;
    
    // Check if parent is already converted
    const parent = rootNode.parentNode;
    if (parent && (
        parent.classList.contains('satsify-converted') || 
        parent.hasAttribute('data-satsify-converted') ||
        state.convertedElements.has(parent)
    )) {
      return;
    }
    
    convertTextNode(rootNode);
    return;
  }

  // Recursively process child nodes
  const childNodes = Array.from(rootNode.childNodes);
  childNodes.forEach(node => scanAndConvertTextNodes(node));
}

// Convert a single text node - enhanced to handle more complex price formats
function convertTextNode(textNode) {
  // Skip already processed nodes
  if (state.processedTextNodes.has(textNode)) {
    return;
  }
  
  // Mark as processed to prevent double processing
  state.processedTextNodes.set(textNode, true);

  let text = textNode.textContent;
  
  // Skip text that already contains "sats" to prevent double conversion
  if (text.match(config.alreadyConvertedPattern)) {
    return;
  }
  
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

  // Handle price ranges specially ($10 - $20)
  const rangePattern = /\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*-\s*\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/g;
  let rangeMatch;
  while ((rangeMatch = rangePattern.exec(text)) !== null) {
    const fullMatch = rangeMatch[0];
    const minAmount = parseFloat(rangeMatch[1].replace(/,/g, ''));
    const maxAmount = parseFloat(rangeMatch[2].replace(/,/g, ''));
    const matchIndex = rangeMatch.index;
    
    // Add text before the match
    if (matchIndex > lastIndex) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex, matchIndex)));
    }
    
    // Convert both values
    const minSats = window.bitcoinAPI.usdToSats(minAmount, state.btcRate);
    const maxSats = window.bitcoinAPI.usdToSats(maxAmount, state.btcRate);
    const formattedMinSats = window.bitcoinAPI.formatSats(minSats);
    const formattedMaxSats = window.bitcoinAPI.formatSats(maxSats);
    
    const convertedSpan = document.createElement('span');
    convertedSpan.textContent = `${formattedMinSats} - ${formattedMaxSats}`;
    convertedSpan.setAttribute('style', config.convertedStyle);
    convertedSpan.setAttribute('data-original-usd', fullMatch);
    convertedSpan.setAttribute('data-sats-min-value', minSats);
    convertedSpan.setAttribute('data-sats-max-value', maxSats);
    convertedSpan.setAttribute('data-satsify-converted', 'true');
    convertedSpan.classList.add('satsify-converted');
    
    // Add hover events for tooltip
    convertedSpan.addEventListener('mouseenter', showTooltip);
    convertedSpan.addEventListener('mouseleave', hideTooltip);
    
    fragment.appendChild(convertedSpan);
    
    lastIndex = matchIndex + fullMatch.length;
  }

  // Process each pattern
  for (const regex of config.usdRegexPatterns) {
    // Skip the range pattern as we already processed it
    if (regex.toString() === rangePattern.toString()) continue;
    
    regex.lastIndex = 0; // Reset regex state
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      // Get the full match and the captured amount
      const fullMatch = match[0];
      const amount = match[1];
      const matchIndex = match.index;
      
      // Skip if this part was already processed by the range pattern
      let skipThisMatch = false;
      rangePattern.lastIndex = 0;
      while ((rangeMatch = rangePattern.exec(text)) !== null) {
        if (matchIndex >= rangeMatch.index && 
            matchIndex < rangeMatch.index + rangeMatch[0].length) {
          skipThisMatch = true;
          break;
        }
      }
      if (skipThisMatch) continue;
      
      // Add text before the match
      if (matchIndex > lastIndex) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex, matchIndex)));
      }
      
      // Create element for the converted amount
      const amountStr = amount.replace(/,/g, ''); // Remove commas
      const usdAmount = parseFloat(amountStr);
      if (!isNaN(usdAmount)) {
        const satsAmount = window.bitcoinAPI.usdToSats(usdAmount, state.btcRate);
        const formattedSats = window.bitcoinAPI.formatSats(satsAmount);
        
        const convertedSpan = document.createElement('span');
        convertedSpan.textContent = formattedSats;
        convertedSpan.setAttribute('style', config.convertedStyle);
        convertedSpan.setAttribute('data-original-usd', fullMatch);
        convertedSpan.setAttribute('data-sats-value', satsAmount);
        convertedSpan.setAttribute('data-satsify-converted', 'true');
        convertedSpan.classList.add('satsify-converted');
        
        // Add hover events for tooltip
        convertedSpan.addEventListener('mouseenter', showTooltip);
        convertedSpan.addEventListener('mouseleave', hideTooltip);
        
        fragment.appendChild(convertedSpan);
      } else {
        // If we couldn't parse the amount, just add the original text
        fragment.appendChild(document.createTextNode(fullMatch));
      }
      
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
    // Replace the original text node with our fragment
    try {
      textNode.parentNode.replaceChild(fragment, textNode);
    } catch (error) {
      console.error('Error replacing text node:', error);
    }
  }
}

// Restore original USD values on the page
function restoreOriginalValues() {
  // Restore standard converted elements
  const convertedElements = document.querySelectorAll('.satsify-converted, [data-satsify-converted="true"]');
  convertedElements.forEach(element => {
    try {
      // Check if it's a wrapper for a special element
      if (element.hasAttribute('data-original-html')) {
        const parent = element.parentNode;
        if (parent) {
          parent.innerHTML = element.getAttribute('data-original-html');
          state.convertedElements.delete(parent);
        }
      } else {
        // Standard text node replacement
        const originalUsd = element.getAttribute('data-original-usd');
        const textNode = document.createTextNode(originalUsd);
        element.parentNode.replaceChild(textNode, element);
      }
    } catch (error) {
      console.error('Error restoring original values:', error);
    }
  });
  
  // Reset our tracking maps
  state.convertedElements = new WeakMap();
  state.processedTextNodes = new WeakMap();
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
    
    let shouldProcess = false;
    
    // Check if any mutations are relevant
    for (const mutation of mutations) {
      // For content changes
      if (mutation.type === 'characterData') {
        // Skip if it already contains "sats"
        if (mutation.target.textContent && mutation.target.textContent.match(config.alreadyConvertedPattern)) {
          // Check if it's a duplicated conversion
          const duplicateMatch = mutation.target.textContent.match(/(\d+(\.\d+)?[KM]?\s*sats)\1/);
          if (duplicateMatch) {
            shouldProcess = true;
            break;
          }
          continue;
        }
        shouldProcess = true;
        break;
      }
      
      // For added nodes
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          // Skip text nodes with no content and non-element nodes except text
          if ((node.nodeType === Node.TEXT_NODE && node.textContent.trim() === '') ||
              (node.nodeType !== Node.TEXT_NODE && node.nodeType !== Node.ELEMENT_NODE)) {
            continue;
          }
          
          // Skip already converted elements
          if ((node.nodeType === Node.ELEMENT_NODE) && 
              (node.classList && node.classList.contains('satsify-converted') || 
              node.hasAttribute && node.hasAttribute('data-satsify-converted'))) {
            continue;
          }
          
          // Skip text that already contains "sats" unless it's a duplicate
          if (node.textContent && node.textContent.match(config.alreadyConvertedPattern)) {
            // Check if it's a duplicated conversion
            const duplicateMatch = node.textContent.match(/(\d+(\.\d+)?[KM]?\s*sats)\1/);
            if (duplicateMatch) {
              shouldProcess = true;
              break;
            }
            continue;
          }
          
          // Check if the node might contain price information
          if (node.nodeType === Node.ELEMENT_NODE) {
            // For Amazon specific elements
            if (state.pageType === 'amazon' && 
                (node.classList.contains('a-price') || 
                 node.classList.contains('a-color-price') || 
                 node.querySelector('.a-price, .a-color-price'))) {
              shouldProcess = true;
              break;
            }
            
            // For SaaS specific elements
            if (state.pageType === 'saas' && 
                (node.id.includes('price') || 
                 node.className.includes('price') || 
                 node.className.includes('pricing') ||
                 node.querySelector('[class*="price"], [class*="pricing"]'))) {
              shouldProcess = true;
              break;
            }
            
            // For Travel specific elements
            if (state.pageType === 'travel' && 
                (node.id.includes('price') || 
                 node.className.includes('price') || 
                 node.className.includes('fare') ||
                 node.className.includes('deal') ||
                 node.querySelector('[class*="price"], [class*="fare"], [class*="deal"]'))) {
              shouldProcess = true;
              break;
            }
          }
          
          // Check text content for price patterns in text nodes
          if (node.nodeType === Node.TEXT_NODE || node.textContent) {
            const text = node.textContent;
            for (const regex of config.usdRegexPatterns) {
              if (regex.test(text)) {
                shouldProcess = true;
                break;
              }
            }
            if (shouldProcess) break;
          }
        }
      }
      
      if (shouldProcess) break;
    }
    
    // Process mutations debounced to avoid excessive processing
    if (shouldProcess) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = setTimeout(() => {
        // Check for and fix any duplicate conversions first
        fixDuplicateConversions();
        
        // For special site types, first try the specialized selectors
        if (state.pageType === 'amazon' || state.pageType === 'saas' || state.pageType === 'travel') {
          processSpecialPageElements();
        }
        
        // Process added nodes
        mutations.forEach(mutation => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
              scanAndConvertTextNodes(node);
            });
          } else if (mutation.type === 'characterData') {
            convertTextNode(mutation.target);
          }
        });
      }, 300);
    }
  });

  // Start observing
  state.observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'display'] // Watch for changes to these attributes
  });
}

// Fix duplicate conversion issues like "10K sats10K sats"
function fixDuplicateConversions() {
  // Find text nodes that might have duplicate conversions
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Check if this text node has a duplicate conversion pattern
        if (node.textContent && node.textContent.match(/(\d+(\.\d+)?[KM]?\s*sats)\1/)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
    }
  );
  
  // Process and fix duplicate nodes
  let node;
  while (node = walker.nextNode()) {
    try {
      // Fix by replacing duplicated pattern with single instance
      node.textContent = node.textContent.replace(/(\d+(\.\d+)?[KM]?\s*sats)\1/g, '$1');
    } catch (error) {
      console.error('Error fixing duplicate conversion:', error);
    }
  }
  
  // Also check elements that might have duplicate conversions
  const elements = document.querySelectorAll('*');
  elements.forEach(element => {
    // Skip script and style elements
    if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') return;
    
    // Check if any direct text children have duplicate conversions
    for (const childNode of element.childNodes) {
      if (childNode.nodeType === Node.TEXT_NODE && 
          childNode.textContent && 
          childNode.textContent.match(/(\d+(\.\d+)?[KM]?\s*sats)\1/)) {
        try {
          childNode.textContent = childNode.textContent.replace(/(\d+(\.\d+)?[KM]?\s*sats)\1/g, '$1');
        } catch (error) {
          console.error('Error fixing duplicate conversion in element:', error);
        }
      }
    }
  });
}

// Set up message listener for popup communication
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'convertNow':
        // Clear any previously converted values to prevent duplication
        clearPreviousConversions();
        fixDuplicateConversions();
        convertUsdOnPage();
        sendResponse({ success: true });
        break;
        
      case 'toggleAutoConvert':
        state.autoConvert = message.enabled;
        if (state.autoConvert) {
          // Clear any previously converted values to prevent duplication
          clearPreviousConversions();
          fixDuplicateConversions();
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