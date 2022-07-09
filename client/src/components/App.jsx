import React from 'react';
import logo from '../img/logo.svg';
import "../styles/App.css";
import { useEffect } from "react";
import Particles from "react-tsparticles";
import { loadFull } from "tsparticles";

function App() {

  useEffect(() => {
    document.title = "NyumatFlix - Stream Movies and TV Shows";
  }, []);

  const particlesInit = async (main) => {
    await loadFull(main);
  };

  const particlesLoaded = (container) => {
    console.log(container);
  };


  return (
    <div className="App">
      <Particles
        id='tsparticles'
        init={particlesInit}
        loaded={particlesLoaded}
        options={{
          "particles": {
          "number": {
                  "value": 60,
                  "density": {
                        "enable": true,
                        "value_area": 800
                  }
            },
            "color": {
                  "value": "#00ff45"
            },
            "shape": {
                  "type": "circle",
                  "stroke": {
                        "width": 0,
                        "color": "#00ff45"
                  },
                  "polygon": {
                        "nb_sides": 5
                  },
                  "image": {
                        "src": "img/github.svg",
                        "width": 100,
                        "height": 100
                  }
            },
            "opacity": {
                  "value": 0.5,
                  "random": false,
                  "anim": {
                        "enable": false,
                        "speed": 1,
                        "opacity_min": 0.1,
                        "sync": false
                  }
            },
            "size": {
                  "value": 2,
                  "random": true,
                  "anim": {
                        "enable": false,
                        "speed": 40,
                        "size_min": 0.1,
                        "sync": false
                  }
            },
            "line_linked": {
                  "enable": true,
                  "distance": 150,
                  "color": "#0033ff",
                  "opacity": 0.4,
                  "width": 1
            },
            "move": {
                  "enable": true,
                  "speed": 2,
                  "direction": "none",
                  "random": false,
                  "straight": false,
                  "out_mode": "out",
                  "bounce": false,
                  "attract": {
                        "enable": false,
                        "rotateX": 600,
                        "rotateY": 1200
                  }
            }
      },
      "interactivity": {
            "detect_on": "window",
            "events": {
                  "onhover": {
                        "enable": true,
                        "mode": "grab"
                  },
                  "onclick": {
                        "enable": true,
                        "mode": "push"
                  },
                  "resize": true
            },
            "modes": {
                  "grab": {
                        "distance": 150,
                        "line_linked": {
                              "opacity": 1
                        }
                  },
                  "bubble": {
                        "distance": 400,
                        "size": 40,
                        "duration": 2,
                        "opacity": 8,
                        "speed": 3
                  },
                  "repulse": {
                        "distance": 200,
                        "duration": 0.4
                  },
                  "push": {
                        "particles_nb": 4
                  },
                  "remove": {
                        "particles_nb": 2
                  }
            }
      },
      "retina_detect": true
    }}
      />
      
      <meta name="viewport" content="width=device-width,minimum-scale=1.0,maximum-scale=1.0"/>
      <section className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
      </section>
    </div>
  )
}

export default App
