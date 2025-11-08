/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
// src/hooks/useBusWebSocket.js
import {useEffect, useState, useRef} from "react";

export default function useBusSocket(socketUrl) {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const retryRef = useRef(0);

  useEffect(() => {
    if (!socketUrl) {
      console.warn("WebSocket URL is undefined");
      return () => {};
    }

    const connect = () => {
      console.log(`🔌 Attempting WS connection to: ${socketUrl}`);
      const ws = new WebSocket(socketUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("✅ Connected to WebSocket server");
        setConnected(true);
        retryRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setData(parsed);
        } catch (err) {
          console.error("Failed to parse WS message:", err);
        }
      };

      ws.onclose = () => {
        console.log("❌ WebSocket disconnected");
        setConnected(false);
        const delay = Math.min(1000 * 2 ** retryRef.current, 10000);
        console.log(`Retrying WS in ${delay / 1000}s`);
        retryRef.current += 1;
        setTimeout(connect, delay);
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        ws.close();
      };
    };

    connect();

    return () => wsRef.current?.close(); // ✅ consistent cleanup
  }, [socketUrl]);


  return {data, connected};
}
