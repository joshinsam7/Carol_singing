// database.js
const Database = require('better-sqlite3');
const db = new Database('bus_tracker.db', { verbose: console.log });

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
    tag TEXT
);
`);


// Ensure a single row exists for bus_info
const row = db.prepare("SELECT COUNT(*) AS count FROM bus_info").get();
if (row.count === 0) {
  db.prepare("INSERT INTO bus_info (lat, lng) VALUES (?, ?)").run(29.619707, -95.3193855);
}

module.exports = db;
//     "address": "2934 Dawn Haven Lane, Pearland TX 77584", -> 0.