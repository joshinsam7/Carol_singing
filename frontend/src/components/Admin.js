/* eslint-disable no-unused-vars */
/* eslint-disable require-jsdoc */
/* eslint-disable indent */
/* eslint-disable max-len */
import React, {useMemo, useState, useEffect} from "react";
import {useParams} from "react-router-dom";
import {Helmet} from "react-helmet-async";
import {Header} from "./header";
import BusMap from "./BusMap";
import Summary from "./summary";
import Information from "./Information";
import useBusSocket from "../hooks/useBusSocket";
import SnowParticles from "./SnowFlakes";

const MemoizedSummary = React.memo(Summary);
const MemoizedInformation = React.memo(Information);

export default function Admin() {
  const [showInfo, setShowInfo] = useState(true);
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [showRemovePopup, setShowRemovePopup] = useState(false);
  const [churchId, setChurchId] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedStopIdRemove, setSelectedStopIdRemove] = useState("");
  const [familyRows, setFamilyRows] = useState([{churchId: "", familyName: ""}]);

//   const [tripStarted, setTripStarted] = useState(false);
  const API_URL = process.env.REACT_APP_API;
  const {busState, stops, setStops} = useBusSocket([]);
  const {token} = useParams();

  // Helper to build admin endpoint URLs with token
  const adminEndpoint = (path) => `${API_URL}/api/admin/${token}/${path}`;

  // handle save stop function
const handleSaveStop = async () => {
  const familiesObj = {};

  if (churchId && familyName) {
    familiesObj[churchId] = familyName;
  }

  const newStop = {
    families: familiesObj,
    address,
  };

  setLoading(true);
  try {
    const res = await fetch(adminEndpoint("add-stop"), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(newStop),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Error adding stop:", data);
      return;
    }

    // update list instantly
    setStops((prev) => [...prev, data.stop]);

    // close popup
    setShowAddPopup(false);

    // reset fields
    setChurchId("");
    setFamilyName("");
    setAddress("");
  } catch (err) {
    console.error("Request failed:", err);
  } finally {
    setLoading(false);
  }
};

  const handleRemoveStop = async (stopId) => {
    setLoading(true);
    try {
      const res = await fetch(adminEndpoint("delete-stop"), {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({stopId}),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Error removing stop:", data);
        return;
      }
      // update list instantly
      setStops((prev) => prev.filter((s) => s.id !== stopId));

      // close popup
      setShowRemovePopup(false);
    } catch (err) {
      console.error("Request failed:", err);
    } finally {
      setLoading(false);
    }
  };

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
    <div className="App admin-page">
      <Helmet>
        <title>Admin Dashboard</title>
      </Helmet>

      <SnowParticles />
      <header className="App-header">
        <Header toggleInfo={toggleInfo} />
      </header>

      {showAddPopup && (
        <div className="popup-overlay">
          <div className="popup-content">
            <div className="header-with-close">
              <h3>Add Stop</h3>
              <button onClick={() => setShowAddPopup(false)}>✕</button>
            </div>

            <div className="familyName-id-div">
              <input
                className="church-id-input"
                type="number"
                placeholder="Church ID"
                value={churchId}
                onChange={(e) => setChurchId(e.target.value)}
              />

              <input
                className="family-name-input"
                type="text"
                placeholder="Family Name"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
              />
            </div>

            <input
              className="address-input"
              style={{paddingRight: "unset"}}
              type="text"
              placeholder="Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />

            <div className="popup-buttons">
              <button className="popup-btn" onClick={handleSaveStop} disabled={loading}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                    Saving...
                  </div>
                ) : (
                  "Save"
                )}
              </button>
              <button className="popup-btn cancel-btn" onClick={() => setShowAddPopup(false)}>Cancel</button>
            </div>

          </div>
        </div>
      )}

      {showRemovePopup && (
        <div className="popup-overlay">
          <div className="popup-content">
            <div className="header-with-close">
              <h3>Remove Stop</h3>
              <button onClick={() => setShowRemovePopup(false)}>x</button>
            </div>
            <select
              className="admin-select"
              value={selectedStopIdRemove}
              onChange={(e) => setSelectedStopIdRemove(Number(e.target.value))}
            >
              <option value="" disabled>Select a Stop to remove</option>
              {stops.map((stop) => {
                let familyNames = "No Name";
                try {
                  const families = typeof stop.families === "string" ?
                    JSON.parse(stop.families) :
                    stop.families;
                  familyNames = families ?
                    Object.values(families).join(", ") :
                    "No Name";
                } catch (e) {
                  familyNames = "No Name";
                }
                return (
                  <option key={stop.id} value={stop.id}>
                    Stop {stop.id} - {familyNames}
                  </option>
                );
              })}
            </select>
            <button onClick={() => handleRemoveStop(selectedStopIdRemove)} disabled={loading}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                    Removing...
                  </div>
                ) : (
                  "Submit"
                )}
            </button>
          </div>
        </div>
      )}

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
            admin={true}
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
            admin={true}
            adminEndpoint={adminEndpoint}
          />
        </section>

        <aside className={`side right ${showInfo ? "open" : ""}`}>
          <MemoizedInformation
            data={stops}
            atStop={busState.at_stop}
            destinationStop={destinationStopObj}
            waitingForApproval={busState.waitingForApproval}
            arrivalTime={busState.arrivalTime ? new Date(busState.arrivalTime).toLocaleTimeString() : "N/A"}
            isAdmin
            adminEndpoint={adminEndpoint}
            onAddStop={() => setShowAddPopup(true)}
            onRemoveStop={() => setShowRemovePopup(true)}
          />
        </aside>

      </main>
    </div>
  );
}
