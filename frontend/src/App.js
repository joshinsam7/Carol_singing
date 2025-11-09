/* eslint-disable no-unused-vars */
/* eslint-disable camelcase */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
/* eslint-disable no-unused-vars */
/* eslint-disable camelcase */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React, {useEffect, useState, useMemo} from "react";
import "./App.css";
import BusMap from "./components/BusMap";
import {Header} from "./components/header";
import Information from "./components/Information";
import Summary from "./components/summary";
import {Helmet} from "react-helmet-async";
import SnowParticles from "./components/SnowFlakes";
import useBusSocket from "./hooks/useBusSocket";

const MemoizedInformation = React.memo(Information);
const MemoizedSummary = React.memo(Summary);

function App() {
  const [stops, setStops] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [tripStarted, setTripStarted] = useState(false);

  const [busInfo, setBusInfo] = useState({
    status: "idle",
    currentLocation: {lat: 29.619707, lng: -95.3193855},
    atStop: null,
    destinationStop: null,
    lastUpdate: null,
    routeETA: null,
    waitingForApproval: false,
  });

  const API_URL = process.env.REACT_APP_API;
  const busData = useBusSocket(stops); // now returns simplified state

  // Fetch stops
  useEffect(() => {
    if (!API_URL) return;
    fetch(`${API_URL}/api/getStops`)
        .then((res) => res.json())
        .then((data) => setStops(data.stops || []))
        .catch((err) => console.error(err));
  }, [API_URL]);

  // Create map for fast lookup
  const stopsMap = useMemo(() => {
    const map = new Map();
    stops.forEach((s) => s?.id != null && map.set(s.id, s));
    return map;
  }, [stops]);

  // Handle WebSocket updates
  useEffect(() => {
    if (!busData || stops.length === 0) return;

    const {lat, lng, status, current_stop, destination_stop, last_update} = busData;

    if (!tripStarted && status !== "idle") setTripStarted(true);

    const atStopObj = current_stop ? stopsMap.get(current_stop) : null;
    const destinationStopObj = destination_stop ? stopsMap.get(destination_stop) : null;

    // Only update bus position if lat/lng exist
    const currentLocation =
      lat != null && lng != null ? {lat, lng} : busInfo.currentLocation;

    setBusInfo({
      status: status || "idle",
      currentLocation,
      atStop: atStopObj,
      destinationStop: destinationStopObj,
      lastUpdate: last_update ? new Date(last_update).toLocaleTimeString() : null,
      waitingForApproval: status === "idle" ? true : false,
      routeETA: null,
    });
  }, [busData, stops, stopsMap, tripStarted]);


  // ------------------- OSRM-based ETA -------------------
  const calculateETA = async (fromLocation, toStop) => {
    if (!fromLocation || !toStop) return null;
    try {
      const url = `http://router.project-osrm.org/route/v1/driving/${fromLocation.lng},${fromLocation.lat};${toStop.longitude},${toStop.latitude}?overview=false`;
      const res = await fetch(url);
      const data = await res.json();
      if (data?.routes?.[0]?.duration != null) return data.routes[0].duration;
    } catch (err) {
      console.error("OSRM ETA calculation failed:", err);
    }
    return null;
  };

  // ------------------- Admin confirms bus departed -------------------
  const onAdminDepartStop = async (nextStopId) => {
    const nextStop = stopsMap.get(nextStopId);
    if (!nextStop) return;

    setBusInfo((prev) => ({
      ...prev,
      atStop: null, // bus leaving current stop
      destinationStop: nextStop,
      routeETA: null,
    }));

    const eta = await calculateETA(busInfo.currentLocation, nextStop);
    if (eta != null) {
      setBusInfo((prev) => ({...prev, routeETA: eta}));
    }
  };

  const nextStopObj = (() => {
    if (!busInfo.destinationStop || stops.length === 0) return null;

    // Admin override
    if (busInfo.nextStopOverride != null) {
      return stops.find((s) => s.id === busInfo.nextStopOverride) || null;
    }

    // Default: next stop is the stop after destinationStop in stops array
    const destIndex = stops.findIndex((s) => s.id === busInfo.destinationStop.id);
    if (destIndex >= 0 && destIndex < stops.length - 1) {
      return stops[destIndex + 1];
    }

    // No next stop
    return null;
  })();

  const toggleInfo = () => setShowInfo((prev) => !prev);

  // Called when bus arrives at a stop
  const onAdminArrived = (stopId) => {
    const arrivedStop = stopsMap.get(stopId);
    if (!arrivedStop) return;

    setBusInfo((prev) => ({
      ...prev,
      atStop: arrivedStop,
      status: "idle",
      routeETA: null,
      waitingForApproval: true,
    }));
  };

  return (
    <div className="App">
      <SnowParticles />
      <header className="App-header">
        <Helmet>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </Helmet>
        <Header toggleInfo={toggleInfo} />
      </header>

      <main className="main-layout">
        <section className="map-column" style={{position: "relative"}}>
          <BusMap
            data={stops}
            stopsMap={stopsMap}
            currentLocation={busInfo.currentLocation}
            destinationStop={busInfo.destinationStop}
            nextDestinationStop={nextStopObj}
            busStatus={busInfo.status}
            setRouteETA={(eta) => setBusInfo((prev) => ({...prev, routeETA: eta}))}
            tripStarted={tripStarted}
          />

          <MemoizedSummary
            data={stops}
            stopsMap={stopsMap}
            currentStop={busInfo.atStop}
            currentDestination={busInfo.destinationStop}
            nextStop={nextStopObj} // ✅ now a proper stop object
            lastUpdate={busInfo.lastUpdate}
            currentLocation={busInfo.currentLocation}
            routeETA={busInfo.routeETA}
            busStatus={busInfo.status}
            waitingForApproval={busInfo.waitingForApproval}
          />

        </section>

        <aside className={`side right ${showInfo ? "open" : ""}`}>
          <MemoizedInformation
            data={stops}
            currentStop={busInfo.atStop}
            destinationStop={busInfo.destinationStop}
            waitingForApproval={busInfo.waitingForApproval}
          />
        </aside>
      </main>
    </div>
  );
}

export default App;
