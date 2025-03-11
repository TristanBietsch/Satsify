// Bitcoin API utilities

/**
 * Fetch the current Bitcoin price in USD from CoinGecko API
 * @returns {Promise<number>} The current BTC price in USD
 */
async function fetchBitcoinPrice() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const data = await response.json();
    
    if (data && data.bitcoin && data.bitcoin.usd) {
      return data.bitcoin.usd;
    } else {
      throw new Error('Invalid response format from CoinGecko API');
    }
  } catch (error) {
    console.error('Error fetching Bitcoin price:', error);
    
    // Fallback to backup API if CoinGecko fails
    return fetchBitcoinPriceBackup();
  }
}

/**
 * Backup method to fetch Bitcoin price from Coinbase API
 * @returns {Promise<number>} The current BTC price in USD
 */
async function fetchBitcoinPriceBackup() {
  try {
    const response = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot');
    const data = await response.json();
    
    if (data && data.data && data.data.amount) {
      return parseFloat(data.data.amount);
    } else {
      throw new Error('Invalid response format from Coinbase API');
    }
  } catch (error) {
    console.error('Error fetching Bitcoin price from backup API:', error);
    
    // If all APIs fail, return cached price or a reasonable default
    return getCachedBitcoinPrice();
  }
}

/**
 * Get cached Bitcoin price from Chrome storage
 * @returns {Promise<number>} The cached BTC price or default value
 */
function getCachedBitcoinPrice() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['btcRate'], (result) => {
      // Return cached value or default to a reasonable value if nothing is cached
      resolve(result.btcRate || 50000); // Default to 50,000 if no cached value
    });
  });
}

/**
 * Update Bitcoin price in cache
 * @returns {Promise<number>} The updated BTC price
 */
async function updateBitcoinPrice() {
  try {
    const price = await fetchBitcoinPrice();
    const timestamp = Date.now();
    
    // Save to Chrome storage
    await chrome.storage.local.set({ 
      btcRate: price,
      lastUpdated: timestamp
    });
    
    return price;
  } catch (error) {
    console.error('Failed to update Bitcoin price:', error);
    return getCachedBitcoinPrice();
  }
}

/**
 * Convert USD amount to satoshis
 * @param {number} usdAmount - Amount in USD
 * @param {number} btcPrice - Current BTC price in USD
 * @returns {number} Amount in satoshis
 */
function usdToSats(usdAmount, btcPrice) {
  // 1 BTC = 100,000,000 satoshis
  return Math.round((usdAmount * 100000000) / btcPrice);
}

/**
 * Format satoshi amount for display
 * @param {number} sats - Amount in satoshis
 * @returns {string} Formatted satoshi amount
 */
function formatSats(sats) {
  if (sats >= 1000000) {
    return `${(sats / 1000000).toFixed(1)}M sats`;
  } else if (sats >= 1000) {
    return `${(sats / 1000).toFixed(1)}K sats`;
  } else {
    return `${sats} sats`;
  }
}

// Export functions for use in other scripts
window.bitcoinAPI = {
  fetchBitcoinPrice,
  updateBitcoinPrice,
  usdToSats,
  formatSats,
  getCachedBitcoinPrice
}; 