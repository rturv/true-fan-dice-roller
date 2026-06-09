import { Injectable, signal } from '@angular/core';

export type MessageHandler = (data: unknown) => void;

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingMessages: string[] = [];

  isConnected = signal(false);
  lastPong = Date.now();

  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 2000;

  private url = '';

  connect(url: string): void {
    this.url = url;
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  private doConnect(): void {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.isConnected.set(true);
      this.reconnectAttempts = 0;
      this.lastPong = Date.now();

      for (const msg of this.pendingMessages) {
        this.ws?.send(msg);
      }
      this.pendingMessages = [];

      this.startHeartbeat();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const type = data.type as string;
        const handlers = this.handlers.get(type);
        if (handlers) {
          for (const handler of handlers) {
            handler(data);
          }
        }

        const allHandlers = this.handlers.get('*');
        if (allHandlers) {
          for (const handler of allHandlers) {
            handler(data);
          }
        }
      } catch {
        // Ignore parse errors
      }
    };

    this.ws.onclose = () => {
      this.isConnected.set(false);
      this.stopHeartbeat();
      this.tryReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  send(message: unknown): void {
    const str = typeof message === 'string' ? message : JSON.stringify(message);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(str);
    } else {
      this.pendingMessages.push(str);
    }
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  disconnect(): void {
    this.reconnectAttempts = this.maxReconnectAttempts;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.isConnected.set(false);
  }

  private tryReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    if (!this.url) return;

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * this.reconnectAttempts, 30000);

    this.reconnectTimer = setTimeout(() => {
      this.doConnect();
    }, delay);
  }

  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (Date.now() - this.lastPong > 60000) {
        this.ws?.close();
        return;
      }
      this.send({ type: 'ping' });
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}
