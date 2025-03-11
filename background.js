// Background service worker for Satsify extension

// Define constants
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Initialize the extension
async function init() {
  console.log('Satsify extension initialized');
  
  // Fetch initial Bitcoin price
  await updateBitcoinPrice();
  
  // Set up periodic price updates
  setInterval(updateBitcoinPrice, UPDATE_INTERVAL);
}

// Fetch and update the Bitcoin price
async function updateBitcoinPrice() {
  try {
    // Make a fetch request to CoinGecko API
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const data = await response.json();
    
    if (data && data.bitcoin && data.bitcoin.usd) {
      const btcPrice = data.bitcoin.usd;
      const timestamp = Date.now();
      
      // Save to Chrome storage
      await chrome.storage.local.set({ 
        btcRate: btcPrice,
        lastUpdated: timestamp
      });
      
      console.log(`Bitcoin price updated: $${btcPrice}`);
      return btcPrice;
    } else {
      throw new Error('Invalid response format from CoinGecko API');
    }
  } catch (error) {
    console.error('Error updating Bitcoin price:', error);
    
    // Try fallback API
    return await updateBitcoinPriceBackup();
  }
}

// Fallback method to fetch Bitcoin price
async function updateBitcoinPriceBackup() {
  try {
    const response = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot');
    const data = await response.json();
    
    if (data && data.data && data.data.amount) {
      const btcPrice = parseFloat(data.data.amount);
      const timestamp = Date.now();
      
      // Save to Chrome storage
      await chrome.storage.local.set({ 
        btcRate: btcPrice,
        lastUpdated: timestamp
      });
      
      console.log(`Bitcoin price updated from backup: $${btcPrice}`);
      return btcPrice;
    } else {
      throw new Error('Invalid response format from backup API');
    }
  } catch (error) {
    console.error('Error updating Bitcoin price from backup API:', error);
    
    // Return cached price or default
    return getCachedBitcoinPrice();
  }
}

// Get cached Bitcoin price
async function getCachedBitcoinPrice() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['btcRate'], (result) => {
      const price = result.btcRate || 50000; // Default to 50,000 if no cached value
      resolve(price);
    });
  });
}

// Set up message listeners
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fetchBtcRate') {
    // Fetch the latest Bitcoin price
    updateBitcoinPrice()
      .then(btcRate => {
        sendResponse({ btcRate });
      })
      .catch(error => {
        console.error('Error handling fetchBtcRate message:', error);
        // Fall back to cached rate
        getCachedBitcoinPrice().then(cachedRate => {
          sendResponse({ btcRate: cachedRate });
        });
      });
    
    return true; // Keep the message channel open for async response
  }
});

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  init();
});

// Initialize the service worker
init(); 