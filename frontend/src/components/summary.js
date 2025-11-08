/* eslint-disable max-len */
/* eslint-disable no-unused-vars */
/* eslint-disable require-jsdoc */
import React, {useState, useMemo} from "react";
import "./summary.css";
import downArrow from "../assets/white-arrow.png";
import orangeLocale from "../assets/orange-locale.png";
import greenLocale from "../assets/green-locale.png";

export default function Summary({
  currentStop,
  nextStop,
  data,
  busStatus,
  lastUpdate,
  routeETA,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const toggleSummary = () => setIsCollapsed(!isCollapsed);

  // Compute completed stops index safely
  const completedStops = useMemo(() => {
    if (!currentStop) return 0;
    const index = data.findIndex((s) => s.id === currentStop.id);
    return index >= 0 ? index + 1 : 0;
  }, [currentStop, data]);

  // Status text
  const currentStatusText = (() => {
    if (!currentStop && !nextStop && busStatus === "idle") return "Bus has not started 🚫";
    if (busStatus === "idle" && currentStop) return `Bus is at Stop ${currentStop.id + 1}`;
    if (busStatus !== "idle" && nextStop) return `In Transit to Stop ${nextStop.id + 1}`;
    return "Status unknown";
  })();

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
          <div className="progress-info">
            <p className="progress-percentage">{Math.round((completedStops / data.length) * 100)}% complete</p>
          </div>
        </div>

        <div className="stops-container">
          {/* Current Stop */}
          <div className="summary-section current-stop">
            <div className="stop-icon">
              <img src={orangeLocale} alt="Current Bus" />
              <p className="stop-label">{currentStatusText}</p>
            </div>
            <div className="stop-info">
              <p className="stop-name">{currentStop ? `Stop ${currentStop.id + 1}` : "NA"}</p>
              <a
                className="stop-address"
                href={currentStop ? `https://www.google.com/maps/?q=${encodeURIComponent(currentStop.Address)}` : "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                {currentStop?.Address || "N/A"}
              </a>
              {routeETA && <p className="eta">Approx. ETA: {Math.round(routeETA / 60)} min</p>}
            </div>
          </div>

          {/* Next Stop */}
          <div className="summary-section next-stop">
            <div className="stop-icon">
              <img src={greenLocale} alt="Next Stop" />
              <p className="stop-label">Next Stop</p>
            </div>
            <div className="stop-info">
              <p className="stop-name">{nextStop ? `Stop ${nextStop.id + 1}` : "N/A"}</p>
              <a
                className="stop-address"
                href={nextStop ? `https://www.google.com/maps/?q=${encodeURIComponent(nextStop.Address)}` : "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                {nextStop?.Address || "N/A"}
              </a>
            </div>
          </div>
        </div>

        <div className="divider" style={{paddingTop: "11px"}}>
          <hr />
        </div>

        <div className="last-updated">
          <p>Last Updated: {lastUpdate || "N/A"}</p>
        </div>
      </div>
    </div>
  );
}
