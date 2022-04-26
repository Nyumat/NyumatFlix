import { Link } from 'react-router-dom'
import nyumatFlix from "../img/logo.png"
import "../styles/Logo.css";
import "../styles/Player.css";
import { useEffect, useState } from "react";

function Player() {



      const movieId = window.location.pathname.split("/")[2];
      const [movieData, setMovieData] = useState<any>([]);

      const tvId = window.location.pathname.split("/")[2];
      const [tvData, setTvData] = useState<any>([]);

      useEffect(() => {getTvData(); getMovieData();}, [])

      const getTvData = async () => {
            const response = await fetch(`https://api.themoviedb.org/3/tv/${tvId}?api_key=[your_api_key]9&language=en-US`);
            const data = await response.json();
            setTvData(data);
      }

      const getMovieData = async () => {
            const response = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=[your_api_key]9&language=en-US`);
            const data = await response.json();
            setMovieData(data);
      }

      if (window.location.pathname.split("/")[1] === "movies") {
            return (

            <div>
                  <br>
                  </br>
                  <br>
                  </br>
                  <div className='movie-title'>
                        <h1>{movieData.title}</h1>
                  </div>
                  <br>
                  </br>
                  <div className='movie-release'>
                        <h2>Released: {new Date(movieData.release_date).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric"
                        })}</h2>
                  </div>
                        <br>
                        </br>
                        <br>
                        </br>
                  <div className="Player">
                        <div className="Player-container">
                              <iframe id="iframe" allowFullScreen src={`https://www.2embed.ru/embed/tmdb/movie?id=${movieId}`}></iframe>
                        </div>
                  </div>
            </div>

      );

      } else {

            
            return (

            <div>
                  <br>
                  </br>
                  <br>
                  </br>
                  <div className='show-title'>
                        <h1>{tvData.name}</h1>
                  </div>
                  <br>
                  </br>
                  <div className='show-release'>
                        <h2>Released: {new Date(tvData.first_air_date).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric"
                        })}</h2>
                  </div>
                  <br>
                  </br>
                  <br>
                  </br>
                  <div className="Player">
                        <div className="Player-container">
                              <iframe id="iframe" allowFullScreen src={`https://www.2embed.ru/embed/tmdb/tv?id=${tvId}&s=${1}&e=${1}`}></iframe>
                        </div>
                  </div>
            </div>

           

      );
      }


      
}

export default Player