// Serves index.html plus the /api/game function, backed by the fake Redis.
require('./fake-redis.js').install(process.env.UPSTASH_REDIS_REST_URL || '');
const http = require('http');
const fs = require('fs');
const path = require('path');
const handler = require('./api/game.js');

const PORT = Number(process.env.PORT || 5600);

const server = http.createServer((req, res) => {
  if (req.url.split('?')[0] === '/api/game') {
    res.json = (obj) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(obj));
    };
    res.status = (c) => { res.statusCode = c; return res; };
    return handler(req, res);
  }
  if (req.url.split('?')[0] === '/logos.js') {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    return res.end(fs.readFileSync(path.join(__dirname, 'logos.js')));
  }
  const file = path.join(__dirname, 'index.html');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(fs.readFileSync(file));
});

server.listen(PORT, () => console.log('dev server on http://127.0.0.1:' + PORT));
