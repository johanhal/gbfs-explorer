import { createServer } from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        process.env[key] = valueParts.join('=');
      }
    }
  }
} catch (e) {
  console.warn('Could not load .env.local:', e.message);
}

// Import API handlers
const handlers = {
  '/api/health': (await import('./api/health.js')).default,
  '/api/config': (await import('./api/config.js')).default,
  '/api/proxy': (await import('./api/proxy.js')).default,
  '/api/feeds': (await import('./api/feeds.js')).default,
  '/api/v2/gbfs-feeds': (await import('./api/v2/gbfs-feeds.js')).default,
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Find matching handler
  let handler = handlers[pathname];

  // Check for dynamic routes (like /api/proxy which handles query params)
  if (!handler) {
    for (const [route, h] of Object.entries(handlers)) {
      if (pathname.startsWith(route)) {
        handler = h;
        break;
      }
    }
  }

  if (handler) {
    // Create mock req/res objects similar to Vercel
    const mockReq = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: Object.fromEntries(url.searchParams),
      body: null,
    };

    // Parse body for POST requests
    if (req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      try {
        mockReq.body = JSON.parse(Buffer.concat(chunks).toString());
      } catch {
        mockReq.body = Buffer.concat(chunks).toString();
      }
    }

    const mockRes = {
      statusCode: 200,
      headers: {},
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      setHeader(key, value) {
        this.headers[key] = value;
        return this;
      },
      json(data) {
        this.headers['Content-Type'] = 'application/json';
        this.body = JSON.stringify(data);
        this.end();
      },
      send(data) {
        this.body = data;
        this.end();
      },
      end(data) {
        if (data) this.body = data;
        res.writeHead(this.statusCode, this.headers);
        res.end(this.body);
      },
    };

    try {
      await handler(mockReq, mockRes);
    } catch (error) {
      console.error('API Error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`API dev server running at http://localhost:${PORT}`);
});
