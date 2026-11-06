// Servidor local simples para testar o J.S. no computador (sem instalar nada).
// Uso:  node servidor.js   e abra  http://localhost:5190
// "localhost" conta como endereço seguro, então dá para testar instalação e modo offline.
// Outra porta:  set PORT=8080 && node servidor.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 5190;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + path.sep) || file.includes(path.sep + 'testes' + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Não encontrado'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).on('error', (err) => {
  console.error(err.code === 'EADDRINUSE' ? 'A porta ' + PORT + ' já está em uso. Rode com outra:  set PORT=8080 && node servidor.js' : err.message);
  process.exit(1);
}).listen(PORT, 'localhost', () => console.log('J.S. rodando em http://localhost:' + PORT + '  (Ctrl+C para parar)'));
