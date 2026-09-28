import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  openDatabase,
  ensureSlots,
  getSlots,
  getSlot,
  bookSlot,
  addFeeding,
  getLastFeeding,
  SLOT_TIMES,
} from './src/db.js';

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

class BadRequestError extends Error {}

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
        reject(new BadRequestError('Слишком большой запрос.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body) ?? {});
      } catch {
        reject(new BadRequestError('Некорректный запрос.'));
      }
    });
    req.on('error', reject);
  });
}

function validateName(value) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!name) {
    return { error: 'Введите ФИО.' };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { error: `ФИО не длиннее ${MAX_NAME_LENGTH} символов.` };
  }
  return { name };
}

function slotsState() {
  const walkDate = today();
  ensureSlots(db, walkDate);
  return { date: walkDate, slots: getSlots(db, walkDate) };
}

async function handleBooking(req, res) {
  const { slotTime, name: rawName } = await readJson(req);

  if (!SLOT_TIMES.includes(slotTime)) {
    sendJson(res, 400, { error: 'Такого слота нет.' });
    return;
  }
  const { name, error } = validateName(rawName);
  if (error) {
    sendJson(res, 400, { error });
    return;
  }

  const walkDate = today();
  ensureSlots(db, walkDate);
  if (!bookSlot(db, walkDate, slotTime, name, new Date().toISOString())) {
    const slot = getSlot(db, walkDate, slotTime);
    sendJson(res, 409, {
      error: `Слот ${slotTime} уже занят: ${slot.booked_by}. Выберите другой свободный слот.`,
      ...slotsState(),
    });
    return;
  }

  sendJson(res, 200, slotsState());
}

async function handleFeeding(req, res) {
  const { name: rawName } = await readJson(req);
  const { name, error } = validateName(rawName);
  if (error) {
    sendJson(res, 400, { error });
    return;
  }

  addFeeding(db, name, new Date().toISOString());
  sendJson(res, 200, { lastFeeding: getLastFeeding(db) });
}

async function sendStatic(res, { file, type }) {
  const content = await readFile(join(PUBLIC_DIR, file));
  res.writeHead(200, { 'Content-Type': type });
  res.end(content);
}

async function route(req, res) {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && pathname === '/api/slots') {
    sendJson(res, 200, slotsState());
    return;
  }
  if (req.method === 'POST' && pathname === '/api/bookings') {
    await handleBooking(req, res);
    return;
  }
  if (req.method === 'GET' && pathname === '/api/feedings/last') {
    sendJson(res, 200, { lastFeeding: getLastFeeding(db) });
    return;
  }
  if (req.method === 'POST' && pathname === '/api/feedings') {
    await handleFeeding(req, res);
    return;
  }
  if (req.method === 'GET' && STATIC_FILES[pathname]) {
    await sendStatic(res, STATIC_FILES[pathname]);
    return;
  }

  sendJson(res, 404, { error: 'Не найдено.' });
}

const server = createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (error) {
    if (error instanceof BadRequestError) {
      sendJson(res, 400, { error: error.message });
      return;
    }
    console.error(error);
    sendJson(res, 500, { error: 'Внутренняя ошибка сервера.' });
  }
});

ensureSlots(db, today());

server.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});
