import { Engine, ScenaroConfig, Connector } from '../../types';
import { MagentoConnector } from '../../connectors/magento';

export class CommerceEngine implements Engine {
  name = 'commerce';
  private connector: Connector | null = null;
  private iframe: HTMLIFrameElement | null = null;

  constructor() {
    // In a real implementation, we might detect the platform dynamically
    // For this MVP, we default to Magento or allow config injection
    // Simple detection logic:
    if (typeof window !== 'undefined' && (window as any).requirejs) {
       // Very rough heuristic for Magento 2
       this.connector = MagentoConnector;
    }
  }

  async initialize(config: ScenaroConfig): Promise<void> {
    console.log('[Scenaro] Commerce Engine Initialized', config);
    // Setup listeners or pre-fetch data if needed
  }

  async connect(): Promise<void> {
    if (!this.connector) {
      console.warn('[Scenaro] No CMS connector detected.');
      return;
    }

    const cartId = await this.connector.getCartId();
    if (cartId) {
        this.sendCartIdToIframe(cartId);
    }
  }

  async onEnd(): Promise<void> {
      if (this.connector) {
          await this.connector.refreshCart();
      }
  }

  setIframe(iframe: HTMLIFrameElement) {
      this.iframe = iframe;
  }

  private sendCartIdToIframe(cartId: string) {
      if (this.iframe && this.iframe.contentWindow) {
          this.iframe.contentWindow.postMessage({
              type: 'SCENARO_CART_ID',
              data: { cartId }
          }, '*'); // In production, replace '*' with specific origin
      }
  }
}

// Export a singleton or factory
export const engine = new CommerceEngine();
