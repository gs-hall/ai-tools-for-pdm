import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, ensureSlots, getSlots, getSlot, bookSlot, SLOT_TIMES } from './src/db.js';

const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY_BYTES = 10_000;
const MAX_NAME_LENGTH = 100;
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

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        reject(new Error('Слишком большой запрос.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Некорректный запрос.'));
      }
    });
    req.on('error', reject);
  });
}

function normalizeName(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

async function handleBooking(req, res) {
  let payload;
  try {
    payload = await readJson(req);
  } catch (error) {
    sendJson(res, 400, { error: error.message });
    return;
  }

  const { slotTime, name: rawName } = payload ?? {};
  const name = normalizeName(rawName);
  const walkDate = today();

  if (!SLOT_TIMES.includes(slotTime)) {
    sendJson(res, 400, { error: 'Такого слота нет.' });
    return;
  }
  if (!name) {
    sendJson(res, 400, { error: 'Введите ФИО.' });
    return;
  }
  if (name.length > MAX_NAME_LENGTH) {
    sendJson(res, 400, { error: `ФИО не длиннее ${MAX_NAME_LENGTH} символов.` });
    return;
  }

  ensureSlots(db, walkDate);
  const booked = bookSlot(db, walkDate, slotTime, name, new Date().toISOString());

  if (!booked) {
    const slot = getSlot(db, walkDate, slotTime);
    sendJson(res, 409, {
      error: `Слот ${slotTime} уже занят: ${slot.booked_by}. Выберите другой свободный слот.`,
      date: walkDate,
      slots: getSlots(db, walkDate),
    });
    return;
  }

  sendJson(res, 200, { date: walkDate, slots: getSlots(db, walkDate) });
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

  if (req.method === 'POST' && pathname === '/api/bookings') {
    await handleBooking(req, res);
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
