/* eslint-disable max-len */
// src/components/SnowFlakes.js
import React, {useCallback} from "react";
import Particles from "react-tsparticles";
import {loadFull} from "tsparticles";

const SnowParticles = () => {
  // initialize the tsParticles instance
  const particlesInit = useCallback(async (engine) => {
    await loadFull(engine); // load full package
  }, []);

  return (
    <Particles
      id="tsparticles"
      init={particlesInit}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 9999, // on top of everything
      }}
      options={{
        fpsLimit: 60,
        particles: {
          number: {value: 200, density: {enable: true, area: 800}},
          color: {value: "#ffffff"},
          shape: {type: "circle"},
          opacity: {value: 0.8, random: true},
          size: {value: {min: 2, max: 5}},
          move: {
            direction: "bottom",
            enable: true,
            speed: 2,
            outModes: {default: "out"},
          },
        },
        interactivity: {events: {onHover: {enable: false}, onClick: {enable: false}}},
        detectRetina: true,
      }}
    />
  );
};

export default SnowParticles;
