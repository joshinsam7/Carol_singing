/* eslint-disable max-len */
/* eslint-disable no-unused-vars */
/* eslint-disable require-jsdoc */
import React, {useState, useMemo, useEffect} from "react";
import "./summary.css";
import downArrow from "../assets/white-arrow.png";
import orangeLocale from "../assets/orange-locale.png";
import greenLocale from "../assets/green-locale.png";

export default function Summary({
  currentStop, // stop object where bus currently is
  currentDestination, // stop bus is heading towards (orange marker)
  nextStop, // stop after destinationStop (green marker, can be admin override)
  data,
  stopsMap,
  busStatus,
  lastUpdate,
  routeETA,
  waitingForApproval,
  admin = false,
  adminEndpoint,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [lastCheckedETA, setCheckedETA] = useState(null);

  const toggleSummary = () => setIsCollapsed(!isCollapsed);

  const lastArrivedStop = useMemo(() => {
    if (!data || data.length === 0) return null;
    const arrivedStops = data.filter((s) => !!s.arrivalTime);
    return arrivedStops.length > 0 ? arrivedStops[arrivedStops.length - 1] : null;
  }, [data]);

  // ---------------- Computed last checked eta ----------------

  useEffect(() => {
    if (routeETA && lastCheckedETA === null) {
      setCheckedETA(new Date());
    }
  }, [routeETA, lastCheckedETA]);

  // ---------------- Compute completed stops ----------------
  const completedStops = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return data.filter((s) => !!s.arrivalTime).length; // count stops with arrivalTime
  }, [data]);

  // ---------------- Compute status text ----------------
  const currentStatusText = (() => {
    if (!currentDestination && !nextStop && busStatus === "idle") return "Bus has not started 🚫";
    if (busStatus === "idle" && currentDestination) return "We are still singing 🟠";
    if (busStatus !== "idle" && currentDestination) return `In Transit to Stop ${currentDestination?.id}`;
    return "Status unknown";
  })();

  const orangeAddress = currentDestination ? currentDestination.address || stopsMap?.get(currentDestination.id)?.address : "N/A";


  // ---------------- Admin Control Handlers ----------------
  const handleArrived = () => {
    if (typeof adminEndpoint !== "function") return console.error("adminEndpoint function missing");
    if (busStatus !== 'en_route') return; // guard
    const stopId = currentDestination?.id;
    if (!stopId) return console.error("No current destination to mark as arrived");
    fetch(adminEndpoint("stop-arrived"), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({stopId, timestamp: Date.now()}),
    })
      .then(res => res.json())
      .then(data => console.log("Arrived:", data))
      .catch(err => console.error("Error marking arrived:", err));
  };

  const handleDeparted = () => {
    if (typeof adminEndpoint !== "function") return console.error("adminEndpoint function missing");
    if (busStatus !== 'idle') return; // guard
    const stopId = currentStop?.id;
    if (!stopId) return console.error("No current stop to depart from");
    fetch(adminEndpoint("stop-departed"), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({stopId, timestamp: Date.now()}),
    })
      .then(res => res.json())
      .then(data => console.log("Departed:", data))
      .catch(err => console.error("Error marking departed:", err));
  };

  const handleSetNextStop = (e) => {
    const nextStopId = Number(e.target.value);
    if (!nextStopId) return;
    if (typeof adminEndpoint !== "function") return console.error("adminEndpoint function missing");
    fetch(adminEndpoint("set-next-stop"), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({nextStopId}),
    })
        .then((res) => res.json())
        .then((data) => {
          console.log("Set next stop:", data);
          // Reset select after successful override
          e.target.value = "";
        })
        .catch((err) => console.error("Error setting next stop:", err));
  };

  // ---------------- Render Component ----------------
  return (
    <div className={`summary ${isCollapsed ? "collapsed" : ""}`}>
      <div className="summary-toggle" onClick={toggleSummary}>
        <img
          src={downArrow}
          alt="Toggle Arrow"
          className={`toggle-arrow ${isCollapsed ? "rotated" : ""}`}
        />
      </div>

      <div className="summary-content">
        <div className="route-progress">
          <div className="route-header">
            <p className="section-title">Route Progress</p>
            <p className="progress-count">{completedStops} / {data.length} stops completed</p>
          </div>
          <div className="progress-bar">
            <progress value={completedStops} max={data.length}></progress>
          </div>
          <p className="progress-percentage">
            {Math.round((completedStops / data.length) * 100)}% complete
          </p>
        </div>

        <div className="stops-container">
          {/* Orange marker: Destination stop */}
          <div className="summary-section current-stop">
            <div className="stop-icon">
              <img src={orangeLocale} alt="Current Destination" />
              <p className="stop-label">{currentStatusText}</p>
            </div>
            <div className="stop-info">
              {/* Stop Name */}
              <p className="stop-name">
                {currentDestination ? `Stop ${currentDestination.id}` : "N/A"}
              </p>

              {/* Stop Address */}
              {currentDestination && (
                <p className="stop-address-wrapper">
                  <a
                    className="stop-address"
                    href={`https://www.google.com/maps/?q=${encodeURIComponent(orangeAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {orangeAddress}
                  </a>
                </p>
              )}

              {/* ETA - show when available, irrespective of status */}
              {routeETA && (
                <p className="stop-eta">
                  Approx. ETA: {Math.round(routeETA / 60)} min
                  {lastCheckedETA && (
                    <> (Computed at: {new Date(lastCheckedETA).toLocaleTimeString()})</>
                  )}
                </p>
              )}

              {/* Arrival Status and Time - show when idle */}
              {busStatus === "idle" && currentDestination && (
                <>
                  {currentDestination.arrivalTime && (
                    <p className="stop-eta">
                      Arrived at: {new Date(currentDestination.arrivalTime).toLocaleTimeString()}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <hr />
        <div className="last-updated">
          <p>Last Updated: {new Date(lastUpdate).toLocaleTimeString() || "N/A"}</p>
        </div>

        {/* Admin buttons to control the bus */}
        {admin &&
        <div className="admin-controls">
          <button
            className={`admin-button ${busStatus === 'en_route' ? 'arrived-active' : ''}`}
            onClick={handleArrived}
            disabled={busStatus !== 'en_route'}
          >
            Arrived
          </button>
          <button
            className={`admin-button ${busStatus === 'idle' ? 'departed-active' : ''}`}
            onClick={handleDeparted}
            disabled={busStatus !== 'idle'}
          >
            Departed
          </button>
          <select className="admin-select" onChange={handleSetNextStop} defaultValue="">
            <option value="" disabled>Change Current Stop</option>
            {data.map((stop) => {
              let familyNames = "No Name";
              try {
                const families = typeof stop.families === "string" ? JSON.parse(stop.families) : stop.families;
                familyNames = families ? Object.values(families).join(", ") : "No Name";
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
        </div>
        }
      </div>
    </div>
  );
}
