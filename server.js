import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, ensureSlots, getSlots } from './src/db.js';

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), 'public');

const STATIC_FILES = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/styles.css': { file: 'styles.css', type: 'text/css; charset=utf-8' },
  '/app.js': { file: 'app.js', type: 'text/javascript; charset=utf-8' },
};

const db = openDatabase();

function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function sendStatic(res, { file, type }) {
  const content = await readFile(join(PUBLIC_DIR, file));
  res.writeHead(200, { 'Content-Type': type });
  res.end(content);
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && pathname === '/api/slots') {
    const walkDate = today();
    ensureSlots(db, walkDate);
    sendJson(res, 200, { date: walkDate, slots: getSlots(db, walkDate) });
    return;
  }

  if (req.method === 'GET' && STATIC_FILES[pathname]) {
    await sendStatic(res, STATIC_FILES[pathname]);
    return;
  }

  sendJson(res, 404, { error: 'Не найдено' });
});

ensureSlots(db, today());

server.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});
