/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React from "react";
import "./Information.css";

export default function Information({data, nextStop}) {
  const sortedStops = [...data].sort((a, b) => {
    if (!nextStop) return a.id - b.id;
    if (a.id === nextStop.id) return -1;
    if (b.id === nextStop.id) return 1;
    return a.id - b.id;
  });

  return (
    <div className="information">
      {sortedStops.map((item, index) => (
        <div
          key={item.id}
          className={`info-item ${item.Arrived ? "arrived-card" : ""}`}
        >
          {/* Left Circle */}
          <div className="info-left">
            <div
              className={`check-circle ${
                item.Arrived ? "arrived-circle" : "number-circle"
              }`}
            >
              {item.Arrived ? "✓" : index + 1}
            </div>
          </div>

          {/* Info Text - stacked vertically */}
          <div className="info-body">
            <p className="info-title">{`Stop ${index + 1}`}</p>

            <p className="info-line">
              📍{" "}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    item.address,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="muted"
              >
                {item.address || "N/A"}
              </a>
            </p>

            {index === 0 && item.starting_time && (
              <p className="info-line">Starting Time: {item.starting_time}</p>
            )}

            {item.Arrived && (
              <p className="info-line">
                ⏰ {item.arrival_time && `Arriving: ${item.arrival_time}`}{" "}
                {item.departure_time && `| Departing: ${item.departure_time}`}
              </p>
            )}
          </div>
        </div>

      ))}
    </div>
  );
}
