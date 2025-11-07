const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();

// 1️⃣ Update Bus Location
exports.updateLocation = functions.https.onRequest(async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: "Missing coordinates" });
    }

    await admin.database().ref("bus/currentLocation").set({
      latitude,
      longitude,
      timestamp: Date.now(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

// 2️⃣ Get Bus Status
exports.busStatus = functions.https.onRequest(async (req, res) => {
  try {
    // Get current location
    const locationSnap = await admin
      .database()
      .ref("bus/currentLocation")
      .once("value");
    const current = locationSnap.val();
    if (!current)
      return res.status(400).json({ error: "Current location not set" });

    // Get next stop index
    const nextStopIndexSnap = await admin
      .database()
      .ref("bus/nextStopIndex")
      .once("value");
    const nextStopIndex = nextStopIndexSnap.val();
    if (nextStopIndex == null)
      return res.status(400).json({ error: "Next stop not set" });

    // Get stops array
    const stopsSnap = await admin.database().ref("stops").once("value");
    const stopsArray = stopsSnap.val();
    const nextStop = stopsArray[nextStopIndex];

    if (!nextStop)
      return res.status(400).json({ error: "Next stop not found" });

    // Call OSRM to get ETA
    const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${current.longitude},${current.latitude};${nextStop.longitude},${nextStop.latitude}?overview=false`;
    const { data } = await axios.get(osrmUrl);
    const route = data.routes?.[0];
    if (!route) return res.status(400).json({ error: "No route found" });

    res.json({
      currentLat: current.latitude,
      currentLon: current.longitude,
      nextStopAddress: nextStop.address,
      etaMinutes: Math.round(route.duration / 60),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

// 3️⃣ Mark Stop as Arrived (and move to next stop)
exports.markArrived = functions.https.onRequest(async (req, res) => {
  try {
    const nextStopIndexSnap = await admin
      .database()
      .ref("bus/nextStopIndex")
      .once("value");
    let nextStopIndex = nextStopIndexSnap.val();

    if (nextStopIndex == null)
      return res.status(400).json({ error: "Next stop not set" });

    // Mark the current stop as arrived
    await admin
      .database()
      .ref(`stops/${nextStopIndex}`)
      .update({ arrived: true });

    // Increment to the next stop
    await admin
      .database()
      .ref("bus/nextStopIndex")
      .set(nextStopIndex + 1);

    res.json({ success: true, nextStopIndex: nextStopIndex + 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});
