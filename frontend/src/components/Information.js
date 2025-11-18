/* eslint-disable no-trailing-spaces */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React, {useState} from "react";
import "./Information.css";

export default function Information({data, destinationStop, isAdmin = false, onAddStop, onRemoveStop}) {
  if (!data || data.length === 0) return <div>No stops data</div>;

  // Separate stops into arrived and future
  const arrivedStops = data.filter((s) => !!s.arrivalTime);
  const futureStops = data.filter((s) => !s.arrivalTime);

  // Determine destination stop
  const destStopId = destinationStop?.id ?? destinationStop;

  // Find the destination stop object
  const destStop = data.find((s) => s.id === destStopId);

  // Build display order
  let displayStops = [...arrivedStops];

  // Insert current (en-route) stop immediately after last arrived
  if (destStop && !destStop.arrivalTime) {
    displayStops.push(destStop);
  }

  // Append remaining future stops (exclude the current stop if already pushed)
  futureStops.forEach((s) => {
    if (s.id !== destStopId) displayStops.push(s);
  });

  const getStopDisplayName = (stop) => {
    // 1) Prefer explicit name-like fields
    const explicit = stop?.name || stop?.stop_name || stop?.stopName || stop?.title || stop?.Name || stop?.label;
    if (explicit && String(explicit).trim().length > 0) return String(explicit).trim();

    // 2) Derive from families (can be JSON string, object, or array)
    const familiesRaw = stop?.families;
    if (familiesRaw) {
      try {
        let fam = familiesRaw;
        if (typeof fam === "string") {
          // Try to parse JSON string like '{"100":"Rev. Sam ..."}'
          fam = JSON.parse(fam);
        }
        if (Array.isArray(fam)) {
          if (fam.length > 0) return fam.join(", ");
        } else if (fam && typeof fam === "object") {
          const vals = Object.values(fam).filter(Boolean).map(String);
          if (vals.length > 0) return vals.join(", ");
        } else if (typeof familiesRaw === "string") {
          // Fallback to raw string if not JSON but still helpful
          const trimmed = familiesRaw.trim();
          if (trimmed) return trimmed;
        }
      } catch (_) {
        // If JSON.parse fails, fallback to using raw string
        if (typeof familiesRaw === "string" && familiesRaw.trim()) return familiesRaw.trim();
      }
    }

    // 3) Fallback to first line of address
    const addr = stop?.address || stop?.Address;
    if (addr && typeof addr === "string") {
      const first = addr.split(",")[0].trim();
      return first || addr;
    }

    return "N/A";
  };

  return (
    <div className="information">

      {isAdmin && (
        <div className="admin-badge">
          <div className="info-admin">
            <button className="admin-button add-button" onClick={onAddStop}>Add Stop</button>
            <button className="admin-button remove-button" onClick={onRemoveStop}>Remove Stop</button>
          </div>
        </div>
      )}

      {displayStops.map((item, index) => {
        const isArrived = !!item.arrivalTime; // green
        const isCurrent = !item.arrivalTime && item.id === destStopId; // orange

        return (
          <div
            key={item.id}
            className={`info-item ${isArrived ? "arrived-card" : ""} ${isCurrent ? "enroute-card" : ""}`}
          >
            <div className="info-left">
              <div
                className={`check-circle ${
                  isArrived ? "arrived-circle" : isCurrent ? "enroute-circle" : "number-circle"
                }`}
              >
                {isArrived ? "✓" : "x"}
              </div>
            </div>

            <div className="info-body">
              <p className="info-title">
                {isAdmin ? `Stop ${item.id} • ${getStopDisplayName(item)}` : `Stop ${item.id}`}
              </p>
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

              {index === 0 && item.starting_time && <p className="info-line">Starting Time: {item.starting_time}</p>}

              { item.arrivalTime && (
                <p className="info-line">
                🕒 Arrival Time: {item.arrivalTime ? new Date(item.arrivalTime).toLocaleTimeString() : "N/A"}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
