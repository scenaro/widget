# Test Cart CRUD in Magento Browser Console

## Important: Content Security Policy (CSP) Note

⚠️ **If you encounter CSP errors**, the Magento site's Content Security Policy may block loading scripts from `cdn.scenaro.io`. 

**Solutions:**
1. **If the widget is already loaded on the page** (via a script tag in the HTML), skip the loading step and go directly to testing
2. **Use browser DevTools** to temporarily disable CSP (Chrome: DevTools → Settings → Disable cache + Network conditions)
3. **Add the script tag manually** to the page HTML via DevTools Elements panel
4. **Use a browser extension** that can bypass CSP (for testing only)

## Test Snippet for Magento Website Console

This snippet loads the Widget SDK from CDN and tests cart CRUD operations via postMessage (simulating iframe communication).

**If CSP blocks the script loading**, the snippet will detect if the widget is already loaded and proceed with testing.

Copy and paste this snippet into the browser console on a Magento website (not in the iframe):

```javascript
// Test Cart CRUD functionality via Widget SDK postMessage
(async function() {
  console.log('🧪 Testing Magento Cart CRUD via Widget SDK...\n');

  // Step 1: Load the widget SDK from CDN (or use if already loaded)
  async function loadWidgetSDK() {
    // Check if already loaded
    if (window.Scenaro && window.Scenaro._initialized) {
      console.log('✅ Widget SDK already loaded on page');
      return Promise.resolve();
    }

    console.log('📦 Attempting to load widget SDK from https://cdn.scenaro.io/widget.js...');
    console.log('⚠️  Note: CSP may block this. If it fails, the widget may already be loaded via script tag in the page.');
    
    return new Promise((resolve, reject) => {
      try {
        const script = document.createElement('script');
        script.src = 'https://cdn.scenaro.io/widget.js';
        script.onload = () => {
          console.log('✅ Widget SDK loaded');
          setTimeout(() => {
            if (window.Scenaro) {
              console.log('✅ Widget SDK initialized');
              resolve();
            } else {
              reject(new Error('Widget SDK failed to initialize'));
            }
          }, 500);
        };
        script.onerror = () => {
          console.warn('⚠️  Failed to load widget SDK from CDN (likely CSP blocked)');
          console.log('💡 Checking if widget is already loaded on the page...');
          
          // Check again after a moment (maybe it's loading via another method)
          setTimeout(() => {
            if (window.Scenaro && window.Scenaro._initialized) {
              console.log('✅ Widget SDK found on page (loaded via script tag)');
              resolve();
            } else {
              reject(new Error('Widget SDK not found. CSP may be blocking. Try adding the script tag manually or check if widget is already in page HTML.'));
            }
          }, 1000);
        };
        document.head.appendChild(script);
      } catch (error) {
        console.warn('⚠️  Error creating script tag:', error);
        // Check if widget is already available
        if (window.Scenaro && window.Scenaro._initialized) {
          console.log('✅ Widget SDK found on page');
          resolve();
        } else {
          reject(new Error('CSP blocked script loading. Widget SDK must be loaded via script tag in page HTML.'));
        }
      }
    });
  }

  // Step 2: Setup message listener to capture cart responses
  function setupResponseListener() {
    return new Promise((resolve) => {
      const pendingRequests = new Map();
      
      // Listen for cart responses from the widget
      window.addEventListener('message', (event) => {
        // Only process messages that look like cart responses
        if (event.data && event.data.type === 'SCENARO_CART_RESPONSE') {
          const { requestId, success, data, error } = event.data;
          
          if (pendingRequests.has(requestId)) {
            const { resolve: resolveRequest } = pendingRequests.get(requestId);
            pendingRequests.delete(requestId);
            resolveRequest({ success, data, error });
          }
        }
      });

      // Generate request ID
      function generateRequestId() {
        return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      // Send cart request via postMessage (simulating iframe sending to parent)
      function sendCartRequest(type, data = null) {
        return new Promise((resolve, reject) => {
          const requestId = generateRequestId();
          pendingRequests.set(requestId, { resolve, reject });

          // Find the scenaro iframe (created by the widget)
          const scenaroIframe = document.getElementById('scenaro-iframe');
          if (!scenaroIframe || !scenaroIframe.contentWindow) {
            reject(new Error('Scenaro iframe not found. Make sure to call Scenaro.open() first.'));
            return;
          }

          // Send message from iframe to parent (simulating what the iframe would do)
          // We need to dispatch the message event as if it came from the iframe
          const messageEvent = new MessageEvent('message', {
            data: {
              type,
              requestId,
              ...(data && { data })
            },
            origin: window.location.origin,
            source: scenaroIframe.contentWindow
          });

          // Trigger the widget's message handler
          window.dispatchEvent(messageEvent);

          // Also send directly to the widget's handleMessage (if accessible)
          // Actually, the widget listens on window, so we can just postMessage from iframe
          // But we're in the parent, so we need to simulate it differently
          
          // Better approach: send message from iframe's contentWindow
          // But we need to inject code into the iframe to send the message
          const iframeDoc = scenaroIframe.contentDocument || scenaroIframe.contentWindow.document;
          if (iframeDoc && iframeDoc.readyState === 'complete') {
            // Send message from iframe to parent
            scenaroIframe.contentWindow.postMessage({
              type,
              requestId,
              ...(data && { data })
            }, '*');
          } else {
            // Iframe not ready, wait a bit
            scenaroIframe.onload = () => {
              scenaroIframe.contentWindow.postMessage({
                type,
                requestId,
                ...(data && { data })
              }, '*');
            };
          }

          // Timeout after 10 seconds
          setTimeout(() => {
            if (pendingRequests.has(requestId)) {
              pendingRequests.delete(requestId);
              reject(new Error('Request timeout'));
            }
          }, 10000);
        });
      }

      resolve({ sendCartRequest });
    });
  }

  // Main test function
  async function runTests() {
    try {
      // Load widget SDK
      await loadWidgetSDK();

      // Setup message listener
      const { sendCartRequest } = await setupResponseListener();

      // Expose test functions
      window.testCartCRUD = {
        // List cart
        list: async () => {
          console.log('📋 Test: Listing cart...');
          try {
            const result = await sendCartRequest('SCENARO_CART_LIST_REQUEST');
            if (result.success) {
              console.log('✅ Cart data:', result.data);
              console.log('   Items:', result.data?.items?.length || 0);
              console.log('   Summary count:', result.data?.summary_count || 0);
            } else {
              console.error('❌ Error:', result.error);
            }
            return result;
          } catch (error) {
            console.error('❌ Failed:', error);
            throw error;
          }
        },

        // Add product
        add: async (productId, qty = 1) => {
          console.log(`➕ Test: Adding product ${productId} (qty: ${qty})...`);
          try {
            const result = await sendCartRequest('SCENARO_CART_ADD_REQUEST', {
              productId,
              qty
            });
            if (result.success) {
              console.log('✅ Product added successfully');
              console.log('   Updated cart:', result.data);
            } else {
              console.error('❌ Error:', result.error);
            }
            return result;
          } catch (error) {
            console.error('❌ Failed:', error);
            throw error;
          }
        },

        // Update item
        update: async (itemId, qty) => {
          console.log(`✏️  Test: Updating item ${itemId} to qty ${qty}...`);
          try {
            const result = await sendCartRequest('SCENARO_CART_UPDATE_REQUEST', {
              itemId,
              qty
            });
            if (result.success) {
              console.log('✅ Item updated successfully');
              console.log('   Updated cart:', result.data);
            } else {
              console.error('❌ Error:', result.error);
            }
            return result;
          } catch (error) {
            console.error('❌ Failed:', error);
            throw error;
          }
        },

        // Remove item
        remove: async (itemId) => {
          console.log(`🗑️  Test: Removing item ${itemId}...`);
          try {
            const result = await sendCartRequest('SCENARO_CART_REMOVE_REQUEST', {
              itemId
            });
            if (result.success) {
              console.log('✅ Item removed successfully');
              console.log('   Updated cart:', result.data);
            } else {
              console.error('❌ Error:', result.error);
            }
            return result;
          } catch (error) {
            console.error('❌ Failed:', error);
            throw error;
          }
        },

        // Clear cart
        clear: async () => {
          console.log('🧹 Test: Clearing cart...');
          try {
            const result = await sendCartRequest('SCENARO_CART_CLEAR_REQUEST');
            if (result.success) {
              console.log('✅ Cart cleared successfully');
            } else {
              console.error('❌ Error:', result.error);
            }
            return result;
          } catch (error) {
            console.error('❌ Failed:', error);
            throw error;
          }
        }
      };

      console.log('\n✅ Test functions ready!');
      console.log('   Usage:');
      console.log('   1. Open widget: Scenaro.open()');
      console.log('   2. Wait a moment for iframe to be ready');
      console.log('   3. Test operations:');
      console.log('      await window.testCartCRUD.list()');
      console.log('      await window.testCartCRUD.add(productId, qty)');
      console.log('      await window.testCartCRUD.update(itemId, qty)');
      console.log('      await window.testCartCRUD.remove(itemId)');
      console.log('      await window.testCartCRUD.clear()\n');

    } catch (error) {
      console.error('❌ Setup failed:', error);
    }
  }

  // Run setup
  await runTests();
})();
```

## Alternative: Test Without Loading (If Widget Already on Page)

If the widget SDK is already loaded on the page (via a `<script>` tag in the HTML), use this simpler version:

```javascript
// Test Cart CRUD - Widget already loaded on page
(function() {
  if (!window.Scenaro) {
    console.error('❌ Widget SDK not found. Make sure it\'s loaded on the page.');
    return;
  }

  console.log('✅ Widget SDK found, setting up tests...\n');

  const pendingRequests = new Map();

  // Listen for responses
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'SCENARO_CART_RESPONSE') {
      const { requestId, success, data, error } = e.data;
      if (pendingRequests.has(requestId)) {
        pendingRequests.get(requestId).resolve({ success, data, error });
        pendingRequests.delete(requestId);
      }
    }
  });

  function sendRequest(type, data) {
    return new Promise((resolve, reject) => {
      const requestId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      pendingRequests.set(requestId, { resolve, reject });
      const iframe = document.getElementById('scenaro-iframe');
      if (!iframe?.contentWindow) {
        reject(new Error('Call Scenaro.open() first'));
        return;
      }
      iframe.contentWindow.postMessage({ type, requestId, ...(data && { data }) }, '*');
      setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          pendingRequests.delete(requestId);
          reject(new Error('Timeout'));
        }
      }, 10000);
    });
  }

  window.testCartCRUD = {
    list: () => sendRequest('SCENARO_CART_LIST_REQUEST').then(r => (console.log('📋 Cart:', r.data), r)),
    add: (id, qty = 1) => sendRequest('SCENARO_CART_ADD_REQUEST', { productId: id, qty }).then(r => (console.log('➕ Added:', r.data), r)),
    update: (itemId, qty) => sendRequest('SCENARO_CART_UPDATE_REQUEST', { itemId, qty }).then(r => (console.log('✏️ Updated:', r.data), r)),
    remove: (itemId) => sendRequest('SCENARO_CART_REMOVE_REQUEST', { itemId }).then(r => (console.log('🗑️ Removed:', r.data), r)),
    clear: () => sendRequest('SCENARO_CART_CLEAR_REQUEST').then(r => (console.log('🧹 Cleared'), r))
  };

  console.log('✅ Ready! Use:');
  console.log('  Scenaro.open()');
  console.log('  await window.testCartCRUD.list()');
  console.log('  await window.testCartCRUD.add(productId, qty)');
})();
```

## Simplified Test Approach (Recommended)

Here's a simpler, working approach that loads the SDK and tests via postMessage:

```javascript
// Test Cart CRUD via Widget SDK - Simplified Version
(async function() {
  console.log('🧪 Testing Cart CRUD via Widget SDK...\n');

  // Step 1: Load widget SDK from CDN (or use if already loaded)
  if (!window.Scenaro) {
    console.log('📦 Attempting to load widget SDK from https://cdn.scenaro.io/widget.js...');
    console.log('⚠️  Note: CSP may block this. If it fails, check if widget is already in page HTML.');
    
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.scenaro.io/widget.js';
        script.onload = () => {
          setTimeout(() => {
            if (window.Scenaro) {
              console.log('✅ Widget SDK loaded and initialized');
              resolve();
            } else {
              reject(new Error('Widget SDK failed to initialize'));
            }
          }, 500);
        };
        script.onerror = () => {
          console.warn('⚠️  Script load failed (likely CSP blocked)');
          console.log('💡 Checking if widget is already on page...');
          setTimeout(() => {
            if (window.Scenaro) {
              console.log('✅ Widget SDK found on page');
              resolve();
            } else {
              reject(new Error('CSP blocked. Widget must be loaded via script tag in page HTML.'));
            }
          }, 1000);
        };
        document.head.appendChild(script);
      });
    } catch (error) {
      if (window.Scenaro) {
        console.log('✅ Widget SDK found on page (loaded via script tag)');
      } else {
        throw error;
      }
    }
  } else {
    console.log('✅ Widget SDK already loaded');
  }

  // Step 2: Setup response listener and test functions
  const pendingRequests = new Map();

  // Listen for cart responses from widget
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'SCENARO_CART_RESPONSE') {
      const { requestId, success, data, error } = event.data;
      if (pendingRequests.has(requestId)) {
        const { resolve } = pendingRequests.get(requestId);
        pendingRequests.delete(requestId);
        resolve({ success, data, error });
      }
    }
  });

  // Function to send cart request (simulating iframe sending to parent)
  function sendCartRequest(type, data = null) {
    return new Promise((resolve, reject) => {
      const requestId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      pendingRequests.set(requestId, { resolve, reject });

      // Get the scenaro iframe
      const iframe = document.getElementById('scenaro-iframe');
      if (!iframe || !iframe.contentWindow) {
        reject(new Error('Scenaro iframe not found. Please call Scenaro.open() first.'));
        return;
      }

      // Send message from iframe to parent (this is what the widget listens for)
      // We need to inject code into the iframe to send the message
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc && iframeDoc.readyState === 'complete') {
          // Iframe is ready, send message
          iframe.contentWindow.postMessage({
            type,
            requestId,
            ...(data && { data })
          }, '*');
        } else {
          // Wait for iframe to load
          iframe.onload = () => {
            iframe.contentWindow.postMessage({
              type,
              requestId,
              ...(data && { data })
            }, '*');
          };
          // If already loaded but doc not ready, try anyway
          iframe.contentWindow.postMessage({
            type,
            requestId,
            ...(data && { data })
          }, '*');
        }
      } catch (e) {
        // Cross-origin iframe, use postMessage directly
        iframe.contentWindow.postMessage({
          type,
          requestId,
          ...(data && { data })
        }, '*');
      }

      // Timeout after 10 seconds
      setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  // Expose test functions
  window.testCartCRUD = {
    list: async () => {
      console.log('📋 Testing: List cart...');
      const result = await sendCartRequest('SCENARO_CART_LIST_REQUEST');
      if (result.success) {
        console.log('✅ Cart:', result.data);
        console.log('   Items:', result.data?.items?.length || 0);
      } else {
        console.error('❌ Error:', result.error);
      }
      return result;
    },
    add: async (productId, qty = 1) => {
      console.log(`➕ Testing: Add product ${productId} (qty: ${qty})...`);
      const result = await sendCartRequest('SCENARO_CART_ADD_REQUEST', { productId, qty });
      if (result.success) {
        console.log('✅ Added:', result.data);
      } else {
        console.error('❌ Error:', result.error);
      }
      return result;
    },
    update: async (itemId, qty) => {
      console.log(`✏️  Testing: Update item ${itemId} to qty ${qty}...`);
      const result = await sendCartRequest('SCENARO_CART_UPDATE_REQUEST', { itemId, qty });
      if (result.success) {
        console.log('✅ Updated:', result.data);
      } else {
        console.error('❌ Error:', result.error);
      }
      return result;
    },
    remove: async (itemId) => {
      console.log(`🗑️  Testing: Remove item ${itemId}...`);
      const result = await sendCartRequest('SCENARO_CART_REMOVE_REQUEST', { itemId });
      if (result.success) {
        console.log('✅ Removed:', result.data);
      } else {
        console.error('❌ Error:', result.error);
      }
      return result;
    },
    clear: async () => {
      console.log('🧹 Testing: Clear cart...');
      const result = await sendCartRequest('SCENARO_CART_CLEAR_REQUEST');
      if (result.success) {
        console.log('✅ Cleared');
      } else {
        console.error('❌ Error:', result.error);
      }
      return result;
    }
  };

  console.log('\n✅ Test functions ready!');
  console.log('   Steps:');
  console.log('   1. Open widget: Scenaro.open()');
  console.log('   2. Wait a moment for iframe to initialize');
  console.log('   3. Test:');
  console.log('      await window.testCartCRUD.list()');
  console.log('      await window.testCartCRUD.add(productId, qty)');
  console.log('      await window.testCartCRUD.update(itemId, qty)');
  console.log('      await window.testCartCRUD.remove(itemId)');
  console.log('      await window.testCartCRUD.clear()\n');
})();
```

## Usage Steps

1. **Load the test snippet** (copy/paste into console)
2. **Open the widget**: `Scenaro.open()`
3. **Wait a moment** for the iframe to initialize
4. **Test operations**:
   ```javascript
   // List cart
   await window.testCartCRUD.list();
   
   // Add product (replace 123 with actual product ID)
   await window.testCartCRUD.add(123, 2);
   
   // Update item (replace 'itemId' with actual item_id from cart)
   await window.testCartCRUD.update('itemId', 3);
   
   // Remove item
   await window.testCartCRUD.remove('itemId');
   
   // Clear cart
   await window.testCartCRUD.clear();
   ```

## Notes

- Make sure you're on a Magento website (not in an iframe)
- **CSP Issues**: If Content Security Policy blocks loading the script, you have options:
  1. The widget may already be loaded via a `<script>` tag in the page HTML - check the page source
  2. Use the "Alternative: Test Without Loading" snippet above if widget is already on page
  3. Temporarily disable CSP in browser DevTools (Chrome: Settings → Disable cache)
  4. Manually add the script tag to the page HTML via DevTools Elements panel
- The widget SDK is loaded from `https://cdn.scenaro.io/widget.js` (if not already on page)
- You need to call `Scenaro.open()` first to create the iframe
- The test simulates postMessage communication between iframe and parent
- All operations are async, so use `await` or `.then()` when calling them

## Manual Script Tag Addition (If CSP Blocks)

If CSP blocks the script loading, you can manually add it via DevTools:

1. Open DevTools (F12)
2. Go to Elements/Inspector tab
3. Find the `<head>` tag
4. Right-click → Edit as HTML
5. Add: `<script src="https://cdn.scenaro.io/widget.js"></script>`
6. Press Enter to save
7. Then run the test snippet (it will detect the widget is loaded)
