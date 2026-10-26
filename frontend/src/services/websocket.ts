/**
 * Build a ws(s):// URL for a backend path from the same base the REST client uses,
 * so it works behind the Vite proxy in dev and against VITE_API_URL in production.
 */
export function buildWsUrl(path: string): string {
  const base = new URL(import.meta.env.VITE_API_URL ?? '/api/v1', window.location.origin);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${base.origin}${base.pathname.replace(/\/$/, '')}${path}`;
}

export type ServerMessage =
  | { type: 'message'; role: 'ai' | 'user'; text: string }
  | { type: 'system' | 'error'; text: string };

/** Runtime check for what the server sent; the type alone can't vouch for parsed JSON. */
export function isServerMessage(value: unknown): value is ServerMessage {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.text !== 'string') return false;
  if (v.type === 'message') return v.role === 'ai' || v.role === 'user';
  return v.type === 'system' || v.type === 'error';
}

// Close codes after which retrying cannot help: the interview ended normally (1000),
// the server rejected us (1008), or it failed on its side, e.g. the AI is unavailable (1011).
const NO_RETRY_CLOSE_CODES = new Set([1000, 1008, 1011]);

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private onMessageCallback: ((data: ServerMessage) => void) | null = null;
  private onOpenCallback: (() => void) | null = null;
  private onDisconnectCallback: (() => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByClient = false;

  constructor(url: string) {
    this.url = url;
  }

  connect(token: string) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    this.closedByClient = false;
    const ws = new WebSocket(`${this.url}?token=${encodeURIComponent(token)}`);
    this.ws = ws;

    ws.onopen = () => {
      // A successful connection earns a fresh set of retries for the next drop
      this.reconnectAttempts = 0;
      this.onOpenCallback?.();
    };

    ws.onmessage = (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch (e) {
        console.error('Failed to parse WS message', e);
        return;
      }
      if (isServerMessage(parsed)) {
        this.onMessageCallback?.(parsed);
      } else {
        console.warn('Ignoring unexpected WS message', parsed);
      }
    };

    ws.onclose = (event) => {
      if (this.ws !== ws) return; // a newer socket replaced this one
      this.ws = null;
      this.onDisconnectCallback?.();
      if (!this.closedByClient && !NO_RETRY_CLOSE_CODES.has(event.code)) this.reconnect(token);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private reconnect(token: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.closedByClient) this.connect(token);
    }, Math.pow(2, this.reconnectAttempts) * 1000); // Exponential backoff
  }

  send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  onMessage(callback: (data: ServerMessage) => void) {
    this.onMessageCallback = callback;
  }

  onOpen(callback: () => void) {
    this.onOpenCallback = callback;
  }

  onDisconnect(callback: () => void) {
    this.onDisconnectCallback = callback;
  }

  disconnect() {
    this.closedByClient = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect logic
      this.ws.close();
      this.ws = null;
    }
  }
}
