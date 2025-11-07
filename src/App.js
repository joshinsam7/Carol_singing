/* eslint-disable max-len */
/* eslint-disable no-unused-vars */
/* eslint-disable require-jsdoc */
import React, {useEffect, useState} from "react";
import "./App.css";
import Map from "./components/map";
import {Header} from "./components/header";
import Information from "./components/Information";
import Summary from "./components/summary";
import {Helmet} from "react-helmet";
import SnowParticles from "./components/SnowFlakes";
import {database} from "./firebase"; // your firebase.js
import {ref, get} from "firebase/database";

function App() {
  const [showInfo, setShowInfo] = useState(false);
  const [data, setData] = useState(null);
  const [currentLocation, setCurrentLocation] = useState({lat: 29.619707, lng: -95.3193855}); // Default to church
  const [destinationStop, setDestinationStop] = useState({id: 0}); // Default to first stop
  const [nextStop, setNextStop] = useState({id: 1}); // Default to second stop
  const [enrouteStop, setEnrouteStop] = useState(null);

  const toggleInfo = () => {
    setShowInfo((prev) => !prev);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const dbRef = ref(database, "/"); // root
        const snapshot = await get(dbRef);

        if (snapshot.exists()) {
          setData(snapshot.val());
          console.log(snapshot.val());
        } else {
          console.log("No data available");
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="App">
      <SnowParticles />
      <header className="App-header">
        <Helmet>
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
        </Helmet>
        <Header toggleInfo={toggleInfo} />
      </header>

      <main className="main-layout">
        <section className="map-column" style={{position: "relative"}}>
          <Map
            data={data}
            currentLocation={currentLocation}
            destinationStop={destinationStop}
          />
          <Summary data={data} nextStop={nextStop} enrouteStop={enrouteStop} />
        </section>

        {/* Sidebar */}
        <aside className={`side right ${showInfo ? "open" : ""}`}>
          <Information
            data={
              data ?
                data.map((item, index) => ({
                  id: index + 1, // generates 1,2,3...
                  Name: item.name || `Stop ${index + 1}`, // fallback name
                  Address: item.address,
                  Arrived: item.arrived || false, // optional
                  arrivedAt: item.arrivedAt || null,
                  notes: item.notes || null,
                  tag: item.tag || null,
                })) :
                []
            }
          />
        </aside>
      </main>
    </div>
  );
}

export default App;
