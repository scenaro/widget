import { Connector } from '../../types';

declare global {
  interface Window {
    customerData: {
      get(sectionName: string): () => any;
      reload(sections: string[], force?: boolean): void;
    };
  }
}

export const MagentoConnector: Connector = {
  name: 'magento',
  async getCartId(): Promise<string | null> {
    try {
      // Check if Magento's customerData object exists
      if (typeof window.customerData === 'undefined') {
        console.warn('[Scenaro] Magento customerData not found.');
        return null;
      }

      const cartData = window.customerData.get('cart')();
      if (cartData && cartData.cart_id) {
        return cartData.cart_id;
      }
      
      // Fallback: sometimes it's in a different structure or needs a refresh
      // But for MVP, we stick to the standard local storage retrieval via customerData
      return null;
    } catch (error) {
      console.error('[Scenaro] Error retrieving Magento cart ID:', error);
      return null;
    }
  },

  async refreshCart(): Promise<void> {
    try {
        if (typeof window.customerData !== 'undefined') {
            console.log('[Scenaro] Refreshing Magento cart...');
            window.customerData.reload(['cart'], true);
        }
    } catch (error) {
        console.error('[Scenaro] Error refreshing Magento cart:', error);
    }
  }
};
