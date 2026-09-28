import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const DB_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'boris.sqlite');

export const SLOT_TIMES = ['09:00', '11:00', '13:00', '15:00', '17:00'];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS walk_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  walk_date TEXT NOT NULL,
  slot_time TEXT NOT NULL,
  booked_by TEXT,
  booked_at TEXT,
  UNIQUE (walk_date, slot_time),
  CHECK (
    (booked_by IS NULL AND booked_at IS NULL)
    OR
    (booked_by IS NOT NULL AND booked_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS feedings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_name TEXT NOT NULL,
  fed_at TEXT NOT NULL
);
`;

export function openDatabase() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(SCHEMA);
  return db;
}

export function ensureSlots(db, walkDate) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO walk_slots (walk_date, slot_time) VALUES (?, ?)'
  );
  db.exec('BEGIN');
  try {
    for (const slotTime of SLOT_TIMES) {
      insert.run(walkDate, slotTime);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function getSlots(db, walkDate) {
  return db
    .prepare(
      'SELECT slot_time, booked_by, booked_at FROM walk_slots WHERE walk_date = ? ORDER BY slot_time'
    )
    .all(walkDate);
}
