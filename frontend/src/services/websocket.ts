export type BackendMessage =
  | { type: 'backend-status'; message: string }
  | { type: 'status'; status: 'idle' | 'vending'; items?: number[]; message?: string; elapsedTime?: number; timestamp?: string }
  | { type: 'vend-response'; success: boolean; message?: string; items?: number[]; estimatedTime?: number }
  | { type: 'vend-complete'; status: 'idle'; message: string; vendedItems: number[]; timestamp: string }
  | Record<string, unknown>

export function connectBackendWS(onMessage: (msg: BackendMessage) => void): WebSocket {
  const url = (import.meta.env.VITE_API_BASE || 'http://localhost:3001')
    .replace('http', 'ws');
  const ws = new WebSocket(url);
  ws.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch {
      // ignore non-JSON
    }
  });
  return ws;
}

