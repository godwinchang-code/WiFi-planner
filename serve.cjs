const { createServer } = require('http');
const { readFileSync, existsSync, statSync } = require('fs');
const { join, extname } = require('path');

const DIST = '/home/user/WiFi-planner/dist';
const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.wasm': 'application/wasm',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
};

createServer((req, res) => {
  let p = join(DIST, req.url.split('?')[0]);
  if (!existsSync(p) || statSync(p).isDirectory()) {
    p = join(DIST, 'index.html');
  }
  const ext = extname(p);
  const body = readFileSync(p);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}).listen(4173, '0.0.0.0', () => console.log('Serving dist on port 4173'));
