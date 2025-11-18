/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React, {useEffect, useState, useMemo} from "react";
import {BrowserRouter, Routes, Route, useLocation, useParams} from "react-router-dom";
import {Helmet} from "react-helmet-async";
import "./App.css";
import BusMap from "./components/BusMap";
import {Header} from "./components/header";
import Information from "./components/Information";
import Summary from "./components/summary";
import SnowParticles from "./components/SnowFlakes";
import useBusSocket from "./hooks/useBusSocket";

const AdminLazy = React.lazy(() => import("./components/Admin"));


// Guard using unpredictable route token: /admin/:token
function AdminRouteGate() {
  const API_URL = process.env.REACT_APP_API;
  const {token} = useParams();
  const [authorized, setAuthorized] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    async function validate() {
      if (!API_URL || !token) {
        setError("Missing API URL or token.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/admin/${token}/validate-route/`);
        if (!cancelled) {
          if (res.ok) {
            setAuthorized(true);
          } else {
            setError("Invalid or expired admin route token.");
          }
        }
      } catch (err) {
        if (!cancelled) setError("Network error validating token.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    validate();
    return () => {
      cancelled = true;
    };
  }, [API_URL, token]);

  if (loading) return <div style={{padding: "2rem"}}>Checking token…</div>;
  if (error || !authorized) return <div style={{padding: "2rem", fontSize: "1.1rem"}}>Unauthorized – {error || "Access denied"}</div>;

  return (
    <React.Suspense fallback={<div style={{padding: "2rem"}}>Loading admin…</div>}>
      <AdminLazy />
    </React.Suspense>
  );
}

const MemoizedInformation = React.memo(Information);
const MemoizedSummary = React.memo(Summary);

function App() {
  const [showInfo, setShowInfo] = useState(false);
  const [tripStarted, setTripStarted] = useState(false);

  const API_URL = process.env.REACT_APP_API;
  const {busState, stops, setStops} = useBusSocket([]);

  // Map for quick lookup
  const stopsMap = useMemo(() => {
    const map = new Map();
    stops.forEach((s) => s?.id != null && map.set(s.id, s));
    return map;
  }, [stops]);

  useEffect(() => {
    if (!API_URL) return;
    fetch(`${API_URL}/api/getStops`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.stops)) {
            setStops(data.stops);
          } else {
            console.error("API returned unexpected data:", data);
          }
        })
        .catch((err) => console.error(err));
  }, [API_URL, setStops]);


  const toggleInfo = () => setShowInfo((prev) => !prev);

  // Compute next stop for summary
  const nextStopObj = useMemo(() => {
    if (!busState.destination_stop || stops.length === 0) return null;
    const destIndex = stops.findIndex((s) => s.id === busState.destination_stop.id);
    return destIndex >= 0 && destIndex < stops.length - 1 ? stops[destIndex + 1] : null;
  }, [busState.destination_stop, stops]);

  const destinationStopObj = useMemo(() => {
    if (!busState.destination_stop || stops.length === 0) return null;
    return typeof busState.destination_stop === "number" ?
    stops.find((s) => s.id === busState.destination_stop) :
    busState.destination_stop;
  }, [busState.destination_stop, stops]);

  const currentStopObj = useMemo(() => {
    if (!busState.at_stop || stops.length === 0) return null;
    return typeof busState.at_stop === "number" ?
      stops.find((s) => s.id === busState.at_stop) :
      busState.at_stop;
  }, [busState.at_stop, stops]);


  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
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
                  currentLocation={{lat: busState.lat, lng: busState.lng}}
                  destinationStop={destinationStopObj}
                  nextDestinationStop={nextStopObj}
                  atStop={currentStopObj}
                  busStatus={busState.status}
                  routeETA={busState.routeETA}
                  tripStarted={tripStarted}
                />

                <MemoizedSummary
                  data={stops}
                  stopsMap={stopsMap}
                  currentStop={currentStopObj}
                  currentDestination={destinationStopObj}
                  nextStop={nextStopObj}
                  lastUpdate={busState.last_update}
                  currentLocation={{lat: busState.lat, lng: busState.lng}}
                  routeETA={busState.routeETA}
                  busStatus={busState.status}
                  waitingForApproval={busState.waitingForApproval}
                />
              </section>

              <aside className={`side right ${showInfo ? "open" : ""}`}>
                <MemoizedInformation
                  data={stops}
                  atStop={busState.at_stop}
                  destinationStop={destinationStopObj}
                  waitingForApproval={busState.waitingForApproval}
                  arrivalTime={busState.arrivalTime ? new Date(busState.arrivalTime).toLocaleTimeString() : "N/A"}
                />
              </aside>
            </main>
          </div>
        } />
        <Route path="/admin/:token" element={<AdminRouteGate />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
