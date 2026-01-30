import { CapabilityRequest, CapabilityResponse, CartRequest, ScenaroEventPayload, ScenaroOpenConfig } from './types';

class ScenaroWidget {
  private publicationId: string = '';
  private iframe: HTMLIFrameElement | null = null;
  private engine: any = null; // Typed as any because it might be loaded dynamically
  private listeners: Map<string, Function[]> = new Map();
  private metadata: Record<string, any> = {};

  constructor() {
    // Prevent double initialization
    if ((window as any).Scenaro?._initialized) {
      console.warn('[Scenaro] Widget already initialized, skipping duplicate initialization');
      return;
    }

    this.publicationId = this.detectConfig();
    this.init();
    // Mark as initialized
    (window as any).Scenaro._initialized = true;
  }

  private detectConfig(): string {
    // Find the script tag that loaded this widget
    // data-publication-id contains the publication ID
    const scripts = document.getElementsByTagName('script');
    let publicationId = '';
    
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      if (script.dataset.publicationId && script.dataset.publicationId !== '') {
        publicationId = script.dataset.publicationId;
        break;
      }
    }
    if (!publicationId) {
      console.warn('[Scenaro] No data-publication-id found. Please ensure the data-publication-id attribute is set on the script tag.');
    }

    return publicationId;
  }


  private init() {
    // Expose global API
    (window as any).Scenaro = {
      open: this.open.bind(this),
      close: this.close.bind(this),
      on: this.on.bind(this),
      off: this.off.bind(this),
      updateMetadata: this.updateMetadata.bind(this),
    };

    // Listen for messages from Iframe
    window.addEventListener('message', this.handleMessage.bind(this));
    
    // Listen for language changes
    window.addEventListener('languageChanged', () => {
      this.handleLanguageChange();
    });
  }

  public async open(config?: ScenaroOpenConfig) {
    if (this.iframe) return; // Already open

    // Store metadata if provided
    if (config?.metadata) {
      this.metadata = { ...this.metadata, ...config.metadata };
    }

    // Emit 'open' event
    this.emit('open');

    await this.createIframe();
    await this.loadEngine();
  }

  public close() {
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
      // Emit 'close' event
      this.emit('close');
    }
  }

  public on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
    console.log(`[Scenaro] Registered listener for ${event}`);
  }

  public off(event: string, callback: Function) {
      if (!this.listeners.has(event)) return;
      
      const callbacks = this.listeners.get(event);
      if (callbacks) {
          const index = callbacks.indexOf(callback);
          if (index !== -1) {
              callbacks.splice(index, 1);
          }
      }
  }

  private emit(event: string, data?: any) {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
          callbacks.forEach(cb => cb(data));
      }
  }

  private detectCMS(): string | null {
    // Simple CMS detection - can be extended later
    if (typeof window !== 'undefined' && (window as any).requirejs) {
      // Very rough heuristic for Magento 2
      return 'magento';
    }
    return null;
  }

  private async loadAdapter(adapterName: string): Promise<void> {
    if (!this.publicationId) {
      console.warn('[Scenaro] No publication ID available, cannot load adapter');
      return;
    }

    const cdnBaseUrl = this.getCDNBaseUrl();
    const engineName = 'commerce'; // Default to commerce for now

    try {
      // Load connector
      const connectorUrl = `${cdnBaseUrl}/connectors/${adapterName}.js`;
      await import(connectorUrl);
      console.log(`[Scenaro] Loaded connector: ${adapterName}`);

      // Load engine
      const engineUrl = `${cdnBaseUrl}/engines/${engineName}.js`;
      const engineModule = await import(engineUrl);
      const EngineClass = engineModule[`${engineName.charAt(0).toUpperCase() + engineName.slice(1)}Engine`];

      if (!EngineClass) {
        console.error(`[Scenaro] Engine class not found: ${engineName}`);
        return;
      }

      this.engine = new EngineClass();

      if (this.iframe) {
        this.engine.setIframe(this.iframe);
      }

      await this.engine.initialize(this.publicationId);
    } catch (error) {
      console.error(`[Scenaro] Failed to load adapter ${adapterName}:`, error);
    }
  }

  private async handleCapabilityRequest(payload: CapabilityRequest): Promise<void> {
    // Resolve adapter: use payload.adapter hint or detect CMS
    const adapter = payload.adapter || this.detectCMS();

    const capabilities: Record<string, boolean> = {};

    // For each requested capability, try to load and mark as available
    for (const capability of payload.capabilities) {
      if (capability === 'cart' && adapter) {
        try {
          await this.loadAdapter(adapter);
          capabilities.cart = true;
        } catch (error) {
          console.warn(`[Scenaro] Failed to load cart capability with adapter ${adapter}:`, error);
          capabilities.cart = false;
        }
      } else {
        capabilities[capability] = false; // Unknown capability or no adapter
      }
    }

    // Send response to iframe
    const response: CapabilityResponse = {
      type: 'SCENARO_CAPABILITY_RESPONSE',
      requestId: payload.requestId,
      capabilities
    };

    if (this.iframe && this.iframe.contentWindow) {
      this.iframe.contentWindow.postMessage(response, '*');
    }
  }

  private async createIframe() {
    const iframe = document.createElement('iframe');
    iframe.id = 'scenaro-iframe';

    if (!this.publicationId) {
      console.warn('[Scenaro] No publication ID available, cannot create iframe');
      return;
    }

    // Build stable embed URL (CloudFront rewrites /{uuid} to API path)
    const baseUrl = `https://embed.scenaro.io/${this.publicationId}`;
    const url = new URL(baseUrl);

    // Add language from metadata if available
    if (this.metadata.language) {
      url.searchParams.append('language', this.metadata.language);
    }

    iframe.src = url.toString();
    iframe.allow = "microphone *; autoplay *";
    iframe.style.border = 'none';
    iframe.style.zIndex = '2147483647';
    
    // Append to container or body
    const container = document.getElementById('scenaro-container');
    if (container) {
      Object.assign(iframe.style, { width: '100%', height: '100%', display: 'block' });
      container.appendChild(iframe);
    } else {
      Object.assign(iframe.style, { position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh' });
      document.body.appendChild(iframe);
    }
    
    this.iframe = iframe;
  }

  private async loadEngine() {
      if (!this.publicationId) {
          console.warn('[Scenaro] No publication ID available, cannot load engine');
          return;
      }

      // Default to 'commerce' engine
      const engineName = 'commerce';
      
      try {
          // Determine CDN base URL from current script location or use default
          const cdnBaseUrl = this.getCDNBaseUrl();
          
          // Load engine from CDN using absolute URL
          const engineUrl = `${cdnBaseUrl}/engines/${engineName}.js`;
          const engineModule = await import(engineUrl);
          const EngineClass = engineModule[`${engineName.charAt(0).toUpperCase() + engineName.slice(1)}Engine`];
          
          if (!EngineClass) {
              console.error(`[Scenaro] Engine class not found: ${engineName}`);
              return;
          }
          
          this.engine = new EngineClass();
          
          // Load connector based on CMS detection
          const adapter = this.detectCMS();
          if (adapter) {
              try {
                  const connectorUrl = `${cdnBaseUrl}/connectors/${adapter}.js`;
                  await import(connectorUrl);
                  // Connectors are typically used by engines, so we pass them during engine initialization
                  // The engine will handle connector setup
                  console.log(`[Scenaro] Loaded connector: ${adapter}`);
              } catch (error) {
                  console.warn(`[Scenaro] Failed to load connector ${adapter}:`, error);
              }
          }
          
          if (this.iframe) {
              this.engine.setIframe(this.iframe);
          }
          
          await this.engine.initialize(this.publicationId);
      } catch (error) {
          console.error(`[Scenaro] Failed to load engine ${engineName}:`, error);
      }
  }

  private getCDNBaseUrl(): string {
      // Try to detect CDN URL from the script tag that loaded the widget
      const scripts = document.getElementsByTagName('script');
      for (let i = 0; i < scripts.length; i++) {
          const script = scripts[i];
          if (script.src && (script.src.includes('widget.js') || script.src.includes('widget.cjs'))) {
              // Extract base URL from script src (e.g., https://cdn.scenaro.io/widget.js -> https://cdn.scenaro.io)
              try {
                  const url = new URL(script.src);
                  return `${url.protocol}//${url.host}`;
              } catch (e) {
                  // Fallback to default
              }
          }
      }
      // Default fallback
      return 'https://cdn.scenaro.io';
  }

  private handleMessage(event: MessageEvent) {
      // Security check: in production, check event.origin against allowed origins
      
      const payload = event.data as ScenaroEventPayload;

      // Check if this is a capability request
      if (payload.type === 'SCENARO_CAPABILITY_REQUEST') {
          this.handleCapabilityRequest(payload as CapabilityRequest);
          return;
      }

      // Check if this is a cart CRUD request
      const cartRequestTypes = [
          'SCENARO_CART_LIST_REQUEST',
          'SCENARO_CART_ADD_REQUEST',
          'SCENARO_CART_UPDATE_REQUEST',
          'SCENARO_CART_REMOVE_REQUEST',
          'SCENARO_CART_CLEAR_REQUEST'
      ];
      
      if (cartRequestTypes.includes(payload.type)) {
          const cartPayload = payload as CartRequest;
          // Forward cart request to engine; if engine not ready, send error response so iframe does not timeout
          if (this.engine && typeof this.engine.handleCartRequest === 'function') {
              this.engine.handleCartRequest(cartPayload);
          } else {
              console.warn('[Scenaro] Engine does not support cart requests');
              this.sendCartErrorToIframe(cartPayload.requestId, 'Cart engine not ready');
          }
          return;
      }
      
      switch (payload.type) {
          case 'SCENARO_READY':
              console.log('[Scenaro] Iframe is ready');
              this.emit('ready');
              // Send metadata to iframe when it's ready
              this.sendMetadataToIframe();
              if (this.engine) {
                  this.engine.connect();
              }
              break;
          case 'SCENARO_END':
              this.emit('end', payload.data);
              if (this.engine) {
                  this.engine.onEnd();
              }
              this.close();
              break;
      }
  }

  private sendMetadataToIframe() {
    if (this.iframe && Object.keys(this.metadata).length > 0) {
      this.iframe.contentWindow?.postMessage({
        type: 'SCENARO_METADATA',
        metadata: this.metadata
      }, '*');
      console.log('[Scenaro] Sent metadata to iframe:', this.metadata);
    }
  }

  /** Send cart error response to iframe when engine is not available (avoids iframe timeout). */
  private sendCartErrorToIframe(requestId: string, error: string): void {
    if (this.iframe?.contentWindow) {
      this.iframe.contentWindow.postMessage({
        type: 'SCENARO_CART_RESPONSE',
        requestId,
        success: false,
        error
      }, '*');
    }
  }

  public updateMetadata(metadata: Record<string, any>) {
    this.metadata = { ...this.metadata, ...metadata };
    // Send updated metadata to iframe if it's already open
    if (this.iframe) {
      this.sendMetadataToIframe();
    }
  }

  private handleLanguageChange() {
    // Get current language from localStorage or detect from browser
    const savedLanguage = localStorage.getItem('preferredLanguage');
    const browserLang = navigator.language || (navigator as any).userLanguage;
    const language = savedLanguage || (browserLang.startsWith('fr') ? 'fr' : 'en');
    
    // Update metadata with language
    this.updateMetadata({ language });
  }
}

// Auto-initialize on load
if (typeof window !== 'undefined') {
    // Check if already initialized to prevent double initialization
    if (!(window as any).Scenaro?._initialized) {
        new ScenaroWidget();
    }
}
