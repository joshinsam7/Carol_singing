/* eslint-disable max-len */
/* eslint-disable no-unused-vars */
/* eslint-disable require-jsdoc */
import React, {useState, useMemo} from "react";
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
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const toggleSummary = () => setIsCollapsed(!isCollapsed);

  // ---------------- Compute completed stops ----------------
  const completedStops = useMemo(() => {
    if (!currentStop) return 0;
    const index = data.findIndex((s) => s.id === currentStop?.id);
    return index >= 0 ? index + 1 : 0;
  }, [currentStop, data]);

  // ---------------- Compute status text ----------------
  const currentStatusText = (() => {
    if (!currentDestination && !nextStop && busStatus === "idle") return "Bus has not started 🚫";
    if (busStatus === "idle" && currentDestination) return "We are still singing 🟠";
    if (busStatus !== "idle" && currentDestination) return `In Transit to Stop ${currentDestination?.id}`;
    return "Status unknown";
  })();

  const orangeAddress = currentDestination ? currentDestination.address || stopsMap?.get(currentDestination.id)?.address : "N/A";
  const greenAddress = nextStop ? nextStop.address || stopsMap?.get(nextStop.id)?.address : "N/A";

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
              <p className="stop-name">
                {currentDestination ? `Stop ${currentDestination.id}` : "N/A"}
              </p>
              <a
                className="stop-address"
                href={currentDestination ? `https://www.google.com/maps/?q=${encodeURIComponent(orangeAddress)}` : "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                {orangeAddress}
              </a>
              {routeETA && (
                <p className="stop-eta">Approx. ETA: {Math.round(routeETA / 60)} min</p>
              )}
            </div>
          </div>

          {/* Green marker: Next stop */}
          <div className="summary-section next-stop">
            <div className="stop-icon">
              <img src={greenLocale} alt="Next Stop" />
              <p className="stop-label">Next Stop</p>
            </div>
            <div className="stop-info">
              <p className="stop-name">{nextStop ? `Stop ${nextStop.id}` : "N/A"}</p>
              <a
                className="stop-address"
                href={nextStop ? `https://www.google.com/maps/?q=${encodeURIComponent(greenAddress)}` : "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                {greenAddress}
              </a>
              {routeETA != null && (
                <p className="stop-eta">Approx. ETA: {Math.round(routeETA / 60)} min</p>
              )}
            </div>
          </div>
        </div>

        <hr />
        <div className="last-updated">
          <p>Last Updated: {lastUpdate || "N/A"}</p>
        </div>
      </div>
    </div>
  );
}
