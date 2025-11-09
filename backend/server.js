const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

require('dotenv').config();
const db = require("./database.js");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// --- Middleware ---
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"], credentials: true }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- Load stops from JSON if empty ---
function loadStopsIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM stops").get().count;
  if (count === 0) {
    const stopsFile = path.join(__dirname, "database.json");
    const rawData = fs.readFileSync(stopsFile, "utf-8");
    const stopsData = JSON.parse(rawData);

    const stmt = db.prepare(
      "INSERT INTO stops (address, latitude, longitude, starting_time, families) VALUES (?, ?, ?, ?, ?)"
    );

    for (const s of Object.values(stopsData.stops)) {
      stmt.run(
        s.address,
        s.latitude,
        s.longitude,
        s.starting_time || null,
        JSON.stringify(s.families || {})
      );
    }
    console.log(`Inserted ${Object.keys(stopsData.stops).length} stops into the database.`);
  }
}
loadStopsIfEmpty();

// --- Print out the database contents for debugging ---
try {
  const stops = db.prepare("SELECT * FROM stops").all();
  const busInfo = db.prepare("SELECT * FROM bus_info").all();

  console.log("\n================= 🗺️ Stops Table =================");
  console.table(stops);

  console.log("\n================= 🚌 Bus Info Table ================");
  console.table(busInfo);

  console.log("==================================================\n");
} catch (err) {
  console.error("❌ Error reading database:", err);
}

// --- Cache stops ---
const cachedStops = db.prepare("SELECT * FROM stops ORDER BY id").all();
function getStopById(id) {
  return cachedStops.find(s => s.id === id) || null;
}

// --- WebSocket Broadcast ---
function broadcastBusState() {
  const busState = db.prepare("SELECT * FROM bus_info WHERE id=1").get();
  const payload = {
    type: "bus_update",
    data: {
      status: busState.status,
      current_stop: busState.status === 'idle' ? busState.current_stop : null,
      destination_stop: busState.destination_stop_override ?? busState.destination_stop,
      lat: busState.lat,
      lng: busState.lng,
      last_update: busState.last_update,
    }
  };

  const message = JSON.stringify(payload);
  console.log(message);

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  });
}

// --- API Endpoints ---

// Bus location update
app.post("/api/bus-location", (req, res) => {
  const { lat, lon } = req.body;
  if (lat == null || lon == null) return res.status(400).json({ success: false });

  const busState = db.prepare("SELECT * FROM bus_info WHERE id=1").get();
  const tripJustStarted = !busState.trip_started;

  db.prepare(`
    UPDATE bus_info 
    SET lat=?, lng=?, last_update=?, trip_started=1
    WHERE id=1
  `).run(lat, lon, Date.now());

  if (tripJustStarted && cachedStops.length > 0) {
    // First post → set destination_stop to first stop
    db.prepare(`
      UPDATE bus_info
      SET status='en_route',
          current_stop=NULL,
          destination_stop=?
      WHERE id=1
    `).run(cachedStops[0].id);
  }

  broadcastBusState();
  res.json({ success: true });
});



// Get all stops
app.get("/api/getStops", (req, res) => {
  res.json({ stops: cachedStops });
});

// Get current bus state
app.get("/api/bus-state", (req, res) => {
  const busState = db.prepare("SELECT * FROM bus_info WHERE id=1").get();
  res.json(busState);
});

// --- Stop Arrived ---
app.post("/api/stop-arrived", (req, res) => {
  const { stopId, timestamp } = req.body;
  if (!stopId || !timestamp) return res.status(400).json({ success: false });

  // Mark the stop as arrived in stops table
  db.prepare("UPDATE stops SET arrived=? WHERE id=?").run(timestamp, stopId);

  // Update bus state
  const busState = db.prepare("SELECT * FROM bus_info WHERE id=1").get();
  const nextStop = busState.destination_stop_override ?? busState.destination_stop;

  db.prepare(`
    UPDATE bus_info
    SET status='idle',
        current_stop=?,
        destination_stop=?,
        waiting_for_approval=1
    WHERE id=1
  `).run(stopId, nextStop);

  broadcastBusState();
  res.json({ success: true });
});

// --- Stop Departed ---
app.post("/api/stop-departed", (req, res) => {
  const { stopId, timestamp } = req.body;
  if (!stopId || !timestamp) return res.status(400).json({ success: false });

  // Mark the stop as departed in stops table
  db.prepare("UPDATE stops SET departed=? WHERE id=?").run(timestamp, stopId);

  // Determine next stop
  const busState = db.prepare("SELECT * FROM bus_info WHERE id=1").get();
  const nextStop = busState.destination_stop_override ?? (() => {
    const currentIndex = cachedStops.findIndex(s => s.id === stopId);
    return cachedStops[currentIndex + 1]?.id || null;
  })();

  db.prepare(`
    UPDATE bus_info
    SET status='en_route',
        current_stop=NULL,
        destination_stop=?,
        destination_stop_override=NULL,
        waiting_for_approval=0
    WHERE id=1
  `).run(nextStop);

  broadcastBusState();
  res.json({ success: true });
});

// Admin can override next stop
app.post("/api/set-next-stop", (req, res) => {
  const { nextStopId } = req.body;
  if (!nextStopId) return res.status(400).json({ success: false, error: "Missing nextStopId" });

  db.prepare(`
    UPDATE bus_info
    SET destination_stop_override = ?
    WHERE id=1
  `).run(nextStopId);

  broadcastBusState();
  res.json({ success: true, next_stop_id: nextStopId });
});

// Ping endpoint
app.get("/ping", (req, res) => res.send("ok"));

// WebSocket connection
wss.on("connection", (ws) => {
  console.log("Client connected via WebSocket");

  const busState = db.prepare("SELECT * FROM bus_info WHERE id=1").get();
  ws.send(JSON.stringify({
    type: "bus_update",
    data: {
      status: busState.status,
      at_stop: busState.status === 'idle' ? busState.current_stop : null,
      destination_stop: busState.destination_stop,
      last_update: busState.last_update
    }
  }));

  ws.on("close", () => console.log("Client disconnected"));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
