/* eslint-disable camelcase */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import {useEffect, useState, useRef} from "react";

export default function useBusSocket(stops) {
  const [busState, setBusState] = useState({
    status: "idle",
    at_stop: null,
    destination_stop: null,
    lat: null,
    lng: null,
    last_update: null,
  });

  const ws = useRef(null);

  // keep latest stops reference
  const stopsRef = useRef(stops);
  useEffect(() => {
    stopsRef.current = stops;
  }, [stops]);

  useEffect(() => {
    ws.current = new WebSocket(process.env.REACT_APP_SOCKET);

    ws.current.onopen = () => console.log("WebSocket connected");
    ws.current.onclose = () => console.log("WebSocket disconnected");

    ws.current.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data);
        if (parsed.type === "bus_update") {
          const {status, at_stop, destination_stop, lat, lng, last_update} = parsed.data;

          // ✅ Always trust backend coordinates for actual bus position
          setBusState({
            status,
            at_stop,
            destination_stop,
            lat,
            lng,
            last_update,
          });
        }
      } catch (err) {
        console.error("WebSocket parsing error:", err);
      }
    };

    return () => ws.current?.close();
  }, []);

  return busState;
}
