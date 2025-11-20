import { ScenaroConfig, ScenaroEventPayload, ScenaroOpenConfig } from './types';
// import { CommerceEngine } from './engines/commerce';

interface WidgetConfig {
  iframe_url?: string; // Snake case to match API response
  engine?: string;
  connector?: string; // Internal connector name (e.g., "magento", "shopify")
}

class ScenaroWidget {
  private config: ScenaroConfig;
  private iframe: HTMLIFrameElement | null = null;
  private engine: any = null; // Typed as any because it might be loaded dynamically
  private listeners: Map<string, Function[]> = new Map();
  private widgetConfig: WidgetConfig | null = null;

  constructor() {
    this.config = this.detectConfig();
    this.init();
    // Mark as initialized
    (window as any).Scenaro._initialized = true;
  }

  private detectConfig(): ScenaroConfig {
    // Find the script tag that loaded this widget
    const scripts = document.getElementsByTagName('script');
    let scenarioUuid = '';
    
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      // Only support data-scenaro-uuid (legacy data-scenaro-id removed)
      if (script.dataset.scenaroUuid && script.dataset.scenaroUuid !== '') {
        scenarioUuid = script.dataset.scenaroUuid;
        break;
      }
    }

    // If still not found, check multiple times (for async script loading scenarios)
    if (!scenarioUuid) {
      const widgetScript = document.getElementById('scenaro-widget-script');
      if (widgetScript) {
        // Check immediately (module script may have already set it)
        if (widgetScript.dataset.scenaroUuid && widgetScript.dataset.scenaroUuid !== '') {
          scenarioUuid = widgetScript.dataset.scenaroUuid;
        } else {
          // Wait a bit for module script to set the attribute
          let attempts = 0;
          const maxAttempts = 20; // 2 seconds total (20 * 100ms)
          const checkInterval = setInterval(() => {
            attempts++;
            if (widgetScript.dataset.scenaroUuid && widgetScript.dataset.scenaroUuid !== '') {
              this.config.scenarioUuid = widgetScript.dataset.scenaroUuid;
              console.log('[Scenaro] Scenario UUID detected after delay:', this.config.scenarioUuid);
              clearInterval(checkInterval);
            } else if (attempts >= maxAttempts) {
              console.warn('[Scenaro] No data-scenaro-uuid found after waiting. Please ensure the data-scenaro-uuid attribute is set on the script tag.');
              clearInterval(checkInterval);
            }
          }, 100);
        }
      } else {
        console.warn('[Scenaro] No script tag with id "scenaro-widget-script" found.');
      }
    }

    return {
      scenarioUuid,
      iframeUrl: 'https://cdn.scenaro.io/runtime/index.html', // Default, will be overridden by API
    };
  }

  private async fetchScenarioConfig(scenarioUUID: string): Promise<WidgetConfig> {
    try {
      const apiUrl = (window as any).SCENARO_API_URL || 'https://localhost:8080';
      const response = await fetch(`${apiUrl}/v1/public/scenarios/${scenarioUUID}`);
      
      if (!response.ok) {
        console.warn(`[Scenaro] Failed to fetch scenario config: ${response.statusText}`);
        return {};
      }
      
      const scenario = await response.json();
      // Extract widget config fields directly from public data (flattened structure)
      const publicData = scenario.public || {};
      
      // Return with snake_case field names to match API
      return {
        iframe_url: publicData.iframe_url,
        engine: publicData.engine,
        connector: publicData.connector,
      };
    } catch (error) {
      console.error('[Scenaro] Error fetching scenario config:', error);
      return {};
    }
  }

  private init() {
    // Expose global API
    const api = {
      open: this.open.bind(this),
      close: this.close.bind(this),
      on: this.on.bind(this),
      off: this.off.bind(this),
      _initialized: true,
      _instance: this,
    };
    (window as any).Scenaro = api;

    // Listen for messages from Iframe
    window.addEventListener('message', this.handleMessage.bind(this));
    
    // Re-check for scenario UUID after a short delay (in case it's set by a module script)
    setTimeout(() => {
      if (!this.config.scenarioUuid) {
        const widgetScript = document.getElementById('scenaro-widget-script');
        if (widgetScript && widgetScript.dataset.scenaroUuid && widgetScript.dataset.scenaroUuid !== '') {
          this.config.scenarioUuid = widgetScript.dataset.scenaroUuid;
          console.log('[Scenaro] Scenario UUID detected:', this.config.scenarioUuid);
        }
      }
    }, 100);
  }

  public async open(config?: ScenaroOpenConfig) {
    if (this.iframe) return; // Already open

    // Emit 'open' event
    this.emit('open');

    // Fetch scenario config if we have a scenario UUID
    if (this.config.scenarioUuid) {
      try {
        this.widgetConfig = await this.fetchScenarioConfig(this.config.scenarioUuid);
        console.log('[Scenaro] Fetched widget config:', this.widgetConfig);
      } catch (e) {
        console.warn('[Scenaro] Failed to fetch widget config, using defaults');
      }
    }

    await this.createIframe(config);
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

  private async createIframe(openConfig?: ScenaroOpenConfig) {
    const iframe = document.createElement('iframe');
    iframe.id = 'scenaro-iframe';
    
    // Use iframe_url from widget config (snake_case from API), fallback to default
    let iframeUrl = this.widgetConfig?.iframe_url || this.config.iframeUrl || 'https://cdn.scenaro.io/runtime/index.html';
    
    // URL normalization: only modify incomplete CDN URLs
    // If the URL is a complete URL (has protocol, domain, and either a path or port), use it as-is
    if (iframeUrl && iframeUrl.includes('://')) {
      try {
        const urlObj = new URL(iframeUrl);
        // If URL has a path (not just root) or a port, use it as-is
        // Otherwise, it's likely just a domain like "https://cdn.scenaro.io"
        if (urlObj.pathname !== '/' || urlObj.port !== '') {
          // Complete URL with path or port - use as-is
        } else if (iframeUrl === 'https://cdn.scenaro.io' || iframeUrl === 'https://cdn.scenaro.io/') {
          // Incomplete CDN URL - append default path
          iframeUrl = 'https://cdn.scenaro.io/runtime/index.html';
        }
      } catch (e) {
        // Invalid URL format, use default
        iframeUrl = 'https://cdn.scenaro.io/runtime/index.html';
      }
    } else {
      // No protocol, use default
      iframeUrl = 'https://cdn.scenaro.io/runtime/index.html';
    }
    
    // Construct URL with params
    const url = new URL(iframeUrl);
    url.searchParams.append('scenario', this.config.scenarioUuid);
    
    if (openConfig) {
        if (openConfig.entrypoint) url.searchParams.append('entrypoint', openConfig.entrypoint);
        if (openConfig.productId) url.searchParams.append('productId', openConfig.productId);
        if (openConfig.theme) url.searchParams.append('theme', openConfig.theme);
        if (openConfig.metadata) {
            // Pass metadata as encoded JSON or rely on postMessage later
            // For URL length safety, postMessage is better, but initial params are useful
            // Here we might just pass simple values
        }
    }

    iframe.src = url.toString();
    iframe.allow = "microphone; autoplay";
    iframe.style.border = 'none';
    iframe.style.zIndex = '2147483647'; // Max safe z-index
    
    // Check for container
    const container = document.getElementById('scenaro-container');
    
    if (container) {
        // Inside container
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.display = 'block';
        container.appendChild(iframe);
    } else {
        // Full screen fixed
        iframe.style.position = 'fixed';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.width = '100vw';
        iframe.style.height = '100vh';
        document.body.appendChild(iframe);
    }
    
    this.iframe = iframe;
  }

  private async loadEngine() {
      if (!this.config.scenarioUuid) {
          console.warn('[Scenaro] No scenario UUID available, cannot load engine');
          return;
      }

      // Get engine name from widget config, default to 'commerce'
      const engineName = this.widgetConfig?.engine || 'commerce';
      
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
          
          // Load connector if specified
          if (this.widgetConfig?.connector) {
              try {
                  const connectorUrl = `${cdnBaseUrl}/connectors/${this.widgetConfig.connector}.js`;
                  await import(connectorUrl);
                  // Connectors are typically used by engines, so we pass them during engine initialization
                  // The engine will handle connector setup
                  console.log(`[Scenaro] Loaded connector: ${this.widgetConfig.connector}`);
              } catch (error) {
                  console.warn(`[Scenaro] Failed to load connector ${this.widgetConfig.connector}:`, error);
              }
          }
          
          if (this.iframe) {
              this.engine.setIframe(this.iframe);
          }
          
          await this.engine.initialize(this.config);
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
      
      switch (payload.type) {
          case 'SCENARO_READY':
              console.log('[Scenaro] Iframe is ready');
              this.emit('ready');
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
}

// Auto-initialize on load
if (typeof window !== 'undefined') {
    // Wait for DOM to be ready if needed, or just run
    new ScenaroWidget();
}
