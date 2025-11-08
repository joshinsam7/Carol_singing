/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React, {useEffect, useState} from "react";
import "./App.css";
import BusMap from "./components/BusMap.js";
import {Header} from "./components/header";
import Information from "./components/Information";
import Summary from "./components/summary";
import {Helmet} from "react-helmet-async";
import SnowParticles from "./components/SnowFlakes";
import useBusSocket from "./hooks/useBusSocket";

function App() {
  // ------------------- State -------------------
  const [stops, setStops] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [busStatus, setBusStatus] = useState("idle");
  const [currentLocation, setCurrentLocation] = useState({lat: 29.619707, lng: -95.3193855});
  const [currentStop, setCurrentStop] = useState(null);
  const [nextStop, setNextStop] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [routeETA, setRouteETA] = useState(null);

  const API_URL = process.env.REACT_APP_API || "http://localhost:3001";
  const {data: busData} = useBusSocket(process.env.REACT_APP_SOCKET || "ws://localhost:3001");

  // ------------------- Fetch stops -------------------
  useEffect(() => {
    if (!API_URL) return console.warn("API URL is not defined in environment variables.");

    fetch(`${API_URL}/api/getStops`)
        .then((res) => res.json())
        .then((data) => setStops(data.stops || []))
        .catch((err) => console.error("Failed to fetch stops:", err));
  }, [API_URL]);

  // ------------------- Handle WebSocket bus data -------------------
  useEffect(() => {
    if (!busData?.data || stops.length === 0) return;

    // Build stops map here, only when busData or stops change
    const stopsMap = new Map();
    stops.forEach((s) => s?.id != null && stopsMap.set(s.id, s));

    const {lat, lng, status, currentStop: csId, nextStop: nsId, lastUpdate: lu} = busData.data;

    setBusStatus(status || "idle");
    setCurrentStop(csId != null ? stopsMap.get(csId) || null : null);
    setNextStop(nsId != null ? stopsMap.get(nsId) || null : null);
    setCurrentLocation({lat: lat ?? 29.619707, lng: lng ?? -95.3193855});
    setLastUpdate(lu ? new Date(lu).toLocaleTimeString() : null);
  }, [busData, stops]);

  // ------------------- Compute sorted stops -------------------
  const sortedStops = nextStop ?
    [nextStop, ...stops.filter((s) => s.id !== nextStop.id)] :
    stops;

  // ------------------- Toggle Info -------------------
  const toggleInfo = () => setShowInfo((prev) => !prev);

  // ------------------- Render -------------------
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
            currentLocation={currentLocation}
            destinationStop={nextStop || {}}
            busStatus={busStatus}
            setRouteETA={setRouteETA}
          />

          <Summary
            data={stops}
            nextStop={nextStop}
            currentStop={currentStop}
            lastUpdate={lastUpdate}
            currentLocation={currentLocation}
            routeETA={routeETA}
          />
        </section>

        <aside className={`side right ${showInfo ? "open" : ""}`}>
          <Information data={sortedStops} nextStop={nextStop} />
        </aside>
      </main>
    </div>
  );
}

export default App;
