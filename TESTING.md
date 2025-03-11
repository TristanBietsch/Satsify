# Testing Guide for Satsify Chrome Extension

This document outlines testing procedures to ensure the Satsify extension works correctly.

## Manual Testing Checklist

### Installation Testing
- [ ] Extension installs without errors
- [ ] Extension icon appears in Chrome toolbar
- [ ] Clicking the icon shows the popup with all UI elements

### Basic Functionality
- [ ] Current BTC/USD rate displays in popup
- [ ] Last updated timestamp shows correctly
- [ ] Auto-convert toggle saves its state between browser sessions
- [ ] "Convert Now" button triggers conversion on the current page

### Price Conversion Testing
- [ ] Test conversion on pages with various USD formats:
  - [ ] $10.99
  - [ ] 10.99 USD
  - [ ] USD 10.99
  - [ ] 10.99 dollars
  - [ ] 10.99 US dollars
- [ ] Test with prices with commas (e.g., $1,299.99)
- [ ] Test with range prices (e.g., $10-$20)
- [ ] Verify conversion formula accuracy: `sats = usd_amount * 100,000,000 / btc_price_in_usd`

### Dynamic Content Testing
- [ ] Test on sites that load prices dynamically (e.g., infinite scrolling product listings)
- [ ] Test on sites that update prices with AJAX (e.g., shopping carts)
- [ ] Verify content loaded after initial page load gets converted

### Form Protection Testing
- [ ] Verify that prices in input fields are not converted
- [ ] Verify that prices in textareas are not converted
- [ ] Verify that prices in contenteditable elements are not converted

### Tooltip Testing
- [ ] Hover over converted prices shows original USD value in tooltip
- [ ] Tooltip positioning is correct and visible
- [ ] Tooltip disappears when mouse leaves the converted price

### API and Error Handling
- [ ] Test that the extension works when CoinGecko API is down (should use Coinbase backup)
- [ ] Test that the extension works when both APIs are down (should use cached values)
- [ ] Verify the extension doesn't make excessive API calls (check network tab)

### Performance Testing
- [ ] Extension doesn't noticeably slow down page loading
- [ ] Extension doesn't cause high CPU usage
- [ ] Test on pages with many prices (e.g., e-commerce category pages)

## Testing Environments

### Browser Versions
- [ ] Chrome latest stable version
- [ ] Chrome Canary (for future compatibility)

### Website Types to Test On
- [ ] E-commerce sites (Amazon, eBay, etc.)
- [ ] News sites with paywalls or subscription prices
- [ ] Food delivery sites with menu prices
- [ ] Travel booking sites with hotel/flight prices
- [ ] SaaS websites with pricing pages

## Bug Reporting

When reporting issues, please include:

1. Browser version
2. URL where the issue occurred
3. Steps to reproduce the issue
4. Expected vs. actual behavior
5. Screenshots if applicable
6. Any console errors (press F12 to open Developer Tools) 