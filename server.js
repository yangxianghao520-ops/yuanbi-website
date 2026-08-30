/* ============================================================
   重庆圆皕齿轮官网 — 本地服务器
   功能：静态文件服务 + 询价API + 后台管理API
   启动：node server.js
   ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

// ---------- 配置 ----------
const CONFIG = {
  portStart: 8090,
  portEnd: 9090,
  adminPassword: '987202',
  dataDir: path.join(__dirname, 'data'),
  dataFile: path.join(__dirname, 'data', 'inquiries.json'),
  tokenSecret: 'yuanbi-gear-' + Date.now(),
  tokenExpire: 24 * 60 * 60 * 1000,
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function ensureDataDir() {
  if (!fs.existsSync(CONFIG.dataDir)) { fs.mkdirSync(CONFIG.dataDir, { recursive: true }); }
  if (!fs.existsSync(CONFIG.dataFile)) { fs.writeFileSync(CONFIG.dataFile, '[]', 'utf-8'); }
}

function readInquiries() {
  try {
    let raw = fs.readFileSync(CONFIG.dataFile, 'utf-8');
    if (raw.charCodeAt(0) === 0xFEFF) { raw = raw.slice(1); }
    return JSON.parse(raw);
  } catch (e) { console.error('读取询价数据失败:', e.message); return []; }
}

function writeInquiries(list) { fs.writeFileSync(CONFIG.dataFile, JSON.stringify(list, null, 2), 'utf-8'); }

function generateToken() {
  const payload = Date.now() + '|' + CONFIG.tokenSecret;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

const validTokens = new Set();
function verifyToken(token) { if (!token) return false; return validTokens.has(token); }

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

function getAuthToken(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(__dirname, urlPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  if (!filePath.startsWith(__dirname)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      const notFoundPath = path.join(__dirname, '404.html');
      fs.readFile(notFoundPath, (err404, data404) => {
        if (err404) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404 Not Found'); }
        else { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(data404); }
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

async function handleAPI(req, res) {
  const urlPath = req.url.split('?')[0];

  if (urlPath === '/api/inquiry' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { company, contact, phone, email, productType, description } = body;
      if (!company || !contact || !phone || !productType || !description) { sendJSON(res, 400, { success: false, message: '请填写所有必填字段' }); return; }
      if (description.length < 10) { sendJSON(res, 400, { success: false, message: '需求详情至少10个字符' }); return; }
      const inquiry = {
        id: Date.now(), createdAt: new Date().toISOString(),
        company: String(company).trim(), contact: String(contact).trim(),
        phone: String(phone).trim(), email: email ? String(email).trim() : '',
        productType: String(productType), description: String(description).trim(),
        status: '未处理',
      };
      const list = readInquiries();
      list.unshift(inquiry);
      writeInquiries(list);
      console.log(`[新询价] ${inquiry.company} - ${inquiry.contact} - ${inquiry.productType}`);
      sendJSON(res, 200, { success: true, message: '询价已提交，我们将在24小时内与您联系' });
    } catch (e) { sendJSON(res, 500, { success: false, message: '服务器错误，请稍后重试' }); }
    return;
  }

  if (urlPath === '/api/admin/login' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { password } = body;
      if (password === CONFIG.adminPassword) {
        const token = generateToken();
        validTokens.add(token);
        setTimeout(() => validTokens.delete(token), CONFIG.tokenExpire);
        sendJSON(res, 200, { success: true, token });
      } else { sendJSON(res, 401, { success: false, message: '密码错误' }); }
    } catch (e) { sendJSON(res, 500, { success: false, message: '服务器错误' }); }
    return;
  }

  if (urlPath === '/api/inquiries' && req.method === 'GET') {
    const token = getAuthToken(req);
    if (!verifyToken(token)) { sendJSON(res, 401, { success: false, message: '未授权，请先登录' }); return; }
    const list = readInquiries();
    sendJSON(res, 200, { success: true, data: list, total: list.length });
    return;
  }

  const deleteMatch = urlPath.match(/^\/api\/inquiry\/(\d+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const token = getAuthToken(req);
    if (!verifyToken(token)) { sendJSON(res, 401, { success: false, message: '未授权' }); return; }
    const id = parseInt(deleteMatch[1]);
    const list = readInquiries();
    const filtered = list.filter(item => item.id !== id);
    if (filtered.length === list.length) { sendJSON(res, 404, { success: false, message: '记录不存在' }); return; }
    writeInquiries(filtered);
    sendJSON(res, 200, { success: true, message: '已删除' });
    return;
  }

  sendJSON(res, 404, { success: false, message: 'API不存在' });
}

function findAvailablePort(start, end) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      if (port > end) { reject(new Error(`No available port between ${start} and ${end}`)); return; }
      const server = http.createServer();
      server.once('error', (err) => { if (err.code === 'EADDRINUSE') { tryPort(port + 1); } else { reject(err); } });
      server.once('listening', () => { server.close(() => resolve(port)); });
      server.listen(port, '127.0.0.1');
    };
    tryPort(start);
  });
}

function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  if (platform === 'win32') cmd = `start "" "${url}"`;
  else if (platform === 'darwin') cmd = `open "${url}"`;
  else cmd = `xdg-open "${url}"`;
  exec(cmd, (err) => { if (err) console.log('请手动打开浏览器访问:', url); });
}

async function main() {
  ensureDataDir();
  try {
    const port = await findAvailablePort(CONFIG.portStart, CONFIG.portEnd);
    const server = http.createServer((req, res) => {
      if (req.url.startsWith('/api/')) { handleAPI(req, res); } else { serveStatic(req, res); }
    });
    server.listen(port, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${port}`;
      console.log('');
      console.log('========================================');
      console.log('  重庆圆皕齿轮官网 已启动');
      console.log('========================================');
      console.log(`  访问地址: ${url}`);
      console.log(`  后台管理: ${url}/admin.html`);
      console.log(`  管理员密码: ${CONFIG.adminPassword}`);
      console.log(`  数据文件: data/inquiries.json`);
      console.log('========================================');
      console.log('  按 Ctrl+C 停止服务器');
      console.log('========================================');
      console.log('');
      openBrowser(url);
    });
  } catch (e) { console.error('启动失败:', e.message); process.exit(1); }
}

main();