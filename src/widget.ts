import { ScenaroConfig, ScenaroEventPayload, ScenaroOpenConfig } from './types';
// import { CommerceEngine } from './engines/commerce';

// Placeholder for where we might load engines dynamically in the future
// For this MVP, we are bundling the commerce engine directly to show it works,
// or we can leave it to be loaded separately. 
// Given the requirements, let's implement the Loader logic.

class ScenaroWidget {
  private config: ScenaroConfig;
  private iframe: HTMLIFrameElement | null = null;
  private engine: any = null; // Typed as any because it might be loaded dynamically
  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    this.config = this.detectConfig();
    this.init();
  }

  private detectConfig(): ScenaroConfig {
    // Find the script tag that loaded this widget
    const scripts = document.getElementsByTagName('script');
    let scenaroId = '';
    
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      // Support both data-scenaro-id and data-scenaro-uuid (as per new spec)
      if (script.dataset.scenaroUuid) {
        scenaroId = script.dataset.scenaroUuid;
        break;
      }
      if (script.dataset.scenaroId) {
        scenaroId = script.dataset.scenaroId;
        break;
      }
    }

    if (!scenaroId) {
      console.warn('[Scenaro] No data-scenaro-uuid or data-scenaro-id found on script tag.');
    }

    return {
      scenaroId,
      iframeUrl: 'https://cdn.scenaro.io/runtime/index.html', // Default
    };
  }

  private init() {
    // Expose global API
    (window as any).Scenaro = {
      open: this.open.bind(this),
      close: this.close.bind(this),
      on: this.on.bind(this),
      off: this.off.bind(this),
    };

    // Listen for messages from Iframe
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  public open(config?: ScenaroOpenConfig) {
    if (this.iframe) return; // Already open

    // Emit 'open' event
    this.emit('open');

    this.createIframe(config);
    this.loadEngine();
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

  private createIframe(openConfig?: ScenaroOpenConfig) {
    const iframe = document.createElement('iframe');
    iframe.id = 'scenaro-iframe';
    
    // Construct URL with params
    const url = new URL(this.config.iframeUrl || 'https://cdn.scenaro.io/runtime/index.html');
    url.searchParams.append('scenario', this.config.scenaroId);
    
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
      // In a full implementation, we would fetch the engine URL from the config
      // or dynamically import it.
      // For this MVP, we instantiate the CommerceEngine directly if needed.
      // dynamic import example:
      // const module = await import('./engines/commerce');
      // this.engine = new module.CommerceEngine();
      
      // Direct usage for MVP demo:
      const { CommerceEngine } = await import('./engines/commerce');
      this.engine = new CommerceEngine();
      
      if (this.iframe) {
          this.engine.setIframe(this.iframe);
      }
      
      await this.engine.initialize(this.config);
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
