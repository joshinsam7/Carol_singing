// database.js
const Database = require('better-sqlite3');
const db = new Database('bus_tracker.db');

// Initialize tables
db.exec(`
CREATE TABLE IF NOT EXISTS bus_info (
    id INTEGER PRIMARY KEY,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    current_stop INTEGER DEFAULT NULL,           -- stop where bus is currently at
    destination_stop INTEGER DEFAULT NULL,       -- stop where bus is heading
    destination_stop_override INTEGER DEFAULT NULL, -- admin can override next stop
    trip_started INTEGER DEFAULT 0,
    status TEXT DEFAULT 'idle',                  -- 'idle' or 'en_route'
    waiting_for_approval INTEGER DEFAULT 0,
    last_update INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT,
    latitude REAL,
    longitude REAL,
    arrived TEXT,
    departed TEXT,
    starting_time TEXT,
    families TEXT,
    notes TEXT,
    tag TEXT,
    display_order INTEGER DEFAULT 0
);
`);


// Ensure a single row exists for bus_info
const row = db.prepare("SELECT COUNT(*) AS count FROM bus_info").get();
if (row.count === 0) {
  db.prepare("INSERT INTO bus_info (lat, lng) VALUES (?, ?)").run(29.619707, -95.3193855);
}

// Add display_order column if it doesn't exist (migration)
try {
  const columns = db.prepare("PRAGMA table_info(stops)").all();
  const hasDisplayOrder = columns.some(col => col.name === 'display_order');
  
  if (!hasDisplayOrder) {
    // console.log('Adding display_order column to stops table...');
    db.exec('ALTER TABLE stops ADD COLUMN display_order INTEGER DEFAULT 0');
    // console.log('display_order column added successfully');
  }
} catch (err) {
  console.error('Error checking/adding display_order column:', err);
}

module.exports = db;