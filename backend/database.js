const Database = require('better-sqlite3');
const db = new Database('bus_tracker.db', { verbose: console.log });

// Initialize tables
db.exec(`
CREATE TABLE IF NOT EXISTS bus_info (
    id INTEGER PRIMARY KEY,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    next_stop_id INTEGER DEFAULT 0,
    trip_started INTEGER DEFAULT 0,
    current_stop INTEGER DEFAULT -1,
    status TEXT DEFAULT 'idle',
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
    tag TEXT
);
`);

// Ensure a single row exists for bus_info
const row = db.prepare("SELECT COUNT(*) AS count FROM bus_info").get();
if (row.count === 0) {
  db.prepare("INSERT INTO bus_info (lat, lng) VALUES (?, ?)").run(29.619707, -95.3193855);
}

module.exports = db;