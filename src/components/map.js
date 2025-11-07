/* eslint-disable max-len */
/* eslint-disable no-unused-vars */
/* eslint-disable require-jsdoc */
import React, {useEffect, useState} from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axios from "axios";
import santaBusIcon from "../assets/bus.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const busIcon = L.icon({
  iconUrl: santaBusIcon,
  iconSize: [50, 50],
  iconAnchor: [25, 50],
  popupAnchor: [0, -50],
});

function FollowBus({position, enabled = false}) {
  const map = useMap();
  useEffect(() => {
    if (enabled && position) map.setView(position, map.getZoom());
  }, [position, map, enabled]);
  return null;
}

function FitToTwoMarkers({positions = [], minZoom = 5}) {
  const map = useMap();

  useEffect(() => {
    // Filter out invalid positions
    const validPositions = positions.filter(
        (pos) => pos && pos[0] != null && pos[1] != null,
    );

    if (!map || validPositions.length < 2) return;

    const bounds = L.latLngBounds(validPositions);
    const zoom = map.getBoundsZoom(bounds, false);
    const center = bounds.getCenter();
    map.setView(center, Math.max(zoom - 0.55, minZoom));
  }, [map, positions, minZoom]);

  return null;
}

export default function Map({data, currentLocation, destinationStop}) {
  // Define default position
  const [busPosition, setBusPosition] = useState(currentLocation ?
    [currentLocation.lat, currentLocation.lng] :
    [29.619707, -95.3193855]); // Default to church
  const [destination, setDestination] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);

  useEffect(() => {
    if (!busPosition || !currentLocation) return;

    const start = busPosition;
    const end = [currentLocation.lat, currentLocation.lng];
    const steps = 60; // 1 min animation at 1 sec per step
    let step = 0;

    const interval = setInterval(() => {
      step++;
      const lat = start[0] + ((end[0] - start[0]) * step) / steps;
      const lng = start[1] + ((end[1] - start[1]) * step) / steps;
      setBusPosition([lat, lng]);
      if (step >= steps) clearInterval(interval);
    }, 1000); // animate every second

    return () => clearInterval(interval);
  }, [currentLocation]);


  // Set destination when data or destinationStop changes
  useEffect(() => {
    if (data && destinationStop != null && data[destinationStop.id]) {
      const stop = data[destinationStop.id];
      if (stop.lat != null && stop.lng != null) {
        setDestination([stop.lat, stop.lng]);
      }
    }
  }, [data, destinationStop]);

  // Initialize bus position from currentLocation
  useEffect(() => {
    if (
      currentLocation &&
      currentLocation.lat != null &&
      currentLocation.lng != null
    ) {
      setBusPosition([currentLocation.lat, currentLocation.lng]);
    }
  }, [currentLocation]);

  // Fetch route from OSRM whenever busPosition or destination changes
  useEffect(() => {
    if (!busPosition || !destination) return;

    const fetchRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${busPosition[1]},${busPosition[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson`;
        const res = await axios.get(url);
        const coords = res.data.routes[0].geometry.coordinates.map(
            ([lon, lat]) => [lat, lon],
        );
        setRouteCoords(coords);
      } catch (error) {
        console.error("Error fetching route:", error);
      }
    };

    fetchRoute();
  }, [busPosition, destination]);

  // Render nothing if busPosition is not ready yet
  if (!busPosition) return <div>Loading map...</div>;

  return (
    <MapContainer
      center={busPosition}
      zoom={10}
      style={{height: "100%", width: "100%"}}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Route Line */}
      {routeCoords.length > 0 && (
        <Polyline
          positions={routeCoords}
          pathOptions={{color: "#1a73e8", weight: 5, opacity: 0.9}}
        />
      )}

      {/* Bus Marker */}
      <Marker position={busPosition} icon={busIcon}>
        <Popup>
          {busPosition[0] === defaultPosition[0] &&
          busPosition[1] === defaultPosition[1] ?
            "Bus has not started yet 🚫" :
            "Bus is here 🚍"}
        </Popup>
      </Marker>

      {/* Destination Marker */}
      {destination && (
        <Marker position={destination}>
          <Popup>Destination 📍</Popup>
        </Marker>
      )}

      {/* Fit map to markers safely */}
      {busPosition && destination && (
        <FitToTwoMarkers positions={[busPosition, destination]} minZoom={5} />
      )}


      {/* Optionally follow bus */}
      <FollowBus position={busPosition} enabled={true} />
    </MapContainer>
  );
}
