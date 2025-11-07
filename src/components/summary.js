import React, {useState} from "react";
import "./summary.css";
import downArrow from "../assets/white-arrow.png";
import orangeLocale from "../assets/orange-locale.png";
import greenLocale from "../assets/green-locale.png";

export default function Summary() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSummary = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`summary ${isCollapsed ? "collapsed" : ""}`}>
      {/* Toggle Arrow */}
      <div className="summary-toggle" onClick={toggleSummary}>
        <img
          src={downArrow}
          alt="Toggle Arrow"
          className={`toggle-arrow ${isCollapsed ? "rotated" : ""}`}
        />
      </div>

      {/* Content inside the summary */}
      <div className="summary-content">
        {/* Route Progress Section */}
        <div className="route-progress">
          <div className="route-header">
            <p className="section-title">Route Progress</p>
            <p className="progress-count">3 / 10 stops completed</p>
          </div>
          <div className="progress-bar">
            <progress value={3} max={10}></progress>
          </div>
          <div className="progress-info">
            <p className="progress-percentage">30% complete</p>
          </div>
        </div>

        {/* Current & Next Stop Section */}
        <div className="stops-container">
          <div className="summary-section current-stop">
            <div className="stop-icon">
              <img src={orangeLocale} alt="Current Bus" />
              <p className="stop-label">Current Stop</p>
            </div>
            <div className="stop-info">
              <p className="stop-name">Main Street Church</p>
              <p className="stop-address">1234 Main St, Tempe, AZ</p>
              <p className="stop-eta">Arrived 5 mins ago</p>
            </div>
          </div>

          <div className="summary-section next-stop">
            <div className="stop-icon">
              <img src={greenLocale} alt="Next Stop" />
              <p className="stop-label">Next Stop</p>
            </div>
            <div className="stop-info">
              <p className="stop-name">Carol’s House</p>
              <p className="stop-address">5678 Maple Ave, Tempe, AZ</p>
              <div className="stop-eta">
                <p>🕒</p>
                <p>ETA: 12 mins</p>
              </div>
            </div>
          </div>
        </div>

        <div className="divider" style={{paddingTop: "11px"}}>
          <hr />
        </div>

        <div className="last-updated">
          <p>Last Updated: Nov 5, 2025 - 6:30 PM</p>
        </div>
      </div>
    </div>
  );
}
