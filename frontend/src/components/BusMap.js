/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React, {useEffect, useState} from "react";
import {MapContainer, TileLayer, Marker, Popup, useMap} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import busIconImg from "../assets/bus.png";
import nextStopIconImg from "../assets/orange-locale.png";

// ---------------- Icons ----------------
const busIcon = L.icon({
  iconUrl: busIconImg,
  iconSize: [50, 50],
  iconAnchor: [25, 50],
  popupAnchor: [0, -50],
});

const destinationIcon = L.icon({
  iconUrl: nextStopIconImg,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

// ---------------- Helpers ----------------
function FollowBus({position, manualOverride}) {
  const map = useMap();
  useEffect(() => {
    if (!manualOverride && position) map.setView(position, map.getZoom());
  }, [position, map, manualOverride]);
  return null;
}

function FitToTwoMarkers({positions = [], minZoom = 5}) {
  const map = useMap();
  useEffect(() => {
    const validPositions = positions.filter((pos) => pos && pos[0] != null && pos[1] != null);
    if (validPositions.length < 2) return;
    const bounds = L.latLngBounds(validPositions);
    const zoom = map.getBoundsZoom(bounds, false);
    map.setView(bounds.getCenter(), Math.max(zoom - 0.55, minZoom));
  }, [map, positions, minZoom]);
  return null;
}

// ---------------- Main Component ----------------
export default function BusMap({
  currentLocation = {lat: 29.619707, lng: -95.3193855},
  destinationStop = {},
  busStatus = "idle",
  setRouteETA = () => {},
  data = [],
  tripStarted = false,
} = {}) {
  const defaultPosition = [29.619707, -95.3193855];
  const [busPosition, setBusPosition] = useState([currentLocation.lat, currentLocation.lng]);
  const [destination, setDestination] = useState(null);
  const [manualOverride, setManualOverride] = useState(false);

  // --- Update destination when destinationStop changes
  useEffect(() => {
    const {Latitude, Longitude} = destinationStop || {};
    if (Latitude != null && Longitude != null) {
      setDestination([Latitude, Longitude]);
    } else {
      setDestination(null);
    }
  }, [destinationStop]);

  // --- Instantly update bus position when location changes
  useEffect(() => {
    if (!currentLocation) return;
    setBusPosition([currentLocation.lat, currentLocation.lng]);
  }, [currentLocation]);

  return (
    <MapContainer
      center={busPosition}
      zoom={10}
      style={{height: "100%", width: "100%"}}
      onZoom={() => setManualOverride(true)}
      onDragStart={() => setManualOverride(true)}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {busPosition?.[0] != null && busPosition?.[1] != null && (
        <Marker position={busPosition} icon={busIcon}>
          <Popup>
            {busPosition[0] === defaultPosition[0] ?
              "Bus has not started yet 🚫" :
              "Bus is here 🚍"}
          </Popup>
        </Marker>
      )}

      {destination?.[0] != null && destination?.[1] != null && (
        <Marker position={destination} icon={destinationIcon}>
          <Popup>Next Stop 📍</Popup>
        </Marker>
      )}

      {busPosition?.[0] != null && destination?.[0] != null && (
        <FitToTwoMarkers positions={[busPosition, destination]} minZoom={5} />
      )}
      <FollowBus position={busPosition} manualOverride={manualOverride} />
    </MapContainer>
  );
}
