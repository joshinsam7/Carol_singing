const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

if (process.env.FUNCTIONS_EMULATOR) {
  admin.database().useEmulator("127.0.0.1", 9000);
}

// 1️⃣ Update Bus Location (only when in transit)
exports.updateBusLocation = functions.https.onRequest(async (req, res) => {
  console.log("Received request");
  console.log("Body:", req.body);

  try {
    const data = req.body;
    if (!data.lat || !data.lon) {
      console.warn("Missing lat/lon!");
    }

    await admin.database().ref("busLocations/" + data.tid).set({
      lat: data.lat,
      lon: data.lon,
      tst: data.tst
    });

    console.log("Database write successful");
    res.status(200).send("OK");
  } catch (err) {
    console.error("Error storing location:", err);
    res.status(500).send(err.message);
  }
});



// 2️⃣ Get Current Bus Location
exports.getBusLocation = functions.https.onRequest(async (req, res) => {
  try {
    const busLocationSnap = await admin.database().ref("busLocation").once("value");
    const statusSnap = await admin.database().ref("status").once("value");

    const busLocation = busLocationSnap.val() || { lat: null, lng: null };
    const status = statusSnap.val() || { busStatus: "idle", lastUpdate: null };

    res.json({
      lat: busLocation.lat,
      lng: busLocation.lng,
      busStatus: status.busStatus,
      lastUpdate: status.lastUpdate,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});


  // 2️⃣ Get Bus Status
  exports.busStatus = functions.https.onRequest(async (req, res) => {
    try {
      const db = admin.database();

      const [currentStopSnap, nextStopSnap, stopsSnap] = await Promise.all([
        db.ref("currentStop").once("value"),
        db.ref("nextStop").once("value"),
        db.ref("stops").once("value"),
      ]);

      const currentStopIndex = currentStopSnap.val();
      const nextStopIndex = nextStopSnap.val();
      const stops = stopsSnap.val();

      const busLocationSnap = await db.ref("busLocation").once("value");
      const busLocation = busLocationSnap.val();

      const busStatus = currentStopIndex == null && nextStopIndex === 0 ? "idle" :
                        nextStopIndex != null ? "inTransit" : "idle";

      const currentStopData = currentStopIndex != null ? {
        id: currentStopIndex,
        Address: stops[currentStopIndex]?.address,
        startingTime: stops[currentStopIndex]?.starting_time,
        arrivedAt: stops[currentStopIndex]?.Arrived || null,
        departedAt: stops[currentStopIndex]?.Departure || null,
      } : null;

      const nextStopData = nextStopIndex != null ? {
        id: nextStopIndex,
        Address: stops[nextStopIndex]?.address,
        startingTime: stops[nextStopIndex]?.starting_time,
        arrivedAt: stops[nextStopIndex]?.Arrived || null,
        departedAt: stops[nextStopIndex]?.Departure || null,
      } : null;

      res.json({
        currentStop: currentStopData,
        nextStop: nextStopData,
        busStatus,
        lastUpdate: new Date().toLocaleTimeString(),
        currentLocation: busLocation || null,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal error" });
    }
  });

// 3️⃣ Mark Stop as Arrived (and move to next stop)
  exports.markArrived = functions.https.onRequest(async (req, res) => {
    try {
      const db = admin.database();

      const nextStopSnap = await db.ref("nextStop").once("value");
      const nextStopIndex = nextStopSnap.val();
      if (nextStopIndex == null) return res.status(400).json({ error: "Next stop not set" });

      const arrivedTime = new Date().toLocaleTimeString();

      await db.ref(`stops/${nextStopIndex}`).update({ Arrived: arrivedTime });

      await db.ref("currentStop").set(nextStopIndex);

      // Increment nextStop
      const nextStopIdSnap = await db.ref("nextStopId").once("value");
      const nextStopId = nextStopIdSnap.val();
      await db.ref("nextStop").set(nextStopIndex + 1 < nextStopId ? nextStopIndex + 1 : null);

      res.json({
        success: true,
        currentStop: nextStopIndex,
        nextStop: nextStopIndex + 1 < nextStopId ? nextStopIndex + 1 : null,
        arrivedAt: arrivedTime,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal error" });
    }
  });

// 4️⃣ Optional: Mark Stop as Departed
exports.markDeparted = functions.https.onRequest(async (req, res) => {
  try {
    const db = admin.database();

    const currentStopSnap = await db.ref("currentStop").once("value");
    const currentStopIndex = currentStopSnap.val();
    if (currentStopIndex == null || currentStopIndex < 0) return res.status(400).json({ error: "No stop to depart" });

    const departedTime = new Date().toLocaleTimeString();
    await db.ref(`stops/${currentStopIndex}`).update({ Departure: departedTime });

    res.json({ success: true, departedAt: departedTime });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});
