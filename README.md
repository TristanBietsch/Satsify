# Satsify Chrome Extension for Amazon ⚡💰

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/yourusername/satsify/releases)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/yourusername/satsify/pulls)
[![Bitcoin](https://img.shields.io/badge/Bitcoin-Friendly-orange)](https://bitcoin.org)

A Chrome extension that converts Amazon product prices from USD to satoshis (sats). 🔄

## ✨ Features

- **🛍️ Amazon Integration**: Seamlessly converts prices on Amazon product pages
- **🔍 Smart Detection**: Accurately detects Amazon price formats and components
- **⚡ Real-Time Conversion**: Converts USD to satoshis based on current Bitcoin exchange rates
- **💻 Minimal UI**: Simple, user-friendly interface with only essential controls
- **📊 Live Price Updates**: Fetches current Bitcoin prices from CoinGecko (with Coinbase as backup)
- **💭 Tooltip Display**: Hover over converted amounts to see original USD values
- **🔄 Toggle Conversion**: Enable or disable automatic conversion with a simple switch
- **🖱️ Manual Conversion**: "Convert Now" button for on-demand conversion

## 🚀 Installation

### From Chrome Web Store
- 🔜 Coming soon

### Manual Installation
1. 📥 Download or clone this repository
2. 🌐 Open Chrome and navigate to `chrome://extensions/`
3. 👨‍💻 Enable "Developer mode" (toggle in the top-right corner)
4. 📁 Click "Load unpacked" and select the `satsify` directory
5. ✅ The extension should now be installed and visible in your Chrome toolbar

## 📖 Usage

1. 🌐 Visit any Amazon product page or search results
2. 🖱️ Click the Satsify icon in your Chrome toolbar to open the popup
3. 🔄 Toggle "Auto-Convert USD to Sats" to enable automatic conversion on Amazon
4. 👆 Use the "Convert Now" button to manually convert prices on the current page
5. 👀 Hover over converted amounts to see the original USD value

## ⚙️ How It Works

- 🔍 Satsify detects prices on Amazon pages using specialized selectors
- 🎯 It handles various Amazon price formats including:
  - Regular product prices
  - Deal prices
  - Price ranges
  - "List Price" and "Sale Price"
- 🧮 Converts prices to satoshis using the formula: `sats = usd_amount * 100,000,000 / btc_price_in_usd`
- 🔄 Replaces the original USD text with the satoshi amount, formatted for readability
- 🔒 Preserves Amazon's page functionality while providing Bitcoin-native prices

## 🔒 Privacy & Permissions

Satsify requires minimal permissions:
- `activeTab`: To detect and convert prices on Amazon pages
- `storage`: To save your preferences and Bitcoin price data
- `*://*.amazon.com/*`: To operate on Amazon domains

The extension doesn't collect any personal data or browsing history.

## 👨‍💻 Development

### Project Structure
```
satsify/
├── manifest.json        # Extension configuration
├── popup/
│   ├── popup.html       # Simple popup interface
│   ├── popup.css        # Styling for popup
│   └── popup.js         # Popup functionality
├── scripts/
│   ├── content.js       # Main script for Amazon price conversion
│   └── bitcoin-api.js   # Functions for fetching BTC price data
├── background.js        # Background script for handling events
└── icons/
    ├── icon16.png       # Extension icons
    ├── icon48.png
    └── icon128.png
```

## 📋 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/yourusername/satsify/issues)

## 📜 License

This project is available under the MIT License.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
