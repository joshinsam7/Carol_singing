const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

require('dotenv').config();
const db = require("./database.js");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Generate a random admin route token per process start (obscurity layer, not real auth)
const ADMIN_ROUTE_TOKEN = crypto.randomBytes(12).toString("hex");
console.log(`\n🔐 Admin route token generated: ${ADMIN_ROUTE_TOKEN}`);
console.log(`🔗 Admin URL path: /admin/${ADMIN_ROUTE_TOKEN}`);

//  Middleware 
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"], credentials: true }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

//  Load stops from JSON if empty 
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

//  Print out the database contents for debugging 
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

//  Cache stops 
let cachedStops = db.prepare("SELECT * FROM stops ORDER BY id").all();

// Prepared statements for cache updates
const getStopStmt = db.prepare("SELECT * FROM stops WHERE id=?");
const getAllStopsStmt = db.prepare("SELECT * FROM stops ORDER BY id");

// Full cache refresh (use only for add/delete operations)
function refreshStopsCache() {
  cachedStops = getAllStopsStmt.all();
}

// Selective cache update for a single stop (more efficient)
function updateStopInCache(stopId) {
  const updatedStop = getStopStmt.get(stopId);
  if (!updatedStop) return;
  
  const index = cachedStops.findIndex(s => s.id === stopId);
  if (index !== -1) {
    cachedStops[index] = updatedStop;
  }
}

function getStopById(id) {
  return cachedStops.find(s => s.id === id) || null;
}

//  WebSocket Broadcast 
function broadcastBusState(extra = {}) {
  const busState = db.prepare("SELECT * FROM bus_info WHERE id=1").get();

  const payload = {
    type: "bus_update",
    data: {
      status: busState.status,
      current_stop: busState.status === 'idle' ? busState.current_stop : null,
      destination_stop: busState.destination_stop_override ?? busState.destination_stop,
      lat: busState.lat,
      lng: busState.lng,
      // stops: relevantStops, 
      last_update: busState.last_update,
      arrivalTime: extra.arrivalTime || null,
      routeETA: extra.routeETA || null
    }
  };

  const message = JSON.stringify(payload);
  console.log("Broadcasted Message " + message);

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  });
}

// middlewares for admin
  function adminAuth(req, res, next) {
    const key = req.headers["x-admin-key"];
    const routeTokenHeader = req.headers["x-admin-route-token"];
    const paramToken = req.params.token; // present on /api/admin/:token/... routes
    if (
      key === process.env.ADMIN_SECRET ||
      routeTokenHeader === ADMIN_ROUTE_TOKEN ||
      paramToken === ADMIN_ROUTE_TOKEN
    ) {
      return next();
    }
    return res.status(403).json({ error: "Forbidden" });
  }

// Validate route token (used by frontend guard)
app.get("/api/admin/validate-route/:token", (req, res) => {
  if (req.params.token === ADMIN_ROUTE_TOKEN) {
    return res.json({ authorized: true });
  }
  return res.status(403).json({ authorized: false });
});

//  API Endpoints 
// Admin key verification (lightweight). Returns authorized:true if header matches.
app.get("/api/admin/:token/verify", (req, res) => {
  const key = req.headers['x-admin-key'];
  if ((key && key === process.env.ADMIN_SECRET) || req.params.token === ADMIN_ROUTE_TOKEN) {
    return res.json({ authorized: true });
  }
  return res.status(403).json({ authorized: false });
});

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
  // Transform stops to include arrivalTime for frontend compatibility
  const stopsWithArrivalTime = cachedStops.map(stop => ({
    ...stop,
    arrivalTime: stop.arrived ? Number(stop.arrived) : null
  }));
  res.json({ stops: stopsWithArrivalTime });
});

// Get current bus state
app.get("/api/bus-state", (req, res) => {
  const busState = db.prepare("SELECT * FROM bus_info WHERE id=1").get();
  res.json(busState);
});

//  Stop Arrived 
app.post("/api/admin/:token/stop-arrived", adminAuth, (req, res) => {
  const { stopId, timestamp } = req.body;
  
  if (!stopId || !timestamp) return res.status(400).json({ success: false });

  db.prepare("UPDATE stops SET arrived=? WHERE id=?").run(timestamp, stopId);
  updateStopInCache(stopId); // Update only this stop in cache

  const busState = db.prepare("SELECT * FROM bus_info WHERE id=1").get();
  const nextStop = busState.destination_stop_override ?? busState.destination_stop;

  // Get the stop's coordinates to snap the bus location
  const stop = getStopById(stopId);
  
  db.prepare(`
    UPDATE bus_info
    SET status='idle',
        current_stop=?,
        destination_stop=?,
        lat=?,
        lng=?,
        waiting_for_approval=1
    WHERE id=1
  `).run(stopId, nextStop, stop.latitude, stop.longitude);

  // ✅ Include arrival time in broadcast
  broadcastBusState({ arrivalTime: timestamp });
  res.json({ success: true });
});

//  Stop Departed 
app.post("/api/admin/:token/stop-departed", adminAuth, async (req, res) => {
  try {
    const { stopId, timestamp, nextStopOverride } = req.body;
    if (!stopId || !timestamp) return res.status(400).json({ success: false });

    const currentStop = getStopById(stopId);
    if (!currentStop) return res.status(400).json({ success: false, error: "Invalid stopId" });

    // Update departed timestamp
    db.prepare("UPDATE stops SET departed=? WHERE id=?").run(timestamp, stopId);
    updateStopInCache(stopId); // Update only this stop in cache

    // Determine next stop
    let nextStop = nextStopOverride || null;

    if (!nextStop) {
      // Find the first stop after current that has no 'arrived' timestamp
      const currentIndex = cachedStops.findIndex(s => s.id === stopId);
      for (let i = currentIndex + 1; i < cachedStops.length; i++) {
        if (!cachedStops[i].arrived) {
          nextStop = cachedStops[i].id;
          break;
        }
      }
    }

    // Calculate ETA if next stop exists
    let routeETA = null;
    if (currentStop && nextStop) {
      try {
        const nextStopData = getStopById(nextStop);
        const url = `https://router.project-osrm.org/route/v1/driving/${currentStop.longitude},${currentStop.latitude};${nextStopData.longitude},${nextStopData.latitude}?overview=false`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.code === "Ok" && data.routes?.length > 0) {
          routeETA = Math.round(data.routes[0].duration);
        }
      } catch (err) {
        console.error("❌ Error fetching ETA:", err.message);
      }
    }

    // Update bus_info for next stop
    db.prepare(`
      UPDATE bus_info
      SET status='en_route',
          current_stop=NULL,
          destination_stop=?,
          destination_stop_override=NULL,
          waiting_for_approval=0
      WHERE id=1
    `).run(nextStop);

    // Broadcast updated bus state
    broadcastBusState({ routeETA });

    res.json({ success: true, eta: routeETA, nextStop });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin can override next stop
app.post("/api/admin/:token/set-next-stop", adminAuth, async (req, res) => {
  try {
    const { nextStopId } = req.body;
    if (!nextStopId) return res.status(400).json({ success: false, error: "Missing nextStopId" });

    const busState = db.prepare("SELECT * FROM bus_info WHERE id=1").get();
    const nextStopData = getStopById(nextStopId);
    
    if (!nextStopData) {
      return res.status(400).json({ success: false, error: "Invalid nextStopId" });
    }

    db.prepare(`
      UPDATE bus_info
      SET destination_stop_override = ?
      WHERE id=1
    `).run(nextStopId);

    // Calculate new ETA if bus is currently en_route
    let routeETA = null;
    if (busState.status === 'en_route' && busState.lat && busState.lng) {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${busState.lng},${busState.lat};${nextStopData.longitude},${nextStopData.latitude}?overview=false`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.code === "Ok" && data.routes?.length > 0) {
          routeETA = Math.round(data.routes[0].duration);
        }
      } catch (err) {
        console.error("❌ Error fetching ETA:", err.message);
      }
    }

    broadcastBusState({ routeETA });
    res.json({ success: true, next_stop_id: nextStopId, eta: routeETA });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add a new stop
app.post("/api/admin/:token/add-stop", adminAuth, async (req, res) => {
  try {
    const { address, starting_time, families } = req.body;
    if (!address) {
      return res.status(400).json({ success: false, error: "Missing required stop data" });
    }

    // Compute latitude and longitude
    const { latitude, longitude } = await getLatitudeLongitude(address);

    // Insert into database
    const stmt = db.prepare(`
      INSERT INTO stops (address, latitude, longitude, starting_time, families)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(address, latitude, longitude, starting_time || null, JSON.stringify(families || {}));

    // Refresh cache and get the new stop
    refreshStopsCache();
    const newStop = db.prepare("SELECT * FROM stops WHERE id=?").get(info.lastInsertRowid);

    // ✅ Broadcast only the new stop
    const payload = {
      type: "stop_added",
      stop: newStop
    };
    const message = JSON.stringify(payload);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    });

    res.json({ success: true, stop: newStop });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper function to compute latitude and longitude from address
async function getLatitudeLongitude(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
  const response = await fetch(url, { headers: { "User-Agent": "BusTrackerApp/1.0" } });
  const data = await response.json();

  if (!data || data.length === 0) {
    throw new Error("Unable to geocode address");
  }

  return {
    latitude: parseFloat(data[0].lat),
    longitude: parseFloat(data[0].lon)
  };
}

// Delete a stop
app.post("/api/admin/:token/delete-stop", adminAuth, (req, res) => {
  try {
    const { stopId } = req.body;
    if (!stopId) return res.status(400).json({ success: false, error: "Missing stopId" });

    const stopIndex = cachedStops.findIndex(s => s.id === stopId);
    if (stopIndex === -1) return res.status(404).json({ success: false, error: "Stop not found" });

    // Remove from database
    db.prepare("DELETE FROM stops WHERE id=?").run(stopId);

    // Refresh cache
    refreshStopsCache();

    // ✅ Broadcast only the removed stop
    const payload = {
      type: "stop_removed",
      stopId
    };
    const message = JSON.stringify(payload);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    });

    res.json({ success: true, stopId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
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
