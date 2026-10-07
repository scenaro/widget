import { AppearanceName, appearanceOf, beginPageTakeover, PageTakeoverSession } from './page-takeover';
import { detectStorefront } from './storefront';
import { CapabilityRequest, CapabilityResponse, CartRequest, ScenaroEventPayload, ScenaroOpenConfig } from './types';

/** Stored overflow values to restore when exiting fullscreen */
let parentOverflow: { html: string; body: string } | null = null;

/** Wake Lock API (screen awake) - optional on Navigator */
interface WakeLockSentinel {
  release(): Promise<void>;
}

/** Resolves on the experience iframe's load, or after timeoutMs so the cover never waits forever. */
function whenIframeReady(iframe: HTMLIFrameElement, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    iframe.addEventListener('load', finish, { once: true });
    window.setTimeout(finish, timeoutMs);
  });
}

class ScenaroWidget {
  private publicationId: string;
  private entries: string[] = [];
  private appearance: AppearanceName = 'takeover';
  private scriptEl: HTMLScriptElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private panel: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private takeover: PageTakeoverSession | null = null;
  private closeButton: HTMLButtonElement | null = null;
  private sessionId = 0;
  private opening = false;
  private panelMode: 'docked' | 'full' = 'docked';
  private engine: any = null; // Typed as any because it might be loaded dynamically
  private listeners: Map<string, Function[]> = new Map();
  private metadata: Record<string, any> = {};
  /** True when iframe is appended to body (fullscreen), so we hide parent scrollbars */
  private isFullscreenAttachment: boolean = false;
  /** Viewport listeners for fullscreen dynamic height - removed in close() */
  private viewportResizeHandler: (() => void) | null = null;
  private wakeLockSentinel: WakeLockSentinel | null = null;
  private visibilityChangeHandler: (() => void) | null = null;

  constructor() {
    this.publicationId = this.detectConfig();
    this.init();
    this.mountLaunchers();
    // Mark as initialized
    (window as any).Scenaro._initialized = true;
  }

  private bindScript(script: HTMLScriptElement): string {
    this.scriptEl = script;
    const raw = script.dataset.entries || '';
    this.entries = raw.split(',').map((entry) => entry.trim()).filter(Boolean);
    this.appearance = appearanceOf(script.dataset.appearance);
    return (script.dataset.publicationId || '').trim();
  }

  private detectConfig(): string {
    // The executing script is the release bundle. Its src directory is where
    // engines and connectors are loaded from. The stable loader tag also
    // carries data-publication-id, so a document-order scan would pick that
    // one and point engines at the CDN root.
    const current = document.currentScript;
    if (current instanceof HTMLScriptElement && current.dataset.publicationId) {
      const publicationId = this.bindScript(current);
      if (publicationId) return publicationId;
    }

    const scripts = document.getElementsByTagName('script');
    let publicationId = '';

    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      if (script.dataset.publicationId && script.dataset.publicationId !== '') {
        publicationId = this.bindScript(script);
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
    if (this.iframe || this.opening) return; // Already open
    this.opening = true;

    // Publication ID: config override or script tag
    const publicationId = (config?.publicationId && config.publicationId.trim() !== '')
      ? config.publicationId.trim()
      : this.publicationId;

    // Store metadata if provided
    if (config?.metadata) {
      this.metadata = { ...this.metadata, ...config.metadata };
    }

    // Emit 'open' event
    this.emit('open');

    try {
      await this.createIframe(publicationId);
      if (this.iframe) await this.loadEngine(publicationId);
    } finally {
      this.opening = false;
    }
  }

  public close() {
    if (!this.iframe && !this.panel && !this.takeover) return;
    this.sessionId += 1;

    this.stopViewportListeners();
    this.stopWakeLockVisibilityReacquire();
    this.releaseWakeLock();
    this.setParentScrollbarsHidden(false);
    this.isFullscreenAttachment = false;
    this.panelMode = 'docked';

    const panel = this.panel;
    const overlay = this.overlay;
    const iframe = this.iframe;
    const takeover = this.takeover;
    const closeButton = this.closeButton;
    this.panel = null;
    this.overlay = null;
    this.iframe = null;
    this.takeover = null;
    this.closeButton = null;
    this.emit('close');

    if (takeover) {
      void this.dismissTakeover(takeover, iframe, closeButton);
      return;
    }

    this.setLaunchersHidden(false);

    if (overlay) {
      overlay.style.opacity = '0';
      const removeOverlay = () => overlay.remove();
      overlay.addEventListener('transitionend', removeOverlay, { once: true });
      window.setTimeout(removeOverlay, 520);
    }

    if (panel) {
      panel.style.transform = 'translateX(100%)';
      const remove = () => {
        panel.remove();
      };
      panel.addEventListener('transitionend', remove, { once: true });
      window.setTimeout(remove, 520);
      return;
    }

    iframe?.remove();
  }

  /** Hide or restore scrollbars on the parent document (html + body) when iframe is fullscreen. */
  private setParentScrollbarsHidden(hide: boolean): void {
    const doc = document;
    const html = doc.documentElement;
    const body = doc.body;
    if (hide) {
      parentOverflow = {
        html: html.style.overflow || '',
        body: body.style.overflow || '',
      };
      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
    } else if (parentOverflow) {
      html.style.overflow = parentOverflow.html;
      body.style.overflow = parentOverflow.body;
      parentOverflow = null;
    }
  }

  /** Current visible viewport height (accounts for mobile browser bar). Used for fullscreen iframe height. */
  private getVisibleHeight(): number {
    const vv = (window as Window & { visualViewport?: { height: number } }).visualViewport;
    return (vv?.height ?? window.innerHeight) || window.innerHeight;
  }

  /** Apply current viewport height to the expanded panel. Call on resize/orientation. */
  private applyViewportHeight(): void {
    const height = `${this.getVisibleHeight()}px`;
    if (this.panel && this.panelMode === 'full') this.panel.style.height = height;
    if (this.takeover && this.iframe) this.iframe.style.height = height;
  }

  /** Attach resize/orientation/visualViewport listeners so fullscreen iframe height tracks visible viewport. */
  private startViewportListeners(): void {
    if (!this.isFullscreenAttachment || this.viewportResizeHandler) return;
    const apply = () => this.applyViewportHeight();
    this.viewportResizeHandler = apply;
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    const vv = (window as Window & { visualViewport?: { addEventListener: (e: string, fn: () => void) => void } }).visualViewport;
    if (vv?.addEventListener) vv.addEventListener('resize', apply);
    this.applyViewportHeight();
  }

  /** Remove viewport listeners. Call on close. */
  private stopViewportListeners(): void {
    if (!this.viewportResizeHandler) return;
    const apply = this.viewportResizeHandler;
    this.viewportResizeHandler = null;
    window.removeEventListener('resize', apply);
    window.removeEventListener('orientationchange', apply);
    const vv = (window as Window & { visualViewport?: { removeEventListener: (e: string, fn: () => void) => void } }).visualViewport;
    if (vv?.removeEventListener) vv.removeEventListener('resize', apply);
  }

  /** Acquire screen wake lock so device doesn't sleep while iframe is open. No-op if unsupported. */
  private async acquireWakeLock(): Promise<void> {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> } };
    if (!nav.wakeLock) return;
    try {
      this.wakeLockSentinel = await nav.wakeLock.request('screen');
    } catch {
      // Unsupported or denied; fail silently
    }
  }

  /** Release wake lock. Call on close. */
  private async releaseWakeLock(): Promise<void> {
    if (!this.wakeLockSentinel) return;
    try {
      await this.wakeLockSentinel.release();
    } catch {
      // ignore
    }
    this.wakeLockSentinel = null;
  }

  /** Re-acquire wake lock when tab becomes visible and iframe is still open. */
  private startWakeLockVisibilityReacquire(): void {
    if (this.visibilityChangeHandler) return;
    this.visibilityChangeHandler = () => {
      if (document.visibilityState === 'visible' && this.iframe) {
        this.acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  /** Remove visibilitychange listener. Call on close. */
  private stopWakeLockVisibilityReacquire(): void {
    if (!this.visibilityChangeHandler) return;
    document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    this.visibilityChangeHandler = null;
  }

  public on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
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
    return detectStorefront();
  }

  private adapterLoaded: string | null = null;

  private async loadAdapter(adapterName: string): Promise<void> {
    // Skip if adapter already loaded (prevents React Strict Mode double-mount issues)
    if (this.adapterLoaded === adapterName) {
      return;
    }

    // Set flag immediately to prevent race condition with concurrent calls
    this.adapterLoaded = adapterName;

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

      // Engine already created by loadEngine(); only load connector for this capability
      if (this.engine) {
        return;
      }

      // Load engine (only if not already loaded by loadEngine())
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

  private async createIframe(publicationId?: string) {
    const id = publicationId ?? this.publicationId;
    const iframe = document.createElement('iframe');
    iframe.id = 'scenaro-iframe';

    if (!id) {
      console.warn('[Scenaro] No publication ID available, cannot create iframe');
      return;
    }

    // data-iframe-url skips embed.scenaro.io. That host sends X-Frame-Options: DENY,
    // which Chrome shows inside the iframe as "refused to connect".
    const embedOverride = this.scriptEl?.dataset.iframeUrl;
    const baseUrl = embedOverride && embedOverride.trim() !== ''
      ? embedOverride.trim()
      : `https://embed.scenaro.io/${id}`;
    const url = new URL(baseUrl);

    // Add language from metadata if available
    if (this.metadata.language) {
      url.searchParams.append('language', this.metadata.language);
    }

    iframe.src = url.toString();
    iframe.allow = "microphone *; autoplay *";
    iframe.style.border = 'none';
    iframe.style.zIndex = '2147483647';
    iframe.style.pointerEvents = 'auto';
    iframe.style.touchAction = 'manipulation';

    // Prefer #scenaro-container so iframe is in-page (not fullscreen). Wait for it if not yet in DOM.
    const sessionId = this.sessionId;
    const container = await this.getContainerOrWait();
    if (sessionId !== this.sessionId) {
      iframe.remove();
      return;
    }
    if (container) {
      Object.assign(iframe.style, { width: '100%', height: '100%', display: 'block' });
      container.appendChild(iframe);
      this.iframe = iframe;
    } else if (this.appearance === 'panel') {
      this.mountDockedPanel(iframe);
      this.iframe = iframe;
    } else {
      await this.mountTakeover(iframe, sessionId);
    }

    if (sessionId !== this.sessionId) return;
    this.acquireWakeLock();
    this.startWakeLockVisibilityReacquire();
  }

  /** Wait briefly for #scenaro-container (e.g. React mount) so iframe can be in-page, not fullscreen. */
  private getContainerOrWait(): Promise<HTMLElement | null> {
    const id = 'scenaro-container';
    const existing = document.getElementById(id);
    if (existing) return Promise.resolve(existing);

    const maxWait = 800;
    const interval = 50;
    return new Promise((resolve) => {
      const deadline = Date.now() + maxWait;
      const check = () => {
        const el = document.getElementById(id);
        if (el) {
          resolve(el);
          return;
        }
        if (Date.now() >= deadline) {
          resolve(null);
          return;
        }
        setTimeout(check, interval);
      };
      setTimeout(check, interval);
    });
  }

  private async loadEngine(publicationId?: string) {
      const id = publicationId ?? this.publicationId;
      if (!id) {
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
          
          if (this.iframe) {
              this.engine.setIframe(this.iframe);
          }
          
          await this.engine.initialize(id);
      } catch (error) {
          console.error(`[Scenaro] Failed to load engine ${engineName}:`, error);
      }
  }

  private getCDNBaseUrl(): string {
      const src = this.scriptEl?.src;
      if (src) {
        try {
          const url = new URL(src);
          return url.origin + url.pathname.replace(/\/[^/]*$/, '');
        } catch {
          return 'https://cdn.scenaro.io';
        }
      }
      return 'https://cdn.scenaro.io';
  }

  /** Entries (floating, product, search) come from data-entries on the script tag. */
  private mountLaunchers() {
    const start = () => {
      if (!this.entries.length || !this.publicationId) return;
      if (this.entries.includes('floating')) this.mountFloatingLauncher();
      if (this.entries.includes('product')) this.mountProductLauncher();
      if (this.entries.includes('search')) this.mountSearchLauncher();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  }

  private mountFloatingLauncher() {
    const button = this.launcherRoot('floating', this.launcherLabel('floating', 'Conseiller'));
    if (!button.style.position) {
      Object.assign(button.style, {
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        zIndex: '2147483640',
      });
    }
    button.addEventListener('click', () => {
      void this.open({ metadata: { entry: 'floating', page: location.href } });
    });
    document.body.appendChild(button);
  }

  private mountProductLauncher() {
    const shopifyPage = (window as Window & { ShopifyAnalytics?: { meta?: { page?: { pageType?: string } } } }).ShopifyAnalytics?.meta?.page?.pageType;
    const onProduct =
      document.body.classList.contains('catalog-product-view') ||
      document.body.classList.contains('template-product') ||
      shopifyPage === 'product';
    if (!onProduct) return;

    const anchor =
      document.querySelector<HTMLElement>('#product-addtocart-button') ||
      document.querySelector<HTMLElement>('form[action*="/cart/add"] [type="submit"]');
    if (!anchor?.parentElement) {
      console.warn('[Scenaro] Product page found, add-to-cart anchor missing');
      return;
    }

    const button = this.launcherRoot('product', this.launcherLabel('product', 'Demander conseil'));
    button.addEventListener('click', () => {
      const form = document.querySelector<HTMLElement>('#product_addtocart_form, form[action*="/cart/add"]');
      void this.open({
        metadata: {
          entry: 'product',
          page: location.href,
          product_sku: form?.getAttribute('data-product-sku') || undefined,
        },
      });
    });
    if (this.scriptEl?.dataset.productPlacement === 'after') {
      anchor.insertAdjacentElement('afterend', button);
    } else {
      anchor.parentElement.insertBefore(button, anchor);
    }
  }

  private mountSearchLauncher() {
    const form =
      document.querySelector<HTMLElement>('#search_mini_form') ||
      document.querySelector<HTMLElement>('form[action*="/search"]');
    if (!form) {
      console.warn('[Scenaro] Search entry enabled, search form not found');
      return;
    }

    const button = this.createLauncherButton(this.launcherLabel('search', 'Scenaro'), 'search');
    button.dataset.scenaroLauncher = 'search';
    button.style.marginLeft = '8px';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const input = form.querySelector<HTMLInputElement>('input[type="search"], input[name="q"]');
      void this.open({
        metadata: {
          entry: 'search',
          page: location.href,
          query: input?.value || undefined,
        },
      });
    });
    form.appendChild(button);
  }

  private launcherLabel(kind: 'floating' | 'product' | 'search', fallback: string): string {
    const value = kind === 'floating'
      ? this.scriptEl?.dataset.floatingLabel
      : kind === 'product'
        ? this.scriptEl?.dataset.productLabel
        : this.scriptEl?.dataset.searchLabel;
    return value && value.trim() !== '' ? value.trim() : fallback;
  }

  /** Custom markup from <template id="scenaro-button-floating|product">, otherwise the integrated button. */
  private launcherRoot(kind: 'floating' | 'product', label: string): HTMLElement {
    const template = document.getElementById(`scenaro-button-${kind}`) as HTMLTemplateElement | null;
    const custom = template?.content?.firstElementChild;
    if (custom) {
      const node = custom.cloneNode(true) as HTMLElement;
      node.dataset.scenaroLauncher = kind;
      return node;
    }
    return this.createLauncherButton(label, kind);
  }

  private createLauncherButton(label: string, kind: 'floating' | 'product' | 'search'): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.scenaroLauncher = kind;
    const onMagentoProduct = kind === 'product' && detectStorefront() === 'magento';
    if (onMagentoProduct) {
      button.className = 'action secondary';
      button.style.width = '100%';
      button.style.marginBottom = '12px';
      this.matchStoreButton(button, kind);
      return button;
    }
    Object.assign(button.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '44px',
      padding: '0 18px',
      border: '1px solid rgba(0, 0, 0, 0.2)',
      borderRadius: '2px',
      background: kind === 'floating' ? '#fff' : 'transparent',
      color: 'inherit',
      font: 'inherit',
      fontWeight: '600',
      cursor: 'pointer',
      width: kind === 'product' ? '100%' : 'auto',
      margin: kind === 'product' ? '0 0 12px' : '0',
      boxShadow: kind === 'floating' ? '0 8px 24px rgba(0, 0, 0, 0.12)' : 'none',
    });
    this.matchStoreButton(button, kind);
    return button;
  }

  /** Copy the live add-to-cart button so the launcher matches the theme without filled-in fields. */
  private matchStoreButton(button: HTMLButtonElement, kind: 'floating' | 'product' | 'search') {
    if (this.scriptEl?.dataset.matchTheme === '0') return;
    const source = this.findStoreButton(button);
    if (!source) return;
    const style = getComputedStyle(source);
    const keys = [
      'backgroundColor',
      'color',
      'borderRadius',
      'borderTopWidth',
      'borderRightWidth',
      'borderBottomWidth',
      'borderLeftWidth',
      'borderTopStyle',
      'borderRightStyle',
      'borderBottomStyle',
      'borderLeftStyle',
      'borderTopColor',
      'borderRightColor',
      'borderBottomColor',
      'borderLeftColor',
      'fontFamily',
      'fontWeight',
      'fontSize',
      'letterSpacing',
      'textTransform',
      'paddingTop',
      'paddingBottom',
      'paddingLeft',
      'paddingRight',
      'minHeight',
      'lineHeight',
    ] as const;
    for (const key of keys) {
      button.style[key] = style[key];
    }
    if (style.backgroundImage && style.backgroundImage !== 'none') {
      button.style.backgroundImage = style.backgroundImage;
    }
    if (kind === 'product') {
      button.style.width = '100%';
      button.style.marginBottom = '12px';
    }
  }

  private findStoreButton(except: HTMLElement): HTMLElement | null {
    const selectors = [
      '#product-addtocart-button',
      'form[action*="/cart/add"] button[type="submit"]',
      'button[name="add"]',
      '.product-form__submit',
      '.action.primary',
    ];
    for (const selector of selectors) {
      const nodes = document.querySelectorAll<HTMLElement>(selector);
      for (const node of nodes) {
        if (node !== except && !node.dataset.scenaroLauncher) return node;
      }
    }
    return null;
  }

  private setLaunchersHidden(hidden: boolean) {
    document.querySelectorAll<HTMLElement>('[data-scenaro-launcher]').forEach((node) => {
      node.style.visibility = hidden ? 'hidden' : '';
    });
  }

  /** Page blocks leave, then the experience iframe fills the window. */
  private async mountTakeover(iframe: HTMLIFrameElement, sessionId: number): Promise<void> {
    this.setLaunchersHidden(true);
    const session = beginPageTakeover();
    if (sessionId !== this.sessionId) {
      await session.restore();
      return;
    }
    this.takeover = session;
    this.iframe = iframe;
    this.isFullscreenAttachment = true;
    Object.assign(iframe.style, {
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: `${this.getVisibleHeight()}px`,
      margin: '0',
      opacity: '0',
      background: '#fff',
      transition: 'opacity 220ms ease',
    });
    const button = this.buildCloseButton();
    this.closeButton = button;
    const ready = whenIframeReady(iframe);
    document.documentElement.appendChild(iframe);
    document.documentElement.appendChild(button);
    this.startViewportListeners();
    await session.play();
    if (sessionId !== this.sessionId || this.takeover !== session) return;
    await ready;
    if (sessionId !== this.sessionId || this.takeover !== session) return;
    iframe.style.opacity = '1';
    void session.fadeCoverOut();
  }

  private async dismissTakeover(
    session: PageTakeoverSession,
    iframe: HTMLIFrameElement | null,
    button: HTMLButtonElement | null,
  ): Promise<void> {
    if (iframe) {
      iframe.style.opacity = '0';
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    }
    await session.restore();
    iframe?.remove();
    button?.remove();
    this.setLaunchersHidden(false);
  }

  private buildCloseButton(position: 'fixed' | 'absolute' = 'fixed'): HTMLButtonElement {
    const close = document.createElement('button');
    close.type = 'button';
    close.dataset.scenaroChrome = '1';
    close.setAttribute('aria-label', 'Fermer Scenaro');
    close.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false" style="display:block"><path d="M4.25 4.25 L11.75 11.75 M11.75 4.25 L4.25 11.75" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    Object.assign(close.style, {
      position,
      top: '16px',
      left: '16px',
      zIndex: position === 'fixed' ? '2147483647' : '2',
      width: '36px',
      height: '36px',
      margin: '0',
      padding: '0',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
      border: '0',
      borderRadius: '999px',
      background: '#fff',
      color: '#1a1820',
      boxShadow: '0 0 0 1px rgba(26, 24, 32, 0.08), 0 8px 20px rgba(26, 24, 32, 0.12)',
      cursor: 'pointer',
      lineHeight: '0',
      appearance: 'none',
      WebkitAppearance: 'none',
    });
    close.addEventListener('click', (event) => {
      event.stopPropagation();
      this.close();
    });
    return close;
  }

  /** Right-hand panel. The experience is already full-screen wide and clipped until a click. */
  private mountDockedPanel(iframe: HTMLIFrameElement) {
    const overlay = document.createElement('div');
    overlay.id = 'scenaro-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      display: 'block',
      background: 'rgba(0, 0, 0, 0.5)',
      zIndex: '2147483645',
      opacity: '0',
      transition: 'opacity 480ms cubic-bezier(0.22, 1, 0.36, 1)',
    });
    // Dawn (and similar themes) set `div:empty { display: none }`.
    overlay.appendChild(document.createElement('span'));
    overlay.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.panelMode !== 'full') this.close();
    });
    document.body.appendChild(overlay);
    this.overlay = overlay;

    const panel = document.createElement('aside');
    panel.id = 'scenaro-panel';
    panel.setAttribute('aria-label', 'Scenaro');
    Object.assign(panel.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '2147483646',
      background: '#fff',
      boxShadow: '-24px 0 64px rgba(0, 0, 0, 0.35)',
      transform: 'translateX(100%)',
      transition: 'transform 480ms cubic-bezier(0.22, 1, 0.36, 1)',
      willChange: 'transform',
    });

    Object.assign(iframe.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      zIndex: '0',
      // The docked iframe must not take the click. The catcher expands the panel first.
      pointerEvents: 'none',
    });

    const close = this.buildCloseButton('absolute');

    const catcher = document.createElement('div');
    Object.assign(catcher.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '1',
      display: 'block',
      cursor: 'pointer',
      background: 'transparent',
    });
    // Not :empty, so theme rules like Dawn's `div:empty { display: none }` cannot hide it.
    catcher.appendChild(document.createElement('span'));
    catcher.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.expandPanel(catcher);
    });

    panel.append(iframe, catcher, close);
    document.body.appendChild(panel);
    this.panel = panel;
    this.panelMode = 'docked';
    this.setLaunchersHidden(true);
    this.setParentScrollbarsHidden(true);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        panel.style.transform = 'translateX(33.333%)';
        overlay.style.opacity = '1';
      });
    });
  }

  private expandPanel(catcher: HTMLElement) {
    if (!this.panel || this.panelMode === 'full') return;
    this.panelMode = 'full';
    this.isFullscreenAttachment = true;
    if (this.iframe) this.iframe.style.pointerEvents = 'auto';
    this.panel.style.transform = 'translateX(0%)';
    catcher.remove();
    const panel = this.panel;
    panel.addEventListener('transitionend', () => {
      if (this.panel === panel && this.panelMode === 'full') this.startViewportListeners();
    }, { once: true });
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
          case 'SCENARO_REDIRECT':
              const url = payload.url;
              if (url && typeof url === 'string') {
                  window.location.href = url;
              }
              break;
      }
  }

  private sendMetadataToIframe() {
    if (this.iframe && Object.keys(this.metadata).length > 0) {
      this.iframe.contentWindow?.postMessage({
        type: 'SCENARO_METADATA',
        metadata: this.metadata
      }, '*');
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
    // Wait for DOM to be ready if needed, or just run
    new ScenaroWidget();
}
