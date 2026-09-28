import { createServer } from 'node:http';
import { openDatabase, ensureSlots, getSlots } from './src/db.js';

const PORT = Number(process.env.PORT) || 3000;

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

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/api/slots') {
    const walkDate = today();
    ensureSlots(db, walkDate);
    sendJson(res, 200, { date: walkDate, slots: getSlots(db, walkDate) });
    return;
  }
  sendJson(res, 404, { error: 'Не найдено' });
});

ensureSlots(db, today());

server.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});
