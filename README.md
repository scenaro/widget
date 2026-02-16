# Scenaro Widget SDK

Widget SDK for embedding Scenaro experiences into websites.

cd widget-sdk/dist && npx serve -p 3333 -C

## Installation

Add the widget script to your HTML:

```html
<script 
  src="https://cdn.scenaro.io/widget.js" 
  data-publication-id="your-publication-id">
</script>
```

## Content Security Policy (CSP)

⚠️ **Important:** The widget makes API calls from the parent page context, so CSP rules must be configured on the parent page.

**Required CSP directives:**
- `connect-src`: Must include `https://api.scenaro.io` (for API calls)
- `frame-src`: Must include `https://cdn.scenaro.io` and iframe domains (for iframe creation)

See [CSP_REQUIREMENTS.md](./CSP_REQUIREMENTS.md) for detailed CSP configuration instructions.

## API Call Timing

### Current Implementation (Lazy Loading)

The widget fetches publication configuration from `api.scenaro.io` when `Scenaro.open()` is called:

```javascript
Scenaro.open(); // API call happens here
```

**Timeline:**
```
Page Load → Widget Script Loads → User Clicks → API Call → Iframe Created → Widget Opens
                                    ↑
                              Network delay here
```

### Considerations for Upfront Fetching

If implementing upfront fetching (prefetching config after page load):

- **Advantages:**
  - Faster widget opening (no network delay)
  - Early validation of publication ID
  - Better UX (instant open)

- **Trade-offs:**
  - API call even if widget never opened
  - Slightly higher initial page load cost

- **CSP Impact:** Same - CSP rules still needed on parent page (API calls always happen in parent context, not iframe)

## Usage

```javascript
// Open widget
Scenaro.open();

// Close widget
Scenaro.close();

// Listen to events
Scenaro.on('ready', () => {
  console.log('Widget is ready');
});

Scenaro.on('end', (data) => {
  console.log('Experience ended', data);
});

// Update metadata
Scenaro.updateMetadata({ language: 'fr' });
```

## Testing

See [TEST_CART_CRUD.md](./TEST_CART_CRUD.md) for testing cart CRUD operations in Magento.

## Documentation

- [CSP Requirements](./CSP_REQUIREMENTS.md) - Content Security Policy configuration
- [Test Cart CRUD](./TEST_CART_CRUD.md) - Testing guide for cart operations
