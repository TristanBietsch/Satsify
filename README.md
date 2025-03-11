# Satsify Chrome Extension

A minimal Chrome extension that converts USD amounts on webpages to satoshis (sats).

## Features

- **Automatic Detection**: Detects USD amounts in various formats on web pages
- **Real-Time Conversion**: Converts USD to satoshis based on current Bitcoin exchange rates
- **Minimal UI**: Simple, user-friendly interface with only essential controls
- **Live Price Updates**: Fetches current Bitcoin prices from CoinGecko (with Coinbase as backup)
- **Tooltip Display**: Hover over converted amounts to see original USD values
- **Toggle Conversion**: Enable or disable automatic conversion with a simple switch
- **Manual Conversion**: "Convert Now" button for on-demand conversion

## Installation

### From Chrome Web Store
- Coming soon

### Manual Installation
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the `satsify` directory
5. The extension should now be installed and visible in your Chrome toolbar

## Usage

1. Click the Satsify icon in your Chrome toolbar to open the popup
2. Toggle "Auto-Convert USD to Sats" to enable automatic conversion on all web pages
3. Use the "Convert Now" button to manually convert USD amounts on the current page
4. Hover over converted amounts to see the original USD value

## How It Works

- Satsify scans web pages for text containing USD amounts in various formats
- It converts these amounts to satoshis using the formula: `sats = usd_amount * 100,000,000 / btc_price_in_usd`
- It replaces the original USD text with the satoshi amount, formatted for readability
- The extension avoids converting USD in input fields, textareas, or editable elements

## Privacy & Permissions

Satsify requires minimal permissions:
- `activeTab`: To detect and convert USD on the current webpage
- `storage`: To save your preferences and Bitcoin price data

The extension doesn't collect any personal data or browsing history.

## Development

### Project Structure
```
satsify/
├── manifest.json        # Extension configuration
├── popup/
│   ├── popup.html       # Simple popup interface
│   ├── popup.css        # Styling for popup
│   └── popup.js         # Popup functionality
├── scripts/
│   ├── content.js       # Main script for detecting and converting USD
│   └── bitcoin-api.js   # Functions for fetching BTC price data
├── background.js        # Background script for handling events
└── icons/
    ├── icon16.png       # Extension icons
    ├── icon48.png
    └── icon128.png
```

## License

This project is available under the MIT License.

## Contact

For support or contributions, please submit an issue or pull request on GitHub. 