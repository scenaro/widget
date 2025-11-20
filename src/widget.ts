import { PublicationConfig, ScenaroEventPayload } from './types';

class ScenaroWidget {
  private publicationId: string;
  private iframe: HTMLIFrameElement | null = null;
  private engine: any = null; // Typed as any because it might be loaded dynamically
  private listeners: Map<string, Function[]> = new Map();
  private publicationConfig: PublicationConfig | null = null;

  constructor() {
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

  private async fetchPublicationConfig(publicationId: string): Promise<PublicationConfig | null> {
    try {
      const apiUrl = (window as any).SCENARO_API_URL;
      const response = await fetch(`${apiUrl}/v1/public/publications/${publicationId}`);
      
      if (!response.ok) {
        console.warn(`[Scenaro] Failed to fetch publication config: ${response.statusText}`);
        return null;
      }
      
      const publication = await response.json();

      return publication.configuration;
    } catch (error) {
      console.error('[Scenaro] Error fetching publication config:', error);
      return null;
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
  }

  public async open() {
    if (this.iframe) return; // Already open

    // Emit 'open' event
    this.emit('open');

    // Fetch publication config if we have a publication ID
    if (this.publicationId) {
      try {
        this.publicationConfig = await this.fetchPublicationConfig(this.publicationId);
        console.log('[Scenaro] Fetched publication config:', this.publicationConfig);
      } catch (e) {
        console.warn('[Scenaro] Failed to fetch publication config, using defaults');
      }
    }

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

  private async createIframe() {
    const iframe = document.createElement('iframe');
    iframe.id = 'scenaro-iframe';

    if (!this.publicationConfig) {
      console.warn('[Scenaro] No publication config available, cannot create iframe');
      return;
    }
    
    const baseUrl = this.publicationConfig.iframe_url;
    const url = new URL(baseUrl);
    url.searchParams.append('scenario', this.publicationId);

    iframe.src = url.toString();
    iframe.allow = "microphone; autoplay";
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
      if (!this.publicationId || !this.publicationConfig) {
          console.warn('[Scenaro] No publication ID available, cannot load engine');
          return;
      }

      // Get engine name from widget config, default to 'commerce'
      const engineName = this.publicationConfig.engine;
      
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
          if (this.publicationConfig?.connector) {
              try {
                  const connectorUrl = `${cdnBaseUrl}/connectors/${this.publicationConfig.connector}.js`;
                  await import(connectorUrl);
                  // Connectors are typically used by engines, so we pass them during engine initialization
                  // The engine will handle connector setup
                  console.log(`[Scenaro] Loaded connector: ${this.publicationConfig.connector}`);
              } catch (error) {
                  console.warn(`[Scenaro] Failed to load connector ${this.publicationConfig.connector}:`, error);
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
