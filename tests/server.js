// Máy chủ thử nghiệm: phục vụ giao diện + chạy Code.gs (giả lập) tại /exec để test tích hợp thật giữa web và Apps Script.
const http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm');
const { makeGlobals } = require('./gas-mock');
const { g } = makeGlobals();
const ctx = vm.createContext(g);
const root = path.join(__dirname, '..');
vm.runInContext(fs.readFileSync(root + '/apps-script/Core.gs', 'utf8'), ctx);
vm.runInContext(fs.readFileSync(root + '/apps-script/Code.gs', 'utf8'), ctx);
ctx.setup();
const pins = {};
['ADMIN', 'BGD', 'NM1-VP', 'NM1-X1', 'NM1-X2', 'NM1-KHO', 'NM2-VP', 'NM2-X1', 'NM2-X2'].forEach(u => pins[u] = ctx.resetPin(u));
fs.writeFileSync('/tmp/pins.json', JSON.stringify(pins));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/exec')) {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      const out = ctx.doPost({ postData: { contents: body } }).getContent();
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(out);
    }); return;
  }
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  if (p === '/js/config.js') {
    const s = fs.readFileSync(root + p, 'utf8').replace(/API_URL:\s*''/, "API_URL: '/exec'");
    res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(s);
  }
  fs.readFile(root + p, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(8766, () => console.log('listening 8766'));
