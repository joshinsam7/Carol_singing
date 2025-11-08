/* eslint-disable no-unused-vars */
/* eslint-disable require-jsdoc */
import React, {useState} from "react";
import "./header.css";
import logo from "../assets/marthoma-seeklogo.png";
export function Header({toggleInfo}) {
  const [day, setDay] = useState(1);
  const [location, setLocation] = useState("Pasadena");
  const [isMobileMenu, setIsMobileMenu] = useState(false);

  const handleHamburgerClick = () => {
    setIsMobileMenu(!isMobileMenu);
    toggleInfo();
  };

  return (
    <div className="header-container">
      <div className="header-left">
        <div className="header-brand">
          <div className="header-logo-container">
            <img src={logo} alt="Logo" className="header-logo" />
          </div>
          <div className="header-text">
            <h1 className="header-title">Trinity Carol Rounds 2025</h1>
            <p className="header-info">Day {day} • {location}</p>
          </div>
        </div>
      </div>

      <div className="header-right">
        <div className="live-indicator">
          <span className="live-dot"></span>
                    LIVE
        </div>

        <button className="hamburger-btn" onClick={handleHamburgerClick}>
                    ☰
        </button>
      </div>
    </div>
  );
}
