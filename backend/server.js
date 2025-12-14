const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

require('dotenv').config();
const db = require("./database.js");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Heartbeat ping/pong to keep connections healthy
function heartbeat() { this.isAlive = true; }
const wsHealthInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch (_) {}
  });
}, 30000);

wss.on('close', () => clearInterval(wsHealthInterval));

const ADMIN_ROUTE_TOKEN = process.env.ADMIN_ROUTE_TOKEN;

//  Middleware 
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://192.168.1.207:3000',
  'http://192.168.1.207:3001',
  'https://carol-tracker-hs3m.onrender.com',
  'https://trinity-ys-caroling.netlify.app'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // mobile apps / Postman
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV === 'development') {
      // console.log("❌ CORS blocked origin:", origin);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//  Load stops from JSON if empty 
function loadStopsIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM stops").get().count;
  if (count === 0) {
    const stopsFile = path.join(__dirname, "database.json");
    const rawData = fs.readFileSync(stopsFile, "utf-8");
    const stopsData = JSON.parse(rawData);

    const stmt = db.prepare(
      "INSERT INTO stops (address, latitude, longitude, starting_time, families, display_order) VALUES (?, ?, ?, ?, ?, ?)"
    );

    let order = 0;
    for (const s of Object.values(stopsData.stops)) {
      stmt.run(
        s.address,
        s.latitude,
        s.longitude,
        s.starting_time || null,
        JSON.stringify(s.families || {}),
        order++
      );
    }
  } else {
    // Initialize display_order for existing stops if they don't have it
    const stopsWithoutOrder = db.prepare("SELECT id FROM stops WHERE display_order IS NULL OR display_order = 0 ORDER BY id").all();
    if (stopsWithoutOrder.length > 0) {
      const updateStmt = db.prepare("UPDATE stops SET display_order=? WHERE id=?");
      stopsWithoutOrder.forEach((stop, index) => {
        updateStmt.run(index, stop.id);
      });
    }
  }
}
loadStopsIfEmpty();

//  Print out the database contents for debugging (dev only)
if (process.env.NODE_ENV === 'development') {
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
}

//  Cache stops 
let cachedStops = db.prepare("SELECT * FROM stops ORDER BY display_order, id").all();

// Cache initial bus state (updated on broadcasts)
let cachedBusState = db.prepare("SELECT * FROM bus_info WHERE id=1").get();

// Prepared statements for cache updates
const getStopStmt = db.prepare("SELECT * FROM stops WHERE id=?");
const getAllStopsStmt = db.prepare("SELECT * FROM stops ORDER BY display_order, id");
const getBusStateStmt = db.prepare("SELECT * FROM bus_info WHERE id=1");

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
  cachedBusState = getBusStateStmt.get(); // Refresh cache

  const payload = {
    type: "bus_update",
    data: {
      status: cachedBusState.status,
      current_stop: cachedBusState.status === 'idle' ? cachedBusState.current_stop : null,
      destination_stop: cachedBusState.destination_stop_override ?? cachedBusState.destination_stop,
      lat: cachedBusState.lat,
      lng: cachedBusState.lng,
      // stops: relevantStops, 
      last_update: cachedBusState.last_update,
      arrivalTime: extra.arrivalTime || null,
      routeETA: extra.routeETA || null
    }
  };

  const message = JSON.stringify(payload);

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
      routeTokenHeader === ADMIN_ROUTE_TOKEN ||
      paramToken === ADMIN_ROUTE_TOKEN
    ) {
      return next();
    }
    return res.status(403).json({ error: "Forbidden" });
  }

// Validate route token (used by frontend guard)
app.get("/api/admin/:token/validate-route/", (req, res) => {
  if (req.params.token === ADMIN_ROUTE_TOKEN) {
    return res.json({ authorized: true });
  }
  return res.status(403).json({ authorized: false });
});

//  API Endpoints 
// Admin key verification (lightweight). Returns authorized:true if header matches.
app.get("/api/admin/:token/verify", (req, res) => {
  const key = req.headers['x-admin-key'];
  if (req.params.token === ADMIN_ROUTE_TOKEN) {
    return res.json({ authorized: true });
  }
  return res.status(403).json({ authorized: false });
});

// Bus location update
let lastBroadcastAt = 0;
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

  // Throttle broadcasts to at most once per second
  const now = Date.now();
  if (now - lastBroadcastAt >= 1000) {
    lastBroadcastAt = now;
    broadcastBusState();
  }
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
      // Find the current stop's index in the sorted cachedStops
      const currentIndex = cachedStops.findIndex(s => s.id === stopId);
      if (currentIndex !== -1) {
        // Start from the next position in the already-sorted array
        for (let i = currentIndex + 1; i < cachedStops.length; i++) {
          if (!cachedStops[i].arrived) {
            nextStop = cachedStops[i].id;
            break;
          }
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

    // Get the max display_order and add 1
    const maxOrder = db.prepare("SELECT MAX(display_order) as max FROM stops").get();
    const newDisplayOrder = (maxOrder.max || 0) + 1;

    // Insert into database
    const stmt = db.prepare(`
      INSERT INTO stops (address, latitude, longitude, starting_time, families, display_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(address, latitude, longitude, starting_time || null, JSON.stringify(families || {}), newDisplayOrder);

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

// Reorder stops
app.post("/api/admin/:token/reorder-stops", adminAuth, (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ success: false, error: "Invalid orderedIds" });
    }

    // console.log('Reordering stops:', orderedIds);

    // Update display_order for each stop based on its position in orderedIds
    const updateStmt = db.prepare("UPDATE stops SET display_order=? WHERE id=?");
    const transaction = db.transaction((ids) => {
      ids.forEach((stopId, index) => {
        updateStmt.run(index, stopId);
      });
    });

    transaction(orderedIds);

    // Refresh cache
    refreshStopsCache();

    // console.log('Stops reordered successfully, new order:', cachedStops.map(s => s.id));

    // Broadcast the reordered stops
    const payload = {
      type: "stops_reordered",
      stops: cachedStops
    };
    const message = JSON.stringify(payload);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    });

    res.json({ success: true, stops: cachedStops });
  } catch (err) {
    console.error('Error reordering stops:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/admin/:token/export-db", adminAuth, (req, res) => {
  try {
    const stops = db.prepare("SELECT * FROM stops").all();
    const busInfo = db.prepare("SELECT * FROM bus_info").all();

    const exportData = {
      stops: stops,
      bus_info: busInfo,
      exported_at: new Date().toISOString()
    };

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="bus-tracker-export-${Date.now()}.json"`);
    
    res.json(exportData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
}); 

// Ping endpoint
app.get("/ping", (req, res) => res.send("ok"));

// WebSocket connection
wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on('pong', heartbeat);

  // Use cached bus state (no DB read per connection)
  const payload = {
    type: "bus_update",
    data: {
      status: cachedBusState.status,
      current_stop: cachedBusState.status === 'idle' ? cachedBusState.current_stop : null,
      destination_stop: cachedBusState.destination_stop_override ?? cachedBusState.destination_stop,
      lat: cachedBusState.lat,
      lng: cachedBusState.lng,
      last_update: cachedBusState.last_update,
      arrivalTime: null,
      routeETA: null
    }
  };
  try { ws.send(JSON.stringify(payload)); } catch (_) {}

  ws.on("close", () => {});
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
