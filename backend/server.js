
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

require('dotenv').config();

const db = require("./database.js"); // use single database.js instance


const app = express();


const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// --- Middleware ---db.
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json()); // <--- add this
app.use(bodyParser.urlencoded({ extended: true })); // optional for form data

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

// --- WebSocket Broadcast ---
function broadcastUpdate(payload) {
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// --- API Endpoints ---

// Bus location update
app.post("/api/bus-location", (req, res) => {
  console.log("📩 Incoming payload:", req.body);

  const { lat, lon } = req.body;
  if (lat == null || lon == null) {
    return res.status(400).json({ success: false, message: "Invalid lat/lon", received: req.body });
  }

  const busState = db.prepare("SELECT * FROM bus_info WHERE id=1").get();

  // 🚀 Detect first data (trip not started)
  const tripJustStarted = !busState.trip_started;

  // Update location + mark started
  db.prepare(`
    UPDATE bus_info 
    SET lat=?, lng=?, trip_started=1, last_update=? 
    WHERE id=1
  `).run(lat, lon, Date.now());

  console.log("✅ Latitude:", lat, "Longitude:", lon);

  // Fetch the updated row
  const updatedBusState = db.prepare("SELECT * FROM bus_info WHERE id=1").get();

  // 🔔 Broadcast
  if (tripJustStarted) {
    broadcastUpdate({ type: "trip_started", data: updatedBusState });
  } else {
    broadcastUpdate({ type: "bus_update", data: updatedBusState });
  }

  res.json({ success: true, busLocation: updatedBusState });
});

// Get all stops
app.get("/api/getStops", (req, res) => {
  const stops = db.prepare("SELECT * FROM stops ORDER BY id").all();
  res.json({ stops });
});

// Get current bus state
app.get("/api/bus-state", (req, res) => {
  const busState = db.prepare("SELECT * FROM bus_info WHERE id=1").get();
  res.json(busState);
});

// --- Stop Arrived ---
app.post("/api/stop-arrived", (req, res) => {
  const { stopId, timestamp, nextStopId } = req.body;
  if (stopId == null || !timestamp)
    return res.status(400).json({ success: false, message: "stopId and timestamp are required" });

  db.prepare("UPDATE stops SET arrived=? WHERE id=?").run(timestamp, stopId);

  // Update bus_info: idle + currentStop + nextStop
  const nextStop = nextStopId != null ? nextStopId : stopId + 1;
  db.prepare(
    `UPDATE bus_info SET status='idle', current_stop=?, next_stop_id=? WHERE id=1`
  ).run(stopId, nextStop);

  const stop = db.prepare("SELECT * FROM stops WHERE id=?").get(stopId);
  broadcastUpdate({ type: "stop_update", data: stop });
  res.json({ success: true, stop, nextStop });
});

// --- Stop Departed ---
app.post("/api/stop-departed", (req, res) => {
  const { stopId, timestamp, nextStopId } = req.body;
  if (stopId == null || !timestamp)
    return res.status(400).json({ success: false, message: "stopId and timestamp are required" });

  db.prepare("UPDATE stops SET departed=? WHERE id=?").run(timestamp, stopId);

  const nextStop = nextStopId != null ? nextStopId : stopId + 1;
  db.prepare(
    `UPDATE bus_info SET status='en route', next_stop_id=? WHERE id=1`
  ).run(nextStop);

  const stop = db.prepare("SELECT * FROM stops WHERE id=?").get(stopId);
  broadcastUpdate({ type: "stop_update", data: stop });
  res.json({ success: true, stop, nextStop });
});

// --- WebSocket connection ---
wss.on("connection", (ws) => {
  console.log("Client connected via WebSocket");

  // Send current bus state
  const busState = db.prepare("SELECT * FROM bus_info WHERE id=1").get();
  ws.send(JSON.stringify({ type: "bus_update", data: busState }));

  ws.on("close", () => console.log("Client disconnected"));
});

// --- Start server ---
const PORT = process.env.PORT;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
