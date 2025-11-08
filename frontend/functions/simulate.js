const admin = require("firebase-admin");
var serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://bus-tracking-e5cf4-default-rtdb.firebaseio.com"
});

const stopsRef = admin.database().ref("stops");
const statusRef = admin.database().ref("status");
const busLocationRef = admin.database().ref("busLocation");
const currentStopRef = admin.database().ref("currentStop");
const nextStopRef = admin.database().ref("nextStop");
const tripStartedRef = admin.database().ref("tripStarted");
const nextStopIdRef = admin.database().ref("nextStopId");

// Simulate trip along 20 stops
async function simulateTrip() {
  const stopsSnap = await stopsRef.once("value");
  const stops = stopsSnap.val();
  const totalStops = Object.keys(stops).length;

  // Mark trip as started
  await tripStartedRef.set(true);
  await statusRef.set({ busStatus: "inTransit", lastUpdate: Date.now() });

  for (let i = 0; i < totalStops; i++) {
    const stop = stops[i];

    // Move bus to stop
    await busLocationRef.set({
      lat: stop.latitude,
      lng: stop.longitude,
      timestamp: Date.now(),
    });

    // Update currentStop and nextStop
    await currentStopRef.set(i);
    await nextStopRef.set(i + 1 < totalStops ? i + 1 : null);

    // Update stop as Arrived
    await stopsRef.child(i).update({ Arrived: new Date().toLocaleTimeString() });

    console.log(`Arrived at stop ${i}: ${stop.address}`);

    // Wait 5 seconds before departing
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Mark Departed
    await stopsRef.child(i).update({ Departure: new Date().toLocaleTimeString() });
    console.log(`Departed from stop ${i}`);

    // Wait 2 seconds before next stop
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Trip finished
  await statusRef.set({ busStatus: "idle", lastUpdate: Date.now() });
  await tripStartedRef.set(false);
  await currentStopRef.set(-1);
  await nextStopRef.set(0);

  console.log("Trip simulation complete!");
}

// Run simulation
simulateTrip().catch(console.error);
