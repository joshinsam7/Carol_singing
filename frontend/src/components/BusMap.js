/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React, {useEffect, useState} from "react";
import {MapContainer, TileLayer, Marker, Popup, useMap} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import busIconImg from "../assets/bus.png";
import nextStopIconImg from "../assets/orange-locale.png";
import greenLocale from "../assets/green-locale.png";

// ---------------- Icons ----------------
const busIcon = L.icon({
  iconUrl: busIconImg,
  iconSize: [50, 50],
  iconAnchor: [25, 50],
  popupAnchor: [0, -50],
});

const destinationIcon = L.icon({
  iconUrl: nextStopIconImg,
  iconSize: [60, 60],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

const greenLocaleIcon = L.icon({
  iconUrl: greenLocale,
  iconSize: [60, 60],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

// ---------------- Helpers ----------------
function FollowBus({position, manualOverride}) {
  const map = useMap();

  useEffect(() => {
    if (!manualOverride && position?.[0] != null && position?.[1] != null) {
      map.setView(position, map.getZoom());
    }
  }, [position, manualOverride, map]);

  return null;
}


function FitToTwoMarkers({positions = [], minZoom = 5}) {
  const map = useMap();
  useEffect(() => {
    const validPositions = positions.filter(
        (pos) => pos && pos[0] != null && pos[1] != null,
    );
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
  destinationStop = null, // now always a stop object or null
  nextDestinationStop = null,
  atStop = null, // current stop object
  stopsMap,
  busStatus = "idle",
  tripStarted = false,
} = {}) {
  const defaultPosition = [29.619707, -95.3193855];
  const [busPosition, setBusPosition] = useState([
    currentLocation.lat,
    currentLocation.lng,
  ]);
  const [destination, setDestination] = useState(null);
  const [manualOverride, setManualOverride] = useState(false);
  const [nextDestination, setNextDestination] = useState(null);

  // --- Update bus position
  useEffect(() => {
    if (!currentLocation) return;
    setBusPosition([currentLocation.lat, currentLocation.lng]);

    // Log correctly
    console.log("Bus's Location in BusMap", currentLocation.lat, " Long :", currentLocation.lng,
    );
  }, [currentLocation]);


  // --- Determine destination coordinates
  useEffect(() => {
    if (!destinationStop) {
      setDestination(null);
      return;
    }

    const lat = destinationStop.latitude ?? destinationStop.lat;
    const lng = destinationStop.longitude ?? destinationStop.lng;
    if (lat != null && lng != null) {
      setDestination([lat, lng]);
    } else {
      setDestination(null);
    }
  }, [destinationStop]);

  // --- Determine next destination coordinates (green marker)
  useEffect(() => {
    if (!nextDestinationStop) {
      setNextDestination(null);
      return;
    }

    const lat = nextDestinationStop.latitude ?? nextDestinationStop.lat;
    const lng = nextDestinationStop.longitude ?? nextDestinationStop.lng;
    if (lat != null && lng != null) {
      setNextDestination([lat, lng]);
    } else {
      setNextDestination(null);
    }
  }, [nextDestinationStop]);


  // --- Optionally override bus position if at a stop
  useEffect(() => {
    if (atStop) {
      const lat = atStop.latitude ?? atStop.lat;
      const lng = atStop.longitude ?? atStop.lng;
      if (lat != null && lng != null) setBusPosition([lat, lng]);
    }
  }, [atStop]);

  return (
    <MapContainer
      center={busPosition}
      zoom={10}
      style={{height: "100%", width: "100%"}}
      whenReady={(map) => {
        map.target.on("zoomstart dragstart", () => setManualOverride(true));
      }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <Marker position={busPosition} icon={busIcon}>
        <Popup>
          {busStatus === "idle" && atStop ?
            `We are still at Stop ${atStop.id || "N/A"} 🎶` :
            "Van is en route 🚐"}
        </Popup>
      </Marker>

      {/* Orange = current destination */}
      {destination?.[0] != null && destination?.[1] != null && (
        <Marker position={destination} icon={destinationIcon}>
          <Popup>Next Stop 📍</Popup>
        </Marker>
      )}

      {/* Green = stop after next */}
      {nextDestination?.[0] != null && nextDestination?.[1] != null && (
        <Marker position={nextDestination} icon={greenLocaleIcon}>
          <Popup>Stop After Next 📍</Popup>
        </Marker>
      )}


      {/* Fit map to bus + next stop */}
      {busPosition?.[0] != null && destination?.[0] != null && (
        <FitToTwoMarkers positions={[busPosition, destination]} minZoom={5} />
      )}

      <FollowBus position={busPosition} manualOverride={manualOverride} />
    </MapContainer>
  );
}
