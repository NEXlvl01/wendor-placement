import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const VMC_WS_URL = process.env.VMC_WS || 'ws://localhost:3002';

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Hello route
app.get('/hello', (req, res) => {
  res.json({
    message: 'Hello from Wendor Backend!',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Wendor Backend',
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Wendor Backend API',
    version: '1.0.0',
    endpoints: {
      hello: '/hello',
      health: '/health',
      products: '/api/products'
    }
  });
});

// --- Products loader from data.json ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function mapProduct(raw) {
  return {
    id: raw.product_id,
    name: raw.product_name,
    price: Number(raw.product_price ?? 0),
    image_url: typeof raw.image === 'string' && raw.image.startsWith('http') ? raw.image : '',
    category: raw.category_id ?? null,
    meta_data: {
      sku_id: raw.sku_id ?? null,
      brand_id: raw.brand_id ?? null
    }
  };
}

async function loadProducts() {
  const candidates = [
    path.resolve(__dirname, '../data.json'),
    path.resolve(__dirname, '../../data.json'),
    path.resolve(process.cwd(), 'data.json'),
    path.resolve(process.cwd(), '../data.json'),
  ];
  let lastErr = null;
  for (const p of candidates) {
    try {
      const content = await readFile(p, 'utf-8');
      const data = JSON.parse(content);
      return Array.isArray(data) ? data.map(mapProduct) : [];
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Failed to read data.json');
}

app.get('/api/products', async (req, res) => {
  try {
    const products = await loadProducts();
    res.json(products);
  } catch (e) {
    console.error('Failed to load products from data.json:', e?.message || e);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

// --- VMC Relay (Backend WS <-> VMC WS) ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let vmcSocket = null;
let vmcConnected = false;
let vmcReconnectScheduled = false;
let pendingMessagesQueue = [];

function broadcastToFrontend(messageObj) {
  const payload = JSON.stringify(messageObj);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function ensureVmcConnection() {
  if (vmcConnected && vmcSocket && vmcSocket.readyState === WebSocket.OPEN) return;

  vmcSocket = new WebSocket(VMC_WS_URL);
  vmcSocket.on('open', () => {
    vmcConnected = true;
    vmcReconnectScheduled = false;
    console.log(`Connected to VMC at ${VMC_WS_URL}`);
    // Flush any queued commands
    pendingMessagesQueue.forEach((msg) => vmcSocket.send(JSON.stringify(msg)));
    pendingMessagesQueue = [];
  });
  vmcSocket.on('message', (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      broadcastToFrontend(parsed);
    } catch {
      // ignore
    }
  });
  vmcSocket.on('close', () => {
    vmcConnected = false;
    scheduleVmcReconnect();
  });
  vmcSocket.on('error', (err) => {
    vmcConnected = false;
    console.error('VMC WS error:', err?.message || err);
    scheduleVmcReconnect();
  });
}

function scheduleVmcReconnect() {
  if (vmcReconnectScheduled) return;
  vmcReconnectScheduled = true;
  setTimeout(() => {
    vmcReconnectScheduled = false;
    ensureVmcConnection();
  }, 1500);
}

wss.on('connection', (ws) => {
  // ensure VMC connect and request status for this client
  ensureVmcConnection();
  const statusCommand = { type: 'status' };
  if (vmcSocket && vmcSocket.readyState === WebSocket.OPEN) {
    vmcSocket.send(JSON.stringify(statusCommand));
  } else {
    pendingMessagesQueue.push(statusCommand);
  }
  ws.send(JSON.stringify({ type: 'backend-status', message: 'connected' }));
});

// Payment endpoint that triggers vend via VMC
app.post('/api/pay', (req, res) => {
  const { items } = req.body || {};
  const itemArray = Array.isArray(items) ? items : (items ? [items] : []);
  if (!itemArray.length) return res.status(400).json({ error: 'items array required' });

  const vendCommand = { type: 'vend', items: itemArray };
  ensureVmcConnection();
  if (vmcSocket && vmcSocket.readyState === WebSocket.OPEN) {
    vmcSocket.send(JSON.stringify(vendCommand));
  } else {
    pendingMessagesQueue.push(vendCommand);
  }
  res.json({ ok: true, message: 'Payment processed, vending requested', requestedItems: itemArray });
});

// Start server (HTTP + WS)
server.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📡 Backend WS available at ws://localhost:${PORT}`);
  // proactively connect
  ensureVmcConnection();
});
