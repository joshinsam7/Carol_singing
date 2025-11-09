/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React from "react";
import "./Information.css";

export default function Information({data, currentStop, destinationStop, waitingForApproval}) {
  const sortedStops = [...data].sort((a, b) => a.id - b.id);

  return (
    <div className="information">
      {sortedStops.map((item, index) => {
        const isArrived = item.Arrived || (currentStop && item.id < currentStop.id);
        const isCurrentWaiting = currentStop && item.id === currentStop.id && waitingForApproval;
        const isDestination = destinationStop && item.id === destinationStop.id; // 🟧 new condition

        return (
          <div
            key={item.id}
            className={`info-item 
              ${isArrived ? "arrived-card" : ""} 
              ${isDestination ? "enroute-card" : ""}`}
          >
            <div className="info-left">
              <div
                className={`check-circle ${
                  isArrived ?
                    "arrived-circle" :
                    isDestination ?
                      "enroute-circle" :
                      "number-circle"
                }`}
              >
                {isArrived ? "✓" : index + 1}
              </div>
            </div>

            <div className="info-body">
              <p className="info-title">{`Stop ${index + 1}`}</p>
              <p className="info-line">
                📍{" "}
                <a
                  className="stop-address"
                  href={item.address ? `https://www.google.com/maps/?q=${encodeURIComponent(item.address)}` : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.address || "N/A"}
                </a>
              </p>

              {index === 0 && item.starting_time && (
                <p className="info-line">Starting Time: {item.starting_time}</p>
              )}

              {isArrived && (
                <p className="info-line">
                  ⏰ {item.arrival_time && `Arriving: ${item.arrival_time}`}{" "}
                  {item.departure_time && `| Departing: ${item.departure_time}`}
                </p>
              )}

              {isCurrentWaiting && (
                <p className="info-line" style={{color: "#FFA500"}}>
                  ⚠ Waiting for admin approval
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
