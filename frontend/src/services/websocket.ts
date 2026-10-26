/**
 * Build a ws(s):// URL for a backend path from the same base the REST client uses,
 * so it works behind the Vite proxy in dev and against VITE_API_URL in production.
 */
export function buildWsUrl(path: string): string {
  const base = new URL(import.meta.env.VITE_API_URL ?? '/api/v1', window.location.origin);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${base.origin}${base.pathname.replace(/\/$/, '')}${path}`;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private onMessageCallback: ((data: any) => void) | null = null;
  private onDisconnectCallback: (() => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;

  constructor(url: string) {
    this.url = url;
  }

  connect(token: string) {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(`${this.url}?token=${encodeURIComponent(token)}`);

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (this.onMessageCallback) this.onMessageCallback(data);
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    this.ws.onclose = () => {
      if (this.onDisconnectCallback) this.onDisconnectCallback();
      this.reconnect(token);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private reconnect(token: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.connect(token);
      }, Math.pow(2, this.reconnectAttempts) * 1000); // Exponential backoff
    }
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  onMessage(callback: (data: any) => void) {
    this.onMessageCallback = callback;
  }

  onDisconnect(callback: () => void) {
    this.onDisconnectCallback = callback;
  }

  disconnect() {
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect logic
      this.ws.close();
      this.ws = null;
    }
  }
}
