/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React, {useEffect, useState, useRef} from "react";
import {MapContainer, TileLayer, Marker, Polyline, Popup, useMap} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axios from "axios";
import busIconImg from "../assets/bus.png";
import nextStopIconImg from "../assets/orange-locale.png";

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

const OFF_ROUTE_THRESHOLD = 30;

function distanceFromPolyline(point, polyline) {
  if (!polyline || polyline.length === 0) return Infinity;
  const latlngPoint = L.latLng(point[0], point[1]);
  return Math.min(...polyline.map((p) => latlngPoint.distanceTo(L.latLng(p[0], p[1]))));
}

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

export default function BusMap({
  currentLocation = {lat: 29.619707, lng: -95.3193855},
  destinationStop = {},
  busStatus = "idle",
  setRouteETA = () => {},
  data = [],
} = {}) {
  const defaultPosition = [29.619707, -95.3193855];

  const [busPosition, setBusPosition] = useState([currentLocation.lat, currentLocation.lng]);
  const [busPath, setBusPath] = useState([[currentLocation.lat, currentLocation.lng]]);
  const [destination, setDestination] = useState(
    destinationStop?.Latitude != null && destinationStop?.Longitude != null ?
      [destinationStop.Latitude, destinationStop.Longitude] :
      null,
  );
  const [routeCoords, setRouteCoords] = useState([]);
  const [manualOverride, setManualOverride] = useState(false);
  const intervalRef = useRef(null);

  // --- Update destination if destinationStop changes
  useEffect(() => {
    const {Latitude, Longitude} = destinationStop || {};
    if (Latitude != null && Longitude != null) {
      setDestination([Latitude, Longitude]);
      setRouteCoords([]);
    } else {
      setDestination(null);
    }
  }, [destinationStop]);

  // --- Animate bus movement
  useEffect(() => {
    if (!currentLocation) return;

    const start = busPosition;
    const end = [currentLocation.lat, currentLocation.lng];
    const steps = 60;
    let step = 0;

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      step++;
      const lat = start[0] + ((end[0] - start[0]) * step) / steps;
      const lng = start[1] + ((end[1] - start[1]) * step) / steps;
      const updatedPos = [lat, lng];

      setBusPosition(updatedPos);
      setBusPath((prev) => [...prev, updatedPos]);

      if (routeCoords.length > 0 && distanceFromPolyline(updatedPos, routeCoords) > OFF_ROUTE_THRESHOLD) {
        setRouteCoords([]);
      }

      if (step >= steps) clearInterval(intervalRef.current);
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [currentLocation]); // depend on currentLocation

  // --- Fetch OSRM route once per destination
  useEffect(() => {
    if (!destination || busStatus === "idle" || routeCoords.length > 0) return;

    const fetchRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${busPosition[1]},${busPosition[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson`;
        const res = await axios.get(url);
        const coords = res.data.routes?.[0]?.geometry?.coordinates?.map(([lon, lat]) => [lat, lon]) || [];
        setRouteCoords(coords);
      } catch (err) {
        console.error("Error fetching route:", err);
      }
    };

    fetchRoute();
  }, [destination, busStatus, busPosition, routeCoords.length]);

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

      {routeCoords.length > 0 && <Polyline positions={routeCoords} pathOptions={{color: "#1a73e8", weight: 5, opacity: 0.9}} />}
      {busPath.length > 1 && <Polyline positions={busPath} pathOptions={{color: "#00cc00", weight: 3, opacity: 0.7, dashArray: "5,10"}} />}

      {busPosition?.[0] != null && busPosition?.[1] != null && (
        <Marker position={busPosition} icon={busIcon}>
          <Popup>{busPosition[0] === defaultPosition[0] ? "Bus has not started yet 🚫" : "Bus is here 🚍"}</Popup>
        </Marker>
      )}

      {destination?.[0] != null && destination?.[1] != null && (
        <Marker position={destination} icon={destinationIcon}>
          <Popup>Next Stop 📍</Popup>
        </Marker>
      )}

      {busPosition?.[0] != null && destination?.[0] != null && <FitToTwoMarkers positions={[busPosition, destination]} minZoom={5} />}
      <FollowBus position={busPosition} manualOverride={manualOverride} />
    </MapContainer>
  );
}
