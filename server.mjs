// Production Node.js HTTP server for TanStack Start
// Wraps the exported `fetch` handler from the Vite SSR build
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const PORT = parseInt(process.env.PORT || '3000', 10);

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json',
};

// Import the TanStack Start server entry
const serverModule = await import('./dist/server/server.js');
const appFetch = serverModule.default?.fetch || serverModule.fetch;

if (!appFetch) {
  console.error('❌ Could not find fetch handler in server module');
  console.error('Available exports:', Object.keys(serverModule));
  process.exit(1);
}

console.log('🚀 TanStack Start server loaded');

// Try to serve static files from dist/client
function tryServeStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  // 1. Try to serve from persisted data volume (for uploads/payment_proofs)
  if (url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/payment_proofs/')) {
    const dataPath = join(__dirname, 'data', url.pathname);
    if (existsSync(dataPath)) {
      try {
        const stat = readFileSync(dataPath);
        const ext = extname(dataPath);
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        });
        res.end(stat);
        return true;
      } catch (e) {}
    }
  }

  // 2. Try to serve from dist/client
  const clientDir = join(__dirname, 'dist', 'client');
  let filePath = join(clientDir, url.pathname);
  
  if (!existsSync(filePath)) {
    return false;
  }
  
  try {
    const stat = readFileSync(filePath);
    const ext = extname(filePath);
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    res.end(stat);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  try {
    // Try static files first
    if (tryServeStatic(req, res)) {
      return;
    }

    // Convert Node.js request to Fetch API Request
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach(v => headers.append(key, v));
        } else {
          headers.set(key, value);
        }
      }
    }

    const init = {
      method: req.method,
      headers,
    };

    // Add body for non-GET/HEAD requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      init.body = Buffer.concat(chunks);
    }

    const request = new Request(url.toString(), init);
    const response = await appFetch(request);

    // Write status and headers
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      if (responseHeaders[key]) {
        if (Array.isArray(responseHeaders[key])) {
          responseHeaders[key].push(value);
        } else {
          responseHeaders[key] = [responseHeaders[key], value];
        }
      } else {
        responseHeaders[key] = value;
      }
    });

    res.writeHead(response.status, response.statusText, responseHeaders);

    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } finally {
        reader.releaseLock();
      }
    }
    res.end();
  } catch (error) {
    console.error('Request error:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
    }
    res.end('Internal Server Error');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Mums'Home POS running at http://0.0.0.0:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   MySQL: ${process.env.MYSQL_HOST || 'SQLite fallback'}`);
});
