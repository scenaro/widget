export interface PublicationConfig {
  iframe_url: string;
  engine: string;
  connector?: string;
}

export interface ScenaroOpenConfig {
  metadata?: Record<string, any>;
}

export type ScenaroEventType =
  | 'SCENARO_READY'
  | 'SCENARO_END'
  | 'SCENARO_CART_LIST_REQUEST'
  | 'SCENARO_CART_ADD_REQUEST'
  | 'SCENARO_CART_UPDATE_REQUEST'
  | 'SCENARO_CART_REMOVE_REQUEST'
  | 'SCENARO_CART_CLEAR_REQUEST'
  | 'SCENARO_CART_RESPONSE'
  | 'SCENARO_CAPABILITY_REQUEST'
  | 'SCENARO_CAPABILITY_RESPONSE';

export interface ScenaroEventPayload<T = any> {
  type: ScenaroEventType;
  data?: T;
  requestId?: string;
}

export interface CartListRequest {
  type: 'SCENARO_CART_LIST_REQUEST';
  requestId: string;
}

export interface CartAddRequest {
  type: 'SCENARO_CART_ADD_REQUEST';
  requestId: string;
  data: {
    productId: string | number;
    qty?: number;
  };
}

export interface CartUpdateRequest {
  type: 'SCENARO_CART_UPDATE_REQUEST';
  requestId: string;
  data: {
    itemId: string | number;
    qty: number;
  };
}

export interface CartRemoveRequest {
  type: 'SCENARO_CART_REMOVE_REQUEST';
  requestId: string;
  data: {
    itemId: string | number;
  };
}

export interface CartClearRequest {
  type: 'SCENARO_CART_CLEAR_REQUEST';
  requestId: string;
}

export interface CartResponse {
  type: 'SCENARO_CART_RESPONSE';
  requestId: string;
  success: boolean;
  data?: any;
  error?: string;
}

export interface CapabilityRequest {
  type: 'SCENARO_CAPABILITY_REQUEST';
  requestId: string;
  capabilities: string[];
  adapter?: string;
}

export interface CapabilityResponse {
  type: 'SCENARO_CAPABILITY_RESPONSE';
  requestId: string;
  capabilities: Record<string, boolean>;
}

export type CartRequest = CartListRequest | CartAddRequest | CartUpdateRequest | CartRemoveRequest | CartClearRequest;

export interface Connector {
  name: string;
  refreshCart(): Promise<void>;
  listCart?(): Promise<any>;
  addToCart?(params: { productId: string | number; qty?: number }): Promise<any>;
  updateCart?(params: { itemId: string | number; qty: number }): Promise<any>;
  removeCart?(params: { itemId: string | number }): Promise<any>;
  clearCart?(): Promise<void>;
}

export interface Engine {
  name: string;
  initialize(publicationId: string): Promise<void>;
  setIframe(iframe: HTMLIFrameElement): void;
  connect(): Promise<void>;
  onEnd(): Promise<void>;
  handleCartRequest?(payload: CartRequest): Promise<void>;
}
