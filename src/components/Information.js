/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React, {useEffect} from "react";
import "./Information.css";

export default function Information({data}) {
  // sample data (used as default / fallback)

  return (
    <div className="information">
      {data.map((item) => (
        <div key={item.id} className={`info-item ${item.Arrived ? "arrived-card" : ""}`}>
          <div className="info-left">
            <div className={`check-circle ${item.Arrived ? "arrived-circle" : "number-circle"}`}>
              {item.Arrived ? "✓" : item.id}
            </div>
          </div>
          <div className="info-body">
            <h3 className="info-title">{item.Name}</h3>
            <div className="info-line">
              <span className="icon">📍</span>
              <a
                className="muted"
                href={`https://www.google.com/maps/?q=${encodeURIComponent(item.Address)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.Address}
              </a>
            </div>
            <div className="info-line">
              <span className="icon">🕒</span>
              <span className="muted">
                {item.Arrived ?
                    `Arrived: ${item.arrivedAt ? item.arrivedAt : "Yes"}` :
                    "Not arrived yet"}
              </span>
            </div>
            {item.notes && <div className="note">📝 <em>{item.notes}</em></div>}
            {item.tag && <div className="tag">{item.tag}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
