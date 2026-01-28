# Content Security Policy (CSP) Requirements

## Overview

The Scenaro Widget SDK makes API calls from the **parent page** (not the iframe), so CSP rules must be configured on the parent page that loads the widget script.

## Required CSP Directives

### 1. `connect-src` (for API calls)

The widget fetches publication configuration from `api.scenaro.io`:

```http
Content-Security-Policy: connect-src 'self' https://api.scenaro.io;
```

Or if you need to allow multiple domains:

```http
Content-Security-Policy: connect-src 'self' https://api.scenaro.io https://cdn.scenaro.io;
```

### 2. `script-src` (for loading widget script)

If loading the widget script dynamically (though CSP usually blocks this):

```http
Content-Security-Policy: script-src 'self' https://cdn.scenaro.io;
```

**Note:** In most cases, the widget script is loaded via a `<script>` tag in the HTML, which is typically allowed by `'self'` or `'unsafe-inline'`.

### 3. `frame-src` or `child-src` (for iframe)

The widget creates an iframe to load the experience:

```http
Content-Security-Policy: frame-src 'self' https://cdn.scenaro.io https://*.scenaro.io;
```

Or more specifically:

```http
Content-Security-Policy: frame-src 'self' https://cdn.scenaro.io https://experiences.scenaro.io;
```

### 4. Complete Example

For a Magento site, a complete CSP header might look like:

```http
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.scenaro.io;
  connect-src 'self' https://api.scenaro.io;
  frame-src 'self' https://cdn.scenaro.io https://*.scenaro.io;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
```

## When API Calls Happen

### Current Implementation (Lazy Loading)

- **When:** API call happens when `Scenaro.open()` is called
- **Where:** Parent page context
- **CSP Rule Needed:** `connect-src` must include `https://api.scenaro.io`

### With Upfront Fetching (Proposed)

- **When:** API call happens after page load (in background)
- **Where:** Parent page context (same as current)
- **CSP Rule Needed:** Same - `connect-src` must include `https://api.scenaro.io`

**Important:** The CSP rule location doesn't change - it's always on the parent page, not the iframe.

## Magento Implementation

### Option 1: Via `.htaccess` (Apache)

```apache
<IfModule mod_headers.c>
  Header set Content-Security-Policy "connect-src 'self' https://api.scenaro.io; frame-src 'self' https://cdn.scenaro.io https://*.scenaro.io;"
</IfModule>
```

### Option 2: Via PHP Header

```php
header("Content-Security-Policy: connect-src 'self' https://api.scenaro.io; frame-src 'self' https://cdn.scenaro.io https://*.scenaro.io;");
```

### Option 3: Via Magento Admin Panel

If your Magento theme/extension supports CSP configuration, add:
- `connect-src`: `https://api.scenaro.io`
- `frame-src`: `https://cdn.scenaro.io https://*.scenaro.io`

### Option 4: Via Meta Tag (Less Secure)

```html
<meta http-equiv="Content-Security-Policy" content="connect-src 'self' https://api.scenaro.io; frame-src 'self' https://cdn.scenaro.io https://*.scenaro.io;">
```

## Testing CSP Rules

### Check Current CSP

```javascript
// In browser console
const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content 
  || document.querySelector('meta[http-equiv="content-security-policy"]')?.content
  || 'Not found in meta tags (check HTTP headers)';
console.log('CSP:', csp);
```

### Test API Call

```javascript
// Test if API call is allowed
fetch('https://api.scenaro.io/v1/public/publications/test')
  .then(r => console.log('✅ API call allowed'))
  .catch(e => console.error('❌ API call blocked:', e));
```

### Check Browser Console

If CSP blocks the request, you'll see errors like:
```
Refused to connect to 'https://api.scenaro.io/...' because it violates the following Content Security Policy directive: "connect-src 'self'"
```

## Troubleshooting

### Issue: API calls blocked

**Symptom:** Console shows CSP violation for `api.scenaro.io`

**Solution:** Add `https://api.scenaro.io` to `connect-src` directive

### Issue: Iframe blocked

**Symptom:** Widget iframe doesn't load

**Solution:** Add `https://cdn.scenaro.io` and/or iframe domain to `frame-src` directive

### Issue: Script loading blocked

**Symptom:** Widget script fails to load from CDN

**Solution:** Add `https://cdn.scenaro.io` to `script-src` directive (if loading dynamically)

## Security Considerations

1. **Be Specific:** Only allow the domains you need:
   - `api.scenaro.io` for API calls
   - `cdn.scenaro.io` for widget assets and iframe

2. **Avoid Wildcards:** Use specific domains instead of `*.scenaro.io` when possible

3. **Test in Production:** CSP rules can break functionality, test thoroughly

4. **Monitor Violations:** Use browser DevTools to monitor CSP violations

## Summary

- **CSP rules go on the parent page** (Magento site), not the iframe
- **Required directive:** `connect-src` must include `https://api.scenaro.io`
- **Also needed:** `frame-src` for iframe creation
- **Location doesn't change** whether using lazy or upfront fetching - API calls always happen in parent context
