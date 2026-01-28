import { MagentoConnector } from '../../connectors/magento';
import { CartRequest, CartResponse, Connector, Engine } from '../../types';

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

  async initialize(publicationId: string): Promise<void> {
    console.log('[Scenaro] Commerce Engine Initialized', publicationId);
    // Setup listeners or pre-fetch data if needed
  }

  async connect(): Promise<void> {
    if (!this.connector) {
      console.warn('[Scenaro] No CMS connector detected.');
      return;
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

  async handleCartRequest(payload: CartRequest): Promise<void> {
    if (!this.connector) {
      this.sendCartResponse(payload.requestId, false, null, 'No CMS connector detected');
      return;
    }

    try {
      let result: any = null;
      let success = true;
      let error: string | undefined = undefined;

      switch (payload.type) {
        case 'SCENARO_CART_LIST_REQUEST':
          if (this.connector.listCart) {
            result = await this.connector.listCart();
          } else {
            success = false;
            error = 'listCart method not available';
          }
          break;

        case 'SCENARO_CART_ADD_REQUEST':
          if (this.connector.addToCart && payload.data) {
            result = await this.connector.addToCart({
              productId: payload.data.productId,
              qty: payload.data.qty
            });
          } else {
            success = false;
            error = 'addToCart method not available or missing data';
          }
          break;

        case 'SCENARO_CART_UPDATE_REQUEST':
          if (this.connector.updateCart && payload.data) {
            result = await this.connector.updateCart({
              itemId: payload.data.itemId,
              qty: payload.data.qty
            });
          } else {
            success = false;
            error = 'updateCart method not available or missing data';
          }
          break;

        case 'SCENARO_CART_REMOVE_REQUEST':
          if (this.connector.removeCart && payload.data) {
            result = await this.connector.removeCart({
              itemId: payload.data.itemId
            });
          } else {
            success = false;
            error = 'removeCart method not available or missing data';
          }
          break;

        case 'SCENARO_CART_CLEAR_REQUEST':
          if (this.connector.clearCart) {
            await this.connector.clearCart();
            result = { cleared: true };
          } else {
            success = false;
            error = 'clearCart method not available';
          }
          break;

        default:
          success = false;
          error = `Unknown cart request type: ${(payload as any).type}`;
      }

      this.sendCartResponse(payload.requestId, success, result, error);
    } catch (err: any) {
      const errorMessage = err?.message || 'Unknown error occurred';
      console.error('[Scenaro] Error handling cart request:', err);
      this.sendCartResponse(payload.requestId, false, null, errorMessage);
    }
  }

  private sendCartResponse(requestId: string, success: boolean, data: any, error?: string) {
    if (this.iframe && this.iframe.contentWindow) {
      const response: CartResponse = {
        type: 'SCENARO_CART_RESPONSE',
        requestId,
        success,
        data,
        error
      };
      this.iframe.contentWindow.postMessage(response, '*'); // In production, replace '*' with specific origin
    }
  }
}

// Export a singleton or factory
export const engine = new CommerceEngine();
