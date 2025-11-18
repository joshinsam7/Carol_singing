/* eslint-disable camelcase */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
/* eslint-disable camelcase */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import {useEffect, useState, useRef} from "react";

export default function useBusSocket(initialStops = []) {
  // Default coordinates if server doesn't provide them
  const DEFAULT_LAT = 29.619707;
  const DEFAULT_LNG = -95.3193855;

  const [busState, setBusState] = useState({
    status: "idle",
    at_stop: null,
    destination_stop: null,
    lat: DEFAULT_LAT,
    lng: DEFAULT_LNG,
    routeETA: null,
    routeDistance: null,
    last_update: null,
    arrivalTime: null,
    waitingForApproval: false,
  });

  const [stops, setStops] = useState(initialStops);
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket(process.env.REACT_APP_SOCKET);

    ws.current.onopen = () => console.log("WebSocket connected");
    ws.current.onclose = () => console.log("WebSocket disconnected");

    ws.current.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data);

        if (parsed.type === "bus_update") {
          const {
            status,
            current_stop,
            destination_stop,
            lat,
            lng,
            routeETA,
            last_update,
            arrivalTime,
          } = parsed.data;

          // Update busState
          setBusState((prev) => ({
            status,
            at_stop: current_stop,
            destination_stop,
            lat: lat ?? prev.lat ?? DEFAULT_LAT,
            lng: lng ?? prev.lng ?? DEFAULT_LNG,
            routeETA: routeETA ?? prev.routeETA ?? null,
            last_update,
            arrivalTime: arrivalTime ?? prev.arrivalTime,
            waitingForApproval: status === "idle",
          }));

          // ✅ Update the arrivalTime for the stop that just arrived
          if (status === "idle" && current_stop && arrivalTime) {
            setStops((prevStops) =>
              prevStops.map((stop) =>
                stop.id === current_stop ?
                  {...stop, arrivalTime} :
                  stop,
              ),
            );
          }
        }

        if (parsed.type === "stop_update") {
          const updatedStop = parsed.data;
          setStops((prevStops) =>
            prevStops.map((s) =>
              s.id === updatedStop.id ? {...s, ...updatedStop} : s,
            ),
          );
        }
      } catch (err) {
        console.error("WebSocket parsing error:", err);
      }
    };

    return () => ws.current?.close();
  }, []);

  return {busState, stops, setStops};
}
