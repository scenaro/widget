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
  | 'SCENARO_CART_ID' 
  | 'SCENARO_END';

export interface ScenaroEventPayload<T = any> {
  type: ScenaroEventType;
  data?: T;
}

export interface Connector {
  name: string;
  getCartId(): Promise<string | null>;
  refreshCart(): Promise<void>;
}

export interface Engine {
  name: string;
  initialize(publicationId: string): Promise<void>;
  setIframe(iframe: HTMLIFrameElement): void;
  connect(): Promise<void>;
  onEnd(): Promise<void>;
}
