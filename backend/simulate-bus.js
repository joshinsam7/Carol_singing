// simulate-bus.js
const axios = require("axios");

//  Config 
const API_URL = "http://localhost:3001/api";
const WAIT_BETWEEN_ACTIONS = 2000; // 2 seconds default
const LONG_WAIT_AT_STOP = 4000;    // 4 seconds at stops

const busLocations = [
  { lat: 29.620, lon: -95.320 }, // random
  { lat: 29.492086, lon: -95.391545 }, // stop 1
  { lat: 29.5534254, lon: -95.4144842 }, // stop 2
  { lat: 29.560000, lon: -95.420000 }, // stop 6 (override)
];

function now() {
  return Date.now();
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

//  API Helpers 
async function postBusLocation(lat, lon) {
  try {
    const res = await axios.post(`${API_URL}/bus-location`, { lat, lon });
    console.log("🛰️  Bus location updated:", { lat, lon });
    return res.data;
  } catch (err) {
    console.error("❌ Error posting bus location:", err.response?.data || err.message);
  }
}

async function markArrived(stopId) {
  try {
    const timestamp = now();
    const res = await axios.post(`${API_URL}/stop-arrived`, { stopId, timestamp });
    console.log(`🟢 Stop ${stopId} marked as arrived at ${new Date(timestamp).toLocaleTimeString()}`);
    return res.data;
  } catch (err) {
    console.error("❌ Error marking arrived:", err.response?.data || err.message);
  }
}

async function markDeparted(stopId, nextStopId = null) {
  try {
    const timestamp = now();
    const payload = nextStopId != null ? { stopId, timestamp, nextStopId } : { stopId, timestamp };
    const res = await axios.post(`${API_URL}/stop-departed`, payload);
    console.log(
      `🟡 Stop ${stopId} departed at ${new Date(timestamp).toLocaleTimeString()} → Next stop ${
        nextStopId ?? res.data.next_stop_id
      } (ETA: ${res.data.routeETA ?? "N/A"}s)`
    );
    return res.data;
  } catch (err) {
    console.error("❌ Error marking departed:", err.response?.data || err.message);
  }
}

//  Admin Override 
async function overrideNextStop(nextStopId) {
  try {
    const res = await axios.post(`${API_URL}/set-next-stop`, { nextStopId });
    console.log(`⚠ Admin override: next stop set to ${nextStopId}`);
    return res.data;
  } catch (err) {
    console.error("❌ Error overriding next stop:", err.response?.data || err.message);
  }
}

//  Simulation 
(async function simulate() {
  console.log("🚍 Simulation started...\n");

  // Step 1: random location (bus starting)
  await postBusLocation(busLocations[0].lat, busLocations[0].lon);
  await sleep(WAIT_BETWEEN_ACTIONS);

  // Step 2: Bus reaches stop 1
  await postBusLocation(busLocations[1].lat, busLocations[1].lon);
  await sleep(WAIT_BETWEEN_ACTIONS);
  await markArrived(1);
  await sleep(LONG_WAIT_AT_STOP);
  await markDeparted(1);
  await sleep(WAIT_BETWEEN_ACTIONS);

  // Step 3: Move toward stop 2
  await postBusLocation(busLocations[2].lat, busLocations[2].lon);
  await sleep(WAIT_BETWEEN_ACTIONS);
  await markArrived(2);
  await sleep(LONG_WAIT_AT_STOP);

  // Step 4: Admin overrides next stop to 6
  await overrideNextStop(6);

  // Step 5: Depart stop 2 → next stop 6
  await markDeparted(2, 6);
  await sleep(WAIT_BETWEEN_ACTIONS);

  // Step 6: Bus arrives at stop 6
  await postBusLocation(busLocations[3].lat, busLocations[3].lon);
  await sleep(WAIT_BETWEEN_ACTIONS);
  await markArrived(6);
  await sleep(LONG_WAIT_AT_STOP);

  // Depart from Stop 6
  await await markDeparted(6); // pass the actual stop ID
  console.log("🚏 Next stop after manual stop 6:", res.next_stop_id);

  const res = overrideNextStop(3); // pass the actual stop I
  console.log("Next Stop was set to 3")

  console.log("\n✅ Simulation complete!");
})();
