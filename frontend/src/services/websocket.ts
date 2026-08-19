type MessageHandler = (type: string, data: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private reconnectTimer: any = null;

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '3000' ? 'localhost:4566' : window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[Companion WS] Connected to backend');
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handlers.forEach(handler => handler(payload.type, payload.data));
        } catch (err) {
          console.error('[Companion WS] Parse error:', err);
        }
      };

      this.ws.onclose = () => {
        console.warn('[Companion WS] Connection closed, reconnecting in 2s...');
        this.reconnect();
      };

      this.ws.onerror = (err) => {
        console.error('[Companion WS] Error:', err);
        this.ws?.close();
      };
    } catch (e) {
      this.reconnect();
    }
  }

  private reconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 2000);
  }

  subscribe(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
}

export const wsClient = new WebSocketClient();
